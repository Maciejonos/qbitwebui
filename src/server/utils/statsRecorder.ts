import { db, type Instance, type TransferStats } from '../db'
import { log } from './logger'
import { fetchInstanceTransferStats } from './qbt'

const RECORD_INTERVAL_MS = 5 * 60 * 1000
const PRUNE_AFTER_DAYS = 365

let recordInterval: ReturnType<typeof setInterval> | null = null

async function recordStats(): Promise<void> {
	const instances = db.query<Instance, []>('SELECT * FROM instances').all()
	if (instances.length === 0) return

	const now = Math.floor(Date.now() / 1000)

	for (const instance of instances) {
		const stats = await fetchInstanceTransferStats(instance)
		if (!stats) continue

		db.run('INSERT INTO transfer_stats (instance_id, timestamp, uploaded, downloaded) VALUES (?, ?, ?, ?)', [
			instance.id,
			now,
			stats.uploaded,
			stats.downloaded,
		])
	}
}

function pruneOldStats(): void {
	const cutoff = Math.floor(Date.now() / 1000) - PRUNE_AFTER_DAYS * 24 * 60 * 60
	const result = db.run('DELETE FROM transfer_stats WHERE timestamp < ?', [cutoff])
	if (result.changes > 0) {
		log.info(`[Stats Recorder] Pruned ${result.changes} old records`)
	}
}

export function startStatsRecorder(): void {
	log.info('[Stats Recorder] Starting stats recorder (5 min interval)')
	recordStats()
	pruneOldStats()
	recordInterval = setInterval(() => {
		recordStats()
		pruneOldStats()
	}, RECORD_INTERVAL_MS)
}

export function stopStatsRecorder(): void {
	if (recordInterval) {
		clearInterval(recordInterval)
		recordInterval = null
	}
	log.info('[Stats Recorder] Stopped')
}

export interface PeriodStats {
	uploaded: number
	downloaded: number
	hasData: boolean
	dataPoints: number
}

export function getStatsForPeriod(instanceId: number, periodSeconds: number): PeriodStats {
	const now = Math.floor(Date.now() / 1000)
	const periodStart = now - periodSeconds

	const latest = db
		.query<
			TransferStats,
			[number]
		>('SELECT * FROM transfer_stats WHERE instance_id = ? ORDER BY timestamp DESC LIMIT 1')
		.get(instanceId)

	if (!latest) {
		return { uploaded: 0, downloaded: 0, hasData: false, dataPoints: 0 }
	}

	const absoluteOldest = db
		.query<TransferStats, [number]>('SELECT * FROM transfer_stats WHERE instance_id = ? ORDER BY timestamp ASC LIMIT 1')
		.get(instanceId)

	if (!absoluteOldest) {
		return { uploaded: 0, downloaded: 0, hasData: false, dataPoints: 0 }
	}

	const dataDuration = now - absoluteOldest.timestamp
	if (periodSeconds > dataDuration) {
		return { uploaded: 0, downloaded: 0, hasData: false, dataPoints: 0 }
	}

	const oldest = db
		.query<
			TransferStats,
			[number, number]
		>('SELECT * FROM transfer_stats WHERE instance_id = ? AND timestamp >= ? ORDER BY timestamp ASC LIMIT 1')
		.get(instanceId, periodStart)

	const dataPoints = db
		.query<
			{ count: number },
			[number, number]
		>('SELECT COUNT(*) as count FROM transfer_stats WHERE instance_id = ? AND timestamp >= ?')
		.get(instanceId, periodStart)

	if (!oldest) {
		return { uploaded: 0, downloaded: 0, hasData: false, dataPoints: 0 }
	}

	return {
		uploaded: Math.max(0, latest.uploaded - oldest.uploaded),
		downloaded: Math.max(0, latest.downloaded - oldest.downloaded),
		hasData: true,
		dataPoints: dataPoints?.count ?? 0,
	}
}
