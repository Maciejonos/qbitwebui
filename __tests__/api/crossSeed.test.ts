import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
	getCrossSeedConfig,
	updateCrossSeedConfig,
	triggerScan,
	getSchedulerStatus,
	getInstanceStatus,
	clearCache,
	getCacheStats,
	getSearchHistory,
	getDecisions,
	getIndexers,
	stopScan,
	getLogs,
} from '../../src/api/crossSeed'

describe('crossSeed API', () => {
	const mockFetch = vi.fn()
	const originalFetch = global.fetch

	beforeEach(() => {
		global.fetch = mockFetch
		mockFetch.mockReset()
	})

	afterEach(() => {
		global.fetch = originalFetch
	})

	describe('getCrossSeedConfig', () => {
		it('fetches config for instance', async () => {
			const mockConfig = {
				instance_id: 1,
				enabled: true,
				interval_hours: 24,
				dry_run: false,
				category_suffix: '_cross-seed',
				tag: 'cross-seed',
				skip_recheck: false,
				integration_id: 1,
				indexer_ids: [1, 2],
				last_run: null,
				next_run: null,
			}

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockConfig),
			})

			const result = await getCrossSeedConfig(1)

			expect(mockFetch).toHaveBeenCalledWith('/api/cross-seed/config/1', { credentials: 'include' })
			expect(result).toEqual(mockConfig)
		})

		it('throws on error response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
			})

			await expect(getCrossSeedConfig(1)).rejects.toThrow('Failed to fetch cross-seed config')
		})
	})

	describe('updateCrossSeedConfig', () => {
		it('updates config successfully', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ success: true }),
			})

			await updateCrossSeedConfig(1, { enabled: true, interval_hours: 12, indexer_ids: [1, 2] })

			expect(mockFetch).toHaveBeenCalledWith('/api/cross-seed/config/1', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ enabled: true, interval_hours: 12, indexer_ids: [1, 2] }),
			})
		})

		it('throws on error with message', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				json: () => Promise.resolve({ error: 'Invalid config' }),
			})

			await expect(updateCrossSeedConfig(1, {})).rejects.toThrow('Invalid config')
		})
	})

	describe('triggerScan', () => {
		it('triggers scan without force', async () => {
			const mockResult = {
				instanceId: 1,
				torrentsTotal: 150,
				torrentsScanned: 100,
				torrentsSkipped: 50,
				matchesFound: 5,
				torrentsAdded: 3,
				errors: [],
				dryRun: false,
				startedAt: 1704067200000,
				completedAt: 1704067260000,
			}

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockResult),
			})

			const result = await triggerScan(1)

			expect(mockFetch).toHaveBeenCalledWith('/api/cross-seed/scan/1', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ force: false }),
			})
			expect(result).toEqual(mockResult)
		})

		it('triggers force scan', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({}),
			})

			await triggerScan(1, true)

			expect(mockFetch).toHaveBeenCalledWith('/api/cross-seed/scan/1', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ force: true }),
			})
		})
	})

	describe('getSchedulerStatus', () => {
		it('fetches all scheduler statuses', async () => {
			const mockStatuses = [
				{ instanceId: 1, enabled: true, running: false },
				{ instanceId: 2, enabled: false, running: false },
			]

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockStatuses),
			})

			const result = await getSchedulerStatus()

			expect(mockFetch).toHaveBeenCalledWith('/api/cross-seed/status', { credentials: 'include' })
			expect(result).toEqual(mockStatuses)
		})
	})

	describe('getIndexers', () => {
		it('fetches indexers for instance', async () => {
			const mockIndexers = [{ id: 1, name: 'Indexer A', protocol: 'torrent', supportsSearch: true, categories: [2000] }]

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockIndexers),
			})

			const result = await getIndexers(1)

			expect(mockFetch).toHaveBeenCalledWith('/api/cross-seed/indexers/1', { credentials: 'include' })
			expect(result).toEqual(mockIndexers)
		})

		it('throws on error response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				json: () => Promise.resolve({ error: 'No Prowlarr integration configured' }),
			})

			await expect(getIndexers(1)).rejects.toThrow('No Prowlarr integration configured')
		})
	})

	describe('getInstanceStatus', () => {
		it('fetches status for specific instance', async () => {
			const mockStatus = {
				instanceId: 1,
				enabled: true,
				running: true,
				lastRun: 1704067200,
				nextRun: 1704153600,
			}

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockStatus),
			})

			const result = await getInstanceStatus(1)

			expect(mockFetch).toHaveBeenCalledWith('/api/cross-seed/status/1', { credentials: 'include' })
			expect(result).toEqual(mockStatus)
		})
	})

	describe('clearCache', () => {
		it('clears cache for instance', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ cacheCleared: 10, outputCleared: 5 }),
			})

			const result = await clearCache(1)

			expect(mockFetch).toHaveBeenCalledWith('/api/cross-seed/cache/1/clear', {
				method: 'POST',
				credentials: 'include',
			})
			expect(result.cacheCleared).toBe(10)
			expect(result.outputCleared).toBe(5)
		})
	})

	describe('getCacheStats', () => {
		it('fetches cache statistics', async () => {
			const mockStats = {
				cache: { count: 50, totalSize: 1024000 },
				output: { count: 10, files: ['file1.torrent', 'file2.torrent'] },
			}

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockStats),
			})

			const result = await getCacheStats(1)

			expect(mockFetch).toHaveBeenCalledWith('/api/cross-seed/cache/1/stats', { credentials: 'include' })
			expect(result).toEqual(mockStats)
		})
	})

	describe('getSearchHistory', () => {
		it('fetches search history with pagination', async () => {
			const mockHistory = {
				searchees: [
					{ id: 1, torrent_name: 'Movie 1', decision_count: 5 },
					{ id: 2, torrent_name: 'Movie 2', decision_count: 3 },
				],
				total: 100,
			}

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockHistory),
			})

			const result = await getSearchHistory(1, 50, 10)

			expect(mockFetch).toHaveBeenCalledWith('/api/cross-seed/history/1?limit=50&offset=10', {
				credentials: 'include',
			})
			expect(result.total).toBe(100)
		})

		it('uses default pagination', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ searchees: [], total: 0 }),
			})

			await getSearchHistory(1)

			expect(mockFetch).toHaveBeenCalledWith('/api/cross-seed/history/1?limit=100&offset=0', {
				credentials: 'include',
			})
		})
	})

	describe('getDecisions', () => {
		it('fetches decisions for searchee', async () => {
			const mockDecisions = [
				{ id: 1, decision: 'MATCH', candidate_name: 'Match 1' },
				{ id: 2, decision: 'SIZE_MISMATCH', candidate_name: 'No Match' },
			]

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockDecisions),
			})

			const result = await getDecisions(1, 5)

			expect(mockFetch).toHaveBeenCalledWith('/api/cross-seed/history/1/5/decisions', {
				credentials: 'include',
			})
			expect(result).toEqual(mockDecisions)
		})
	})

	describe('stopScan', () => {
		it('stops scan for instance', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ stopped: true }),
			})

			const result = await stopScan(1)

			expect(mockFetch).toHaveBeenCalledWith('/api/cross-seed/stop/1', {
				method: 'POST',
				credentials: 'include',
			})
			expect(result.stopped).toBe(true)
		})

		it('throws on error response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				json: () => Promise.resolve({ error: 'No scan running' }),
			})

			await expect(stopScan(1)).rejects.toThrow('No scan running')
		})
	})

	describe('getLogs', () => {
		it('fetches logs with limit', async () => {
			const mockLogs = [{ timestamp: '2024-01-01T00:00:00.000Z', level: 'INFO', message: 'Test' }]

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockLogs),
			})

			const result = await getLogs(200)

			expect(mockFetch).toHaveBeenCalledWith('/api/cross-seed/logs?limit=200', { credentials: 'include' })
			expect(result).toEqual(mockLogs)
		})
	})
})
