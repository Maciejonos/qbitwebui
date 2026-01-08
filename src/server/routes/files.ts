import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { readdir, stat, rm, rename, cp, writeFile, unlink } from 'node:fs/promises'
import { join, resolve, basename, dirname } from 'node:path'
import { createReadStream } from 'node:fs'
import * as tar from 'tar-stream'

const files = new Hono()
const DOWNLOADS_PATH = process.env.DOWNLOADS_PATH
let writableCache: boolean | null = null

files.use('*', authMiddleware)

function isPathSafe(requestedPath: string): string | null {
	if (!DOWNLOADS_PATH) return null
	const base = resolve(DOWNLOADS_PATH)
	const resolved = resolve(base, requestedPath.replace(/^\/+/, ''))
	if (resolved !== base && !resolved.startsWith(base + '/')) return null
	return resolved
}

function sanitizeFilename(name: string): string {
	return name.replace(/["\r\n]/g, '_')
}

interface FileEntry {
	name: string
	size: number
	isDirectory: boolean
	modified: number
}

files.get('/', async (c) => {
	if (!DOWNLOADS_PATH) {
		return c.json({ error: 'File browser not configured' }, 404)
	}

	const requestedPath = c.req.query('path') || '/'
	const safePath = isPathSafe(requestedPath)
	if (!safePath) {
		return c.json({ error: 'Invalid path' }, 400)
	}

	try {
		const entries = await readdir(safePath)
		const result: FileEntry[] = []

		for (const name of entries) {
			try {
				const fullPath = join(safePath, name)
				const stats = await stat(fullPath)
				result.push({
					name,
					size: Number(stats.size),
					isDirectory: stats.isDirectory(),
					modified: stats.mtimeMs,
				})
			} catch {
				continue
			}
		}

		result.sort((a, b) => {
			if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
			return a.name.localeCompare(b.name)
		})

		return c.json(result)
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
			return c.json({ error: 'Path not found' }, 404)
		}
		if ((e as NodeJS.ErrnoException).code === 'ENOTDIR') {
			return c.json({ error: 'Not a directory' }, 400)
		}
		return c.json({ error: 'Failed to list directory' }, 500)
	}
})

async function* walkDir(dir: string, base: string): AsyncGenerator<{ path: string; fullPath: string; stats: Awaited<ReturnType<typeof stat>> }> {
	const entries = await readdir(dir)
	for (const name of entries) {
		const fullPath = join(dir, name)
		const relativePath = join(base, name)
		try {
			const stats = await stat(fullPath)
			if (stats.isDirectory()) {
				yield* walkDir(fullPath, relativePath)
			} else {
				yield { path: relativePath, fullPath, stats }
			}
		} catch {
			continue
		}
	}
}

files.get('/download', async (c) => {
	if (!DOWNLOADS_PATH) {
		return c.json({ error: 'File browser not configured' }, 404)
	}

	const requestedPath = c.req.query('path')
	if (!requestedPath) {
		return c.json({ error: 'Path is required' }, 400)
	}

	const safePath = isPathSafe(requestedPath)
	if (!safePath) {
		return c.json({ error: 'Invalid path' }, 400)
	}

	try {
		const stats = await stat(safePath)
		const name = basename(safePath)

		if (stats.isDirectory()) {
			const pack = tar.pack()
			const chunks: Buffer[] = []
			let streamEnded = false
			let streamError: Error | null = null
			let resolveWait: (() => void) | null = null

			pack.on('data', (chunk: Buffer) => {
				chunks.push(chunk)
				if (resolveWait) {
					resolveWait()
					resolveWait = null
				}
			})
			pack.on('end', () => {
				streamEnded = true
				if (resolveWait) {
					resolveWait()
					resolveWait = null
				}
			})
			pack.on('error', (err: Error) => {
				streamError = err
				if (resolveWait) {
					resolveWait()
					resolveWait = null
				}
			})

			const streamFiles = async () => {
				for await (const file of walkDir(safePath, '')) {
					await new Promise<void>((resolve, reject) => {
						const entry = pack.entry({ name: file.path, size: Number(file.stats.size), mtime: file.stats.mtime }, (err) => {
							if (err) reject(err)
							else resolve()
						})
						const stream = createReadStream(file.fullPath)
						stream.pipe(entry)
					})
				}
				pack.finalize()
			}
			streamFiles().catch(() => pack.destroy())

			const webStream = new ReadableStream({
				async pull(controller) {
					while (chunks.length === 0 && !streamEnded && !streamError) {
						await new Promise<void>(r => { resolveWait = r })
					}
					if (streamError) {
						controller.error(streamError)
						return
					}
					while (chunks.length > 0) {
						controller.enqueue(chunks.shift()!)
					}
					if (streamEnded) {
						controller.close()
					}
				},
				cancel() {
					pack.destroy()
				}
			})

			return new Response(webStream, {
				headers: {
					'Content-Type': 'application/x-tar',
					'Content-Disposition': `attachment; filename="${sanitizeFilename(name)}.tar"`,
				},
			})
		}

		const file = Bun.file(safePath)
		return new Response(file, {
			headers: {
				'Content-Disposition': `attachment; filename="${sanitizeFilename(name)}"`,
			},
		})
	} catch (e) {
		console.error('Download error:', e)
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
			return c.json({ error: 'File not found' }, 404)
		}
		return c.json({ error: 'Failed to download file' }, 500)
	}
})

