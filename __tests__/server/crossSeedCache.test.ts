import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import {
	cacheTorrent,
	getCachedTorrent,
	hasCachedTorrent,
	clearCacheForInstance,
	clearOutputForInstance,
	saveTorrentToOutput,
	getCacheStats,
	getOutputStats,
} from '../../src/server/utils/crossSeedCache'

const TEST_DATA_DIR = './data-test'
const ORIGINAL_DATA_PATH = process.env.DATA_PATH

describe('crossSeedCache', () => {
	beforeEach(() => {
		process.env.DATA_PATH = TEST_DATA_DIR
		mkdirSync(TEST_DATA_DIR, { recursive: true })
	})

	afterEach(() => {
		if (existsSync(TEST_DATA_DIR)) {
			rmSync(TEST_DATA_DIR, { recursive: true, force: true })
		}
		if (ORIGINAL_DATA_PATH) {
			process.env.DATA_PATH = ORIGINAL_DATA_PATH
		} else {
			delete process.env.DATA_PATH
		}
	})

	describe('cacheTorrent', () => {
		it('caches torrent data successfully', () => {
			const instanceId = 1
			const infoHash = 'abc123def456'
			const torrentData = Buffer.from('test torrent data')

			cacheTorrent(instanceId, infoHash, torrentData)

			const cached = getCachedTorrent(instanceId, infoHash)
			expect(cached).not.toBeNull()
			expect(cached?.toString()).toBe('test torrent data')
		})

		it('overwrites existing cache', () => {
			const instanceId = 1
			const infoHash = 'abc123'
			const data1 = Buffer.from('first')
			const data2 = Buffer.from('second')

			cacheTorrent(instanceId, infoHash, data1)
			cacheTorrent(instanceId, infoHash, data2)

			const cached = getCachedTorrent(instanceId, infoHash)
			expect(cached?.toString()).toBe('second')
		})

		it('separates cache by instance', () => {
			const hash = 'samehash'
			const data1 = Buffer.from('instance1')
			const data2 = Buffer.from('instance2')

			cacheTorrent(1, hash, data1)
			cacheTorrent(2, hash, data2)

			expect(getCachedTorrent(1, hash)?.toString()).toBe('instance1')
			expect(getCachedTorrent(2, hash)?.toString()).toBe('instance2')
		})
	})

	describe('hasCachedTorrent', () => {
		it('returns true when torrent is cached', () => {
			const instanceId = 1
			const infoHash = 'cached123'

			cacheTorrent(instanceId, infoHash, Buffer.from('data'))

			expect(hasCachedTorrent(instanceId, infoHash)).toBe(true)
		})

		it('returns false when torrent is not cached', () => {
			expect(hasCachedTorrent(1, 'nonexistent')).toBe(false)
		})

		it('returns false for wrong instance', () => {
			cacheTorrent(1, 'hash', Buffer.from('data'))
			expect(hasCachedTorrent(2, 'hash')).toBe(false)
		})
	})

	describe('getCachedTorrent', () => {
		it('returns null for non-existent cache', () => {
			expect(getCachedTorrent(999, 'nonexistent')).toBeNull()
		})

		it('returns buffer for existing cache', () => {
			const data = Buffer.from('torrent content')
			cacheTorrent(1, 'hash', data)

			const result = getCachedTorrent(1, 'hash')
			expect(Buffer.isBuffer(result)).toBe(true)
		})
	})

	describe('clearCacheForInstance', () => {
		it('clears all cache for instance', () => {
			cacheTorrent(1, 'hash1', Buffer.from('data1'))
			cacheTorrent(1, 'hash2', Buffer.from('data2'))
			cacheTorrent(2, 'hash3', Buffer.from('data3'))

			const cleared = clearCacheForInstance(1)

			expect(cleared).toBe(2)
			expect(hasCachedTorrent(1, 'hash1')).toBe(false)
			expect(hasCachedTorrent(1, 'hash2')).toBe(false)
			expect(hasCachedTorrent(2, 'hash3')).toBe(true)
		})

		it('returns 0 when no cache exists', () => {
			expect(clearCacheForInstance(999)).toBe(0)
		})
	})

	describe('saveTorrentToOutput', () => {
		it('saves torrent to output directory', () => {
			const instanceId = 1
			const name = 'test-torrent'
			const data = Buffer.from('torrent data')

			const path = saveTorrentToOutput(instanceId, name, data)

			expect(path).toContain('test-torrent.torrent')
			expect(existsSync(path)).toBe(true)
		})

		it('sanitizes filename', () => {
			const instanceId = 1
			const name = 'test/torrent:with*bad?chars'
			const data = Buffer.from('data')

			const path = saveTorrentToOutput(instanceId, name, data)

			expect(path).not.toContain('/')
			expect(path).not.toContain(':')
			expect(path).not.toContain('*')
			expect(path).not.toContain('?')
		})
	})

	describe('clearOutputForInstance', () => {
		it('clears output directory for instance', () => {
			saveTorrentToOutput(1, 'torrent1', Buffer.from('data1'))
			saveTorrentToOutput(1, 'torrent2', Buffer.from('data2'))
			saveTorrentToOutput(2, 'torrent3', Buffer.from('data3'))

			const cleared = clearOutputForInstance(1)

			expect(cleared).toBe(2)
		})
	})

	describe('getCacheStats', () => {
		it('returns correct stats for cached torrents', () => {
			cacheTorrent(1, 'hash1', Buffer.from('12345'))
			cacheTorrent(1, 'hash2', Buffer.from('1234567890'))

			const stats = getCacheStats(1)

			expect(stats.count).toBe(2)
			expect(stats.totalSize).toBe(15)
		})

		it('returns zero stats for empty cache', () => {
			const stats = getCacheStats(999)

			expect(stats.count).toBe(0)
			expect(stats.totalSize).toBe(0)
		})
	})

	describe('getOutputStats', () => {
		it('returns correct stats for output files', () => {
			saveTorrentToOutput(1, 'torrent1', Buffer.from('data'))
			saveTorrentToOutput(1, 'torrent2', Buffer.from('moredata'))

			const stats = getOutputStats(1)

			expect(stats.count).toBe(2)
			expect(stats.files.length).toBe(2)
		})

		it('returns empty stats for no output', () => {
			const stats = getOutputStats(999)

			expect(stats.count).toBe(0)
			expect(stats.files).toEqual([])
		})
	})
})
