import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { existsSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const TEST_DATA_PATH = join(tmpdir(), `crossseed-test-${process.pid}`)
process.env.DATA_PATH = TEST_DATA_PATH

import {
	cacheTorrent,
	getCachedTorrent,
	hasCachedTorrent,
	clearCacheForInstance,
	clearOutputForInstance,
	saveTorrentToOutput,
	getCacheStats,
	getOutputStats,
	_resetCachePaths,
} from '../../src/server/utils/crossSeedCache'

describe('crossSeedCache', () => {
	const TEST_INSTANCE = 99999
	const HASH_1 = 'abc123def456abc123def456abc123def456abc1'
	const HASH_2 = 'def456abc123def456abc123def456abc123def4'

	beforeAll(() => {
		_resetCachePaths()
	})

	afterAll(() => {
		rmSync(TEST_DATA_PATH, { recursive: true, force: true })
	})

	beforeEach(() => {
		clearCacheForInstance(TEST_INSTANCE)
		clearOutputForInstance(TEST_INSTANCE)
	})

	afterEach(() => {
		clearCacheForInstance(TEST_INSTANCE)
		clearOutputForInstance(TEST_INSTANCE)
	})

	describe('cacheTorrent and getCachedTorrent', () => {
		it('caches and retrieves torrent data', () => {
			const torrentData = Buffer.from('test torrent data')

			cacheTorrent(TEST_INSTANCE, HASH_1, torrentData)

			const cached = getCachedTorrent(TEST_INSTANCE, HASH_1)
			expect(cached).not.toBeNull()
			expect(cached?.toString()).toBe('test torrent data')
		})

		it('overwrites existing cache', () => {
			const data1 = Buffer.from('first')
			const data2 = Buffer.from('second')

			cacheTorrent(TEST_INSTANCE, HASH_1, data1)
			cacheTorrent(TEST_INSTANCE, HASH_1, data2)

			const cached = getCachedTorrent(TEST_INSTANCE, HASH_1)
			expect(cached?.toString()).toBe('second')
		})

		it('returns null for non-existent cache', () => {
			expect(getCachedTorrent(TEST_INSTANCE, HASH_2)).toBeNull()
		})
	})

	describe('hasCachedTorrent', () => {
		it('returns true when torrent is cached', () => {
			cacheTorrent(TEST_INSTANCE, HASH_1, Buffer.from('data'))
			expect(hasCachedTorrent(TEST_INSTANCE, HASH_1)).toBe(true)
		})

		it('returns false when torrent is not cached', () => {
			expect(hasCachedTorrent(TEST_INSTANCE, HASH_2)).toBe(false)
		})
	})

	describe('clearCacheForInstance', () => {
		it('clears all cache for instance', () => {
			cacheTorrent(TEST_INSTANCE, HASH_1, Buffer.from('data1'))
			cacheTorrent(TEST_INSTANCE, HASH_2, Buffer.from('data2'))

			const cleared = clearCacheForInstance(TEST_INSTANCE)

			expect(cleared).toBe(2)
			expect(hasCachedTorrent(TEST_INSTANCE, HASH_1)).toBe(false)
			expect(hasCachedTorrent(TEST_INSTANCE, HASH_2)).toBe(false)
		})

		it('returns 0 when no cache exists', () => {
			expect(clearCacheForInstance(88888)).toBe(0)
		})
	})

	describe('saveTorrentToOutput', () => {
		it('saves torrent to output directory', () => {
			const name = 'test-torrent'
			const data = Buffer.from('torrent data')

			const path = saveTorrentToOutput(TEST_INSTANCE, name, HASH_1, data)

			expect(path).toContain('test-torrent')
			expect(path).toContain('.torrent')
			expect(existsSync(path)).toBe(true)
		})

		it('sanitizes filename', () => {
			const name = 'test/torrent:with*bad?chars'
			const data = Buffer.from('data')

			const path = saveTorrentToOutput(TEST_INSTANCE, name, HASH_2, data)
			const filename = path.split('/').pop()!

			expect(filename).not.toContain(':')
			expect(filename).not.toContain('*')
			expect(filename).not.toContain('?')
			expect(filename).toContain('test_torrent_with_bad_chars')
		})
	})

	describe('clearOutputForInstance', () => {
		it('clears output directory for instance', () => {
			saveTorrentToOutput(TEST_INSTANCE, 'torrent1', HASH_1, Buffer.from('data1'))
			saveTorrentToOutput(TEST_INSTANCE, 'torrent2', HASH_2, Buffer.from('data2'))

			const cleared = clearOutputForInstance(TEST_INSTANCE)

			expect(cleared).toBe(2)
		})
	})

	describe('getCacheStats', () => {
		it('returns correct stats for cached torrents', () => {
			cacheTorrent(TEST_INSTANCE, HASH_1, Buffer.from('12345'))
			cacheTorrent(TEST_INSTANCE, HASH_2, Buffer.from('1234567890'))

			const stats = getCacheStats(TEST_INSTANCE)

			expect(stats.count).toBe(2)
			expect(stats.totalSize).toBe(15)
		})

		it('returns zero stats for empty cache', () => {
			const stats = getCacheStats(77777)

			expect(stats.count).toBe(0)
			expect(stats.totalSize).toBe(0)
		})
	})

	describe('getOutputStats', () => {
		it('returns correct stats for output files', () => {
			saveTorrentToOutput(TEST_INSTANCE, 'torrent1', HASH_1, Buffer.from('data'))
			saveTorrentToOutput(TEST_INSTANCE, 'torrent2', HASH_2, Buffer.from('moredata'))

			const stats = getOutputStats(TEST_INSTANCE)

			expect(stats.count).toBe(2)
			expect(stats.files.length).toBe(2)
		})

		it('returns empty stats for no output', () => {
			const stats = getOutputStats(66666)

			expect(stats.count).toBe(0)
			expect(stats.files).toEqual([])
		})
	})

})
