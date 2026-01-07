import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { readdir, stat } from 'node:fs/promises'
import { join, resolve, basename } from 'node:path'
import { createReadStream } from 'node:fs'
import * as tar from 'tar-stream'

const files = new Hono()
const DOWNLOADS_PATH = process.env.DOWNLOADS_PATH

files.use('*', authMiddleware)

function isPathSafe(requestedPath: string): string | null {
	if (!DOWNLOADS_PATH) return null
	const resolved = resolve(DOWNLOADS_PATH, requestedPath.replace(/^\/+/, ''))
	if (!resolved.startsWith(resolve(DOWNLOADS_PATH))) return null
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

export default files
