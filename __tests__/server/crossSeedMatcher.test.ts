import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/server/db', () => ({
	db: {
		exec: vi.fn(),
		run: vi.fn(),
		query: vi.fn(() => ({ get: vi.fn(), all: vi.fn(() => []) })),
	},
	CrossSeedDecisionType: {
		MATCH: 'MATCH',
		MATCH_SIZE_ONLY: 'MATCH_SIZE_ONLY',
		SIZE_MISMATCH: 'SIZE_MISMATCH',
		FILE_TREE_MISMATCH: 'FILE_TREE_MISMATCH',
		ALREADY_EXISTS: 'ALREADY_EXISTS',
		DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
		NO_DOWNLOAD_LINK: 'NO_DOWNLOAD_LINK',
		BLOCKED_RELEASE: 'BLOCKED_RELEASE',
	},
	BlocklistType: {
		NAME: 'name',
		NAME_REGEX: 'nameRegex',
		FOLDER: 'folder',
		FOLDER_REGEX: 'folderRegex',
		CATEGORY: 'category',
		TAG: 'tag',
		TRACKER: 'tracker',
		INFOHASH: 'infoHash',
		SIZE_BELOW: 'sizeBelow',
		SIZE_ABOVE: 'sizeAbove',
		LEGACY: 'legacy',
	},
}))

import {
	matchTorrentsBySizes,
	preFilterCandidate,
	type FileInfo,
} from '../../src/server/utils/crossSeedMatcher'
import { CrossSeedDecisionType } from '../../src/server/db'

