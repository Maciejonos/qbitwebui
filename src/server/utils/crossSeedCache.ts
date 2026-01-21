import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { log } from './logger'

const DATA_DIR = process.env.DATA_PATH || './data'
const CACHE_DIR = join(DATA_DIR, 'cross-seed-cache')
const OUTPUT_DIR = join(DATA_DIR, 'cross-seeds')

mkdirSync(CACHE_DIR, { recursive: true })
mkdirSync(OUTPUT_DIR, { recursive: true })

function getTorrentCachePath(instanceId: number, infoHash: string): string {
	const instanceDir = join(CACHE_DIR, String(instanceId))
	mkdirSync(instanceDir, { recursive: true })
	return join(instanceDir, `${infoHash}.torrent`)
}

function getOutputPath(instanceId: number, name: string, infoHash: string): string {
	const instanceDir = join(OUTPUT_DIR, String(instanceId))
	mkdirSync(instanceDir, { recursive: true })
	const safeName = name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 200)
	return join(instanceDir, `${safeName}[${infoHash.slice(0, 8)}].torrent`)
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

export function deleteCachedTorrent(instanceId: number, infoHash: string): void {
	const path = getTorrentCachePath(instanceId, infoHash)
	if (existsSync(path)) {
		unlinkSync(path)
	}
}

export function saveTorrentToOutput(instanceId: number, name: string, infoHash: string, data: Buffer): string {
	const path = getOutputPath(instanceId, name, infoHash)
	writeFileSync(path, data)
	log.info(`[CrossSeed] Saved torrent to output: ${path}`)
	return path
}

export function clearCacheForInstance(instanceId: number): number {
	const instanceDir = join(CACHE_DIR, String(instanceId))
	if (!existsSync(instanceDir)) return 0

	const files = readdirSync(instanceDir).filter((f) => f.endsWith('.torrent'))
	for (const file of files) {
		unlinkSync(join(instanceDir, file))
	}
	log.info(`[CrossSeed] Cleared ${files.length} cached torrents for instance ${instanceId}`)
	return files.length
}

export function clearOutputForInstance(instanceId: number): number {
	const instanceDir = join(OUTPUT_DIR, String(instanceId))
	if (!existsSync(instanceDir)) return 0

	const files = readdirSync(instanceDir).filter((f) => f.endsWith('.torrent'))
	for (const file of files) {
		unlinkSync(join(instanceDir, file))
	}
	log.info(`[CrossSeed] Cleared ${files.length} output torrents for instance ${instanceId}`)
	return files.length
}

export function getCacheStats(instanceId: number): { count: number; totalSize: number } {
	const instanceDir = join(CACHE_DIR, String(instanceId))
	if (!existsSync(instanceDir)) return { count: 0, totalSize: 0 }

	const files = readdirSync(instanceDir).filter((f) => f.endsWith('.torrent'))
	let totalSize = 0
	for (const file of files) {
		totalSize += statSync(join(instanceDir, file)).size
	}
	return { count: files.length, totalSize }
}

export function getOutputStats(instanceId: number): { count: number; files: string[] } {
	const instanceDir = join(OUTPUT_DIR, String(instanceId))
	if (!existsSync(instanceDir)) return { count: 0, files: [] }

	const files = readdirSync(instanceDir).filter((f) => f.endsWith('.torrent'))
	return { count: files.length, files }
}

export function cleanExpiredCache(instanceId: number, maxAgeDays = 30): number {
	const instanceDir = join(CACHE_DIR, String(instanceId))
	if (!existsSync(instanceDir)) return 0

	const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
	const files = readdirSync(instanceDir).filter((f) => f.endsWith('.torrent'))
	let deleted = 0

	for (const file of files) {
		const filePath = join(instanceDir, file)
		const stat = statSync(filePath)
		if (stat.mtimeMs < cutoff) {
			unlinkSync(filePath)
			deleted++
		}
	}

	if (deleted > 0) {
		log.info(`[CrossSeed] Cleaned ${deleted} expired cache files for instance ${instanceId}`)
	}
	return deleted
}

export function hashTorrentData(data: Buffer): string {
	return createHash('sha1').update(data).digest('hex')
}
