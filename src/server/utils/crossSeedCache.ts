import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { log } from './logger'

const dirCache: { cache: string | null; output: string | null } = { cache: null, output: null }

function getDir(type: 'cache' | 'output'): string {
	if (!dirCache[type]) {
		const dataDir = process.env.DATA_PATH || './data'
		const subdir = type === 'cache' ? 'cross-seed-cache' : 'cross-seeds'
		dirCache[type] = join(dataDir, subdir)
		mkdirSync(dirCache[type]!, { recursive: true })
	}
	return dirCache[type]!
}

function getCacheDir(): string {
	return getDir('cache')
}

function getOutputDir(): string {
	return getDir('output')
}

const VALID_HASH_REGEX = /^[a-fA-F0-9]+$/

function sanitizeHash(hash: string): string {
	if (!VALID_HASH_REGEX.test(hash)) {
		throw new Error('Invalid hash format')
	}
	return hash.toLowerCase()
}

function getTorrentCachePath(instanceId: number, infoHash: string): string {
	const safeHash = sanitizeHash(infoHash)
	const instanceDir = join(getCacheDir(), String(instanceId))
	mkdirSync(instanceDir, { recursive: true })
	return join(instanceDir, `${safeHash}.torrent`)
}

function getOutputPath(instanceId: number, name: string, infoHash: string): string {
	const safeHash = sanitizeHash(infoHash)
	const instanceDir = join(getOutputDir(), String(instanceId))
	mkdirSync(instanceDir, { recursive: true })
	const safeName = name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 200)
	return join(instanceDir, `${safeName}[${safeHash.slice(0, 8)}].torrent`)
}

export function cacheTorrent(instanceId: number, infoHash: string, data: Buffer): void {
	const path = getTorrentCachePath(instanceId, infoHash)
	writeFileSync(path, data)
	log.info(`[CrossSeed] Cached torrent: ${infoHash}`)
}

export function getCachedTorrent(instanceId: number, infoHash: string): Buffer | null {
	const path = getTorrentCachePath(instanceId, infoHash)
	if (!existsSync(path)) return null
	return readFileSync(path)
}

export function hasCachedTorrent(instanceId: number, infoHash: string): boolean {
	return existsSync(getTorrentCachePath(instanceId, infoHash))
}

export function saveTorrentToOutput(instanceId: number, name: string, infoHash: string, data: Buffer): string {
	const path = getOutputPath(instanceId, name, infoHash)
	writeFileSync(path, data)
	log.info(`[CrossSeed] Saved torrent to output: ${path}`)
	return path
}

function clearTorrentsInDir(dir: string): number {
	if (!existsSync(dir)) return 0
	const files = readdirSync(dir).filter((f) => f.endsWith('.torrent'))
	for (const file of files) unlinkSync(join(dir, file))
	return files.length
}

export function clearCacheForInstance(instanceId: number): number {
	const count = clearTorrentsInDir(join(getCacheDir(), String(instanceId)))
	if (count > 0) log.info(`[CrossSeed] Cleared ${count} cached torrents for instance ${instanceId}`)
	return count
}

export function clearOutputForInstance(instanceId: number): number {
	const count = clearTorrentsInDir(join(getOutputDir(), String(instanceId)))
	if (count > 0) log.info(`[CrossSeed] Cleared ${count} output torrents for instance ${instanceId}`)
	return count
}

function getTorrentFiles(dir: string): string[] {
	if (!existsSync(dir)) return []
	return readdirSync(dir).filter((f) => f.endsWith('.torrent'))
}

export function getCacheStats(instanceId: number): { count: number; totalSize: number } {
	const dir = join(getCacheDir(), String(instanceId))
	const files = getTorrentFiles(dir)
	let count = 0
	let totalSize = 0
	for (const f of files) {
		try {
			totalSize += statSync(join(dir, f)).size
			count++
		} catch {
			continue
		}
	}
	return { count, totalSize }
}

export function getOutputStats(instanceId: number): { count: number; files: string[] } {
	const files = getTorrentFiles(join(getOutputDir(), String(instanceId)))
	return { count: files.length, files }
}

export function _resetCachePaths(): void {
	dirCache.cache = null
	dirCache.output = null
}