describe('crossSeedMatcher', () => {
	describe('matchTorrentsBySizes', () => {
		describe('exact matches', () => {
			it('matches identical single file torrents', () => {
				const source: FileInfo[] = [{ name: 'movie.mkv', size: 1000000 }]
				const candidate: FileInfo[] = [{ name: 'movie.mkv', size: 1000000 }]

				const result = matchTorrentsBySizes(source, candidate)
				expect(result.matched).toBe(true)
				expect(result.decision).toBe(CrossSeedDecisionType.MATCH)
			})

			it('matches multi-file torrents with same files', () => {
				const source: FileInfo[] = [
					{ name: 'video.mkv', size: 5000000 },
					{ name: 'subs.srt', size: 50000 },
					{ name: 'info.nfo', size: 1000 },
				]
				const candidate: FileInfo[] = [
					{ name: 'video.mkv', size: 5000000 },
					{ name: 'subs.srt', size: 50000 },
					{ name: 'info.nfo', size: 1000 },
				]

				const result = matchTorrentsBySizes(source, candidate)
				expect(result.matched).toBe(true)
				expect(result.decision).toBe(CrossSeedDecisionType.MATCH)
			})
		})

		describe('flexible matching - different names, same sizes', () => {
			it('matches when file names differ but sizes match', () => {
				const source: FileInfo[] = [{ name: 'Movie.2024.1080p.mkv', size: 5000000 }]
				const candidate: FileInfo[] = [{ name: 'different-name.mkv', size: 5000000 }]

				const result = matchTorrentsBySizes(source, candidate)
				expect(result.matched).toBe(true)
				expect(result.decision).toBe(CrossSeedDecisionType.MATCH_SIZE_ONLY)
			})

			it('matches multi-file with different names but same sizes', () => {
				const source: FileInfo[] = [
					{ name: 'ep01.mkv', size: 500000 },
					{ name: 'ep02.mkv', size: 500000 },
					{ name: 'ep03.mkv', size: 500000 },
				]
				const candidate: FileInfo[] = [
					{ name: 's01e01.mkv', size: 500000 },
					{ name: 's01e02.mkv', size: 500000 },
					{ name: 's01e03.mkv', size: 500000 },
				]

				const result = matchTorrentsBySizes(source, candidate)
				expect(result.matched).toBe(true)
			})
		})

		describe('mismatches', () => {
			it('rejects when candidate file size not found in searchee', () => {
				const source: FileInfo[] = [
					{ name: 'file1.mkv', size: 1000 },
					{ name: 'file2.mkv', size: 1000 },
				]
				const candidate: FileInfo[] = [{ name: 'file1.mkv', size: 2000 }]

				const result = matchTorrentsBySizes(source, candidate)
				expect(result.matched).toBe(false)
				expect(result.decision).toBe(CrossSeedDecisionType.SIZE_MISMATCH)
			})

			it('allows searchee to have extra files (candidate subset of searchee)', () => {
				const source: FileInfo[] = [
					{ name: 'file1.mkv', size: 1000 },
					{ name: 'file2.mkv', size: 2000 },
					{ name: 'extra.nfo', size: 500 },
				]
				const candidate: FileInfo[] = [
					{ name: 'file1.mkv', size: 1000 },
					{ name: 'file2.mkv', size: 2000 },
				]

				const result = matchTorrentsBySizes(source, candidate)
				expect(result.matched).toBe(true)
				expect(result.decision).toBe(CrossSeedDecisionType.MATCH)
			})

			it('rejects when sizes do not match', () => {
				const source: FileInfo[] = [{ name: 'movie.mkv', size: 1000000 }]
				const candidate: FileInfo[] = [{ name: 'movie.mkv', size: 999999 }]

				const result = matchTorrentsBySizes(source, candidate)
				expect(result.matched).toBe(false)
				expect(result.decision).toBe(CrossSeedDecisionType.SIZE_MISMATCH)
			})

			it('rejects when multi-file sizes partially match', () => {
				const source: FileInfo[] = [
					{ name: 'ep01.mkv', size: 500000 },
					{ name: 'ep02.mkv', size: 500000 },
				]
				const candidate: FileInfo[] = [
					{ name: 'ep01.mkv', size: 500000 },
					{ name: 'ep02.mkv', size: 499999 },
				]

				const result = matchTorrentsBySizes(source, candidate)
				expect(result.matched).toBe(false)
				expect(result.decision).toBe(CrossSeedDecisionType.SIZE_MISMATCH)
			})
		})

		describe('edge cases', () => {
			it('rejects empty file arrays', () => {
				const source: FileInfo[] = []
				const candidate: FileInfo[] = []

				const result = matchTorrentsBySizes(source, candidate)
				expect(result.matched).toBe(false)
			})

			it('handles files with duplicate sizes correctly', () => {
				const source: FileInfo[] = [
					{ name: 'ep01.mkv', size: 500000 },
					{ name: 'ep02.mkv', size: 500000 },
					{ name: 'ep03.mkv', size: 500000 },
				]
				const candidate: FileInfo[] = [
					{ name: 'different1.mkv', size: 500000 },
					{ name: 'different2.mkv', size: 500000 },
					{ name: 'different3.mkv', size: 500000 },
				]

				const result = matchTorrentsBySizes(source, candidate)
				expect(result.matched).toBe(true)
			})

			it('handles very large file sizes', () => {
				const largeSize = 50 * 1024 * 1024 * 1024
				const source: FileInfo[] = [{ name: 'large.mkv', size: largeSize }]
				const candidate: FileInfo[] = [{ name: 'large.mkv', size: largeSize }]

				const result = matchTorrentsBySizes(source, candidate)
				expect(result.matched).toBe(true)
			})

			it('handles zero-size files', () => {
				const source: FileInfo[] = [
					{ name: 'empty.txt', size: 0 },
					{ name: 'video.mkv', size: 1000000 },
				]
				const candidate: FileInfo[] = [
					{ name: 'empty.txt', size: 0 },
					{ name: 'video.mkv', size: 1000000 },
				]

				const result = matchTorrentsBySizes(source, candidate)
				expect(result.matched).toBe(true)
			})
		})
	})

	describe('preFilterCandidate', () => {
		describe('passing filters', () => {
			it('passes when sizes are within threshold', () => {
				const result = preFilterCandidate('Movie 2024', 1000000, 'Movie 2024', 1000000)
				expect(result.pass).toBe(true)
			})

			it('passes when sizes are close (within 2%)', () => {
				const result = preFilterCandidate('Movie', 1000000, 'Movie', 1019000)
				expect(result.pass).toBe(true)
			})

			it('passes with different name formatting', () => {
				const result = preFilterCandidate('Movie.2024.1080p', 1000000, 'Movie 2024 1080p', 1000000)
				expect(result.pass).toBe(true)
			})

			it('passes when release group is missing on one side', () => {
				const result = preFilterCandidate('Movie.2024.1080p', 1000000, 'Movie.2024.1080p-GROUP', 1000000)
				expect(result.pass).toBe(true)
			})

			it('passes when source tag is missing on one side', () => {
				const result = preFilterCandidate('Movie.2024.1080p', 1000000, 'Movie.2024.1080p.WEB-DL.NF', 1000000)
				expect(result.pass).toBe(true)
			})
		})

		describe('failing filters', () => {
			it('fails when resolution differs', () => {
				const result = preFilterCandidate('Movie.2024.1080p', 1000000, 'Movie.2024.720p', 1000000)
				expect(result.pass).toBe(false)
				expect(result.reason?.toLowerCase()).toContain('resolution')
			})

			it('fails when release group differs', () => {
				const result = preFilterCandidate('Movie.2024.1080p-GROUPA', 1000000, 'Movie.2024.1080p-GROUPB', 1000000)
				expect(result.pass).toBe(false)
				expect(result.reason?.toLowerCase()).toContain('group')
			})

			it('fails when source tag differs', () => {
				const result = preFilterCandidate(
					'Movie.2024.1080p.AMZN.WEB-DL.x264-GROUP',
					1000000,
					'Movie.2024.1080p.NF.WEB-DL.x264-GROUP',
					1000000
				)
				expect(result.pass).toBe(false)
				expect(result.reason?.toLowerCase()).toContain('source')
			})

			it('fails when proper/repack mismatch', () => {
				const result = preFilterCandidate('Movie.2024.1080p.PROPER-GROUP', 1000000, 'Movie.2024.1080p-GROUP', 1000000)
				expect(result.pass).toBe(false)
				expect(result.reason?.toLowerCase()).toContain('proper')
			})

			it('fails when sizes differ too much', () => {
				const result = preFilterCandidate('Movie', 1000000, 'Movie', 2000000)
				expect(result.pass).toBe(false)
				expect(result.reason?.toLowerCase()).toContain('size')
			})

			it('fails when candidate is much smaller', () => {
				const result = preFilterCandidate('Movie', 1000000, 'Movie', 100000)
				expect(result.pass).toBe(false)
			})
		})

		describe('edge cases', () => {
			it('handles zero source size with zero candidate', () => {
				const result = preFilterCandidate('Movie', 0, 'Movie', 0)
				expect(result.pass).toBe(true)
			})

			it('handles zero source size with non-zero candidate without dividing by zero', () => {
				const result = preFilterCandidate('Movie', 0, 'Movie', 1000)
				expect(result.pass).toBe(false)
				expect(result.reason).toBeDefined()
				expect(result.reason).not.toContain('Infinity')
				expect(result.reason).toContain('100.0%')
			})

			it('handles missing candidate size', () => {
				const result = preFilterCandidate('Movie', 1000000, 'Movie', undefined as unknown as number)
				expect(result.pass).toBe(true)
			})
		})
	})
})
