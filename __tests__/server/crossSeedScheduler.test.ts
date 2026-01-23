import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'

vi.mock('../../src/server/db', () => ({
	db: {
		query: vi.fn(() => ({
			get: vi.fn(),
			all: vi.fn(() => []),
		})),
		run: vi.fn(),
	},
}))

vi.mock('../../src/server/utils/crossSeedWorker', () => ({
	runCrossSeedScan: vi.fn(),
}))

vi.mock('../../src/server/utils/logger', () => ({
	log: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}))

import {
	isInstanceRunning,
	triggerManualScan,
	stopScheduler,
} from '../../src/server/utils/crossSeedScheduler'
import { runCrossSeedScan } from '../../src/server/utils/crossSeedWorker'

const mockRunCrossSeedScan = runCrossSeedScan as Mock

describe('crossSeedScheduler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		stopScheduler()
	})

	afterEach(() => {
		stopScheduler()
	})

	describe('isInstanceRunning', () => {
		it('returns false when no scan is running', () => {
			expect(isInstanceRunning(1)).toBe(false)
		})

		it('returns true when a scan is in progress', async () => {
			let resolvePromise: () => void
			const scanPromise = new Promise<void>((resolve) => {
				resolvePromise = resolve
			})

			mockRunCrossSeedScan.mockImplementation(() => scanPromise)

			const triggerPromise = triggerManualScan(1, 1, false).catch(() => {})

			await new Promise((r) => setTimeout(r, 10))
			expect(isInstanceRunning(1)).toBe(true)

			resolvePromise!()
			await triggerPromise
			expect(isInstanceRunning(1)).toBe(false)
		})
	})

	describe('triggerManualScan', () => {
		it('prevents concurrent scans on the same instance', async () => {
			let resolveFirst: (value: unknown) => void
			const firstScanPromise = new Promise((resolve) => {
				resolveFirst = resolve
			})

			mockRunCrossSeedScan.mockImplementationOnce(() => firstScanPromise)

			const firstTrigger = triggerManualScan(1, 1, false)

			await new Promise((r) => setTimeout(r, 10))

			await expect(triggerManualScan(1, 1, false)).rejects.toThrow('Scan already in progress')

			resolveFirst!({ instanceId: 1 })
			await firstTrigger
		})

		it('allows concurrent scans on different instances', async () => {
			let resolveFirst: (value: unknown) => void
			let resolveSecond: (value: unknown) => void

			mockRunCrossSeedScan
				.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
				.mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))

			const firstTrigger = triggerManualScan(1, 1, false)
			await new Promise((r) => setTimeout(r, 10))

			const secondTrigger = triggerManualScan(2, 1, false)
			await new Promise((r) => setTimeout(r, 10))

			expect(isInstanceRunning(1)).toBe(true)
			expect(isInstanceRunning(2)).toBe(true)

			resolveFirst!({ instanceId: 1 })
			resolveSecond!({ instanceId: 2 })

			await firstTrigger
			await secondTrigger
		})

		it('clears running state on error', async () => {
			mockRunCrossSeedScan.mockRejectedValueOnce(new Error('Scan failed'))

			await expect(triggerManualScan(1, 1, false)).rejects.toThrow('Scan failed')
			expect(isInstanceRunning(1)).toBe(false)
		})

		it('clears running state on success', async () => {
			mockRunCrossSeedScan.mockResolvedValueOnce({
				instanceId: 1,
				torrentsTotal: 10,
				torrentsScanned: 5,
				torrentsSkipped: 5,
				matchesFound: 1,
				torrentsAdded: 1,
				errors: [],
				dryRun: false,
				startedAt: Date.now(),
				completedAt: Date.now(),
			})

			await triggerManualScan(1, 1, false)
			expect(isInstanceRunning(1)).toBe(false)
		})
	})
})