files.get('/writable', async (c) => {
	if (!DOWNLOADS_PATH) {
		return c.json({ writable: false })
	}
	if (writableCache !== null) {
		return c.json({ writable: writableCache })
	}
	const testFile = join(DOWNLOADS_PATH, `.write-test-${Date.now()}`)
	try {
		await writeFile(testFile, '')
		await unlink(testFile)
		writableCache = true
	} catch {
		writableCache = false
	}
	return c.json({ writable: writableCache })
})

files.post('/delete', async (c) => {
	if (!DOWNLOADS_PATH) {
		return c.json({ error: 'File browser not configured' }, 404)
	}
	const body = await c.req.json<{ paths: string[] }>()
	if (!Array.isArray(body.paths) || body.paths.length === 0) {
		return c.json({ error: 'Paths array is required' }, 400)
	}
	const errors: string[] = []
	for (const path of body.paths) {
		const safePath = isPathSafe(path)
		if (!safePath) {
			errors.push(`Invalid path: ${path}`)
			continue
		}
		if (safePath === resolve(DOWNLOADS_PATH)) {
			errors.push('Cannot delete root directory')
			continue
		}
		try {
			await rm(safePath, { recursive: true })
		} catch (e) {
			errors.push(`Failed to delete ${path}: ${(e as Error).message}`)
		}
	}
	if (errors.length > 0) {
		return c.json({ error: errors.join('; ') }, 400)
	}
	return c.json({ success: true })
})

files.post('/move', async (c) => {
	if (!DOWNLOADS_PATH) {
		return c.json({ error: 'File browser not configured' }, 404)
	}
	const body = await c.req.json<{ paths: string[]; destination: string }>()
	if (!Array.isArray(body.paths) || body.paths.length === 0) {
		return c.json({ error: 'Paths array is required' }, 400)
	}
	if (!body.destination) {
		return c.json({ error: 'Destination is required' }, 400)
	}
	const destPath = isPathSafe(body.destination)
	if (!destPath) {
		return c.json({ error: 'Invalid destination' }, 400)
	}
	try {
		const destStat = await stat(destPath)
		if (!destStat.isDirectory()) {
			return c.json({ error: 'Destination must be a directory' }, 400)
		}
	} catch {
		return c.json({ error: 'Destination does not exist' }, 400)
	}
	const errors: string[] = []
	for (const path of body.paths) {
		const safePath = isPathSafe(path)
		if (!safePath) {
			errors.push(`Invalid path: ${path}`)
			continue
		}
		const name = basename(safePath)
		const newPath = join(destPath, name)
		try {
			await rename(safePath, newPath)
		} catch (e) {
			errors.push(`Failed to move ${path}: ${(e as Error).message}`)
		}
	}
	if (errors.length > 0) {
		return c.json({ error: errors.join('; ') }, 400)
	}
	return c.json({ success: true })
})

files.post('/copy', async (c) => {
	if (!DOWNLOADS_PATH) {
		return c.json({ error: 'File browser not configured' }, 404)
	}
	const body = await c.req.json<{ paths: string[]; destination: string }>()
	if (!Array.isArray(body.paths) || body.paths.length === 0) {
		return c.json({ error: 'Paths array is required' }, 400)
	}
	if (!body.destination) {
		return c.json({ error: 'Destination is required' }, 400)
	}
	const destPath = isPathSafe(body.destination)
	if (!destPath) {
		return c.json({ error: 'Invalid destination' }, 400)
	}
	try {
		const destStat = await stat(destPath)
		if (!destStat.isDirectory()) {
			return c.json({ error: 'Destination must be a directory' }, 400)
		}
	} catch {
		return c.json({ error: 'Destination does not exist' }, 400)
	}
	const errors: string[] = []
	for (const path of body.paths) {
		const safePath = isPathSafe(path)
		if (!safePath) {
			errors.push(`Invalid path: ${path}`)
			continue
		}
		const name = basename(safePath)
		const newPath = join(destPath, name)
		try {
			await cp(safePath, newPath, { recursive: true })
		} catch (e) {
			errors.push(`Failed to copy ${path}: ${(e as Error).message}`)
		}
	}
	if (errors.length > 0) {
		return c.json({ error: errors.join('; ') }, 400)
	}
	return c.json({ success: true })
})

files.post('/rename', async (c) => {
	if (!DOWNLOADS_PATH) {
		return c.json({ error: 'File browser not configured' }, 404)
	}
	const body = await c.req.json<{ path: string; newName: string }>()
	if (!body.path || !body.newName) {
		return c.json({ error: 'Path and newName are required' }, 400)
	}
	if (body.newName.includes('/') || body.newName.includes('\\') || body.newName === '.' || body.newName === '..') {
		return c.json({ error: 'Invalid file name' }, 400)
	}
	const safePath = isPathSafe(body.path)
	if (!safePath) {
		return c.json({ error: 'Invalid path' }, 400)
	}
	if (safePath === resolve(DOWNLOADS_PATH)) {
		return c.json({ error: 'Cannot rename root directory' }, 400)
	}
	const dir = dirname(safePath)
	const newPath = join(dir, body.newName)
	if (!newPath.startsWith(resolve(DOWNLOADS_PATH))) {
		return c.json({ error: 'Invalid new name' }, 400)
	}
	try {
		await rename(safePath, newPath)
		return c.json({ success: true })
	} catch (e) {
		return c.json({ error: `Failed to rename: ${(e as Error).message}` }, 500)
	}
})

export default files
