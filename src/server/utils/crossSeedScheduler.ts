import { db, type CrossSeedConfig } from '../db'
import { log } from './logger'
import { runCrossSeedScan, type ScanResult } from './crossSeedWorker'

interface ScheduledInstance {
	instanceId: number
	userId: number
	timer: ReturnType<typeof setTimeout> | null
	running: boolean
	lastResult: ScanResult | null
}

const scheduledInstances = new Map<number, ScheduledInstance>()
const runningScans = new Set<number>()
const abortControllers = new Map<number, AbortController>()
let checkInterval: ReturnType<typeof setInterval> | null = null

const CHECK_INTERVAL_MS = 60 * 1000

export interface SchedulerStatus {
	instanceId: number
	instanceLabel: string
	enabled: boolean
	intervalHours: number
	dryRun: boolean
	lastRun: number | null
	nextRun: number | null
	running: boolean
	lastResult: ScanResult | null
}

function getInstanceUserId(instanceId: number): number | null {
	const instance = db.query<{ user_id: number }, [number]>('SELECT user_id FROM instances WHERE id = ?').get(instanceId)
	return instance?.user_id ?? null
}

function calculateNextRun(lastRun: number | null, intervalHours: number): number {
	const now = Math.floor(Date.now() / 1000)
	if (!lastRun) return now + 60
	const nextRun = lastRun + intervalHours * 3600
	return nextRun <= now ? now + 60 : nextRun
}

async function runScheduledScan(instanceId: number): Promise<void> {
	const scheduled = scheduledInstances.get(instanceId)
	if (!scheduled || runningScans.has(instanceId)) {
		return
	}

	const config = db
		.query<CrossSeedConfig, [number]>('SELECT * FROM cross_seed_config WHERE instance_id = ? AND enabled = 1')
		.get(instanceId)

	if (!config) {
		log.info(`[CrossSeed Scheduler] Instance ${instanceId} no longer enabled, removing from schedule`)
		scheduledInstances.delete(instanceId)
		return
	}

	runningScans.add(instanceId)
	scheduled.running = true
	const abortController = new AbortController()
	abortControllers.set(instanceId, abortController)
	log.info(`[CrossSeed Scheduler] Starting scheduled scan for instance ${instanceId}`)

	try {
		const result = await runCrossSeedScan({
			instanceId,
			userId: scheduled.userId,
			force: false,
			signal: abortController.signal,
		})
		scheduled.lastResult = result
	} catch (e) {
		if (e instanceof Error && e.name === 'AbortError') {
			log.info(`[CrossSeed Scheduler] Scan stopped for instance ${instanceId}`)
		} else {
			log.error(
				`[CrossSeed Scheduler] Scan failed for instance ${instanceId}: ${e instanceof Error ? e.message : 'Unknown'}`
			)
		}
	} finally {
		const nextRun = calculateNextRun(Math.floor(Date.now() / 1000), config.interval_hours)
		db.run('UPDATE cross_seed_config SET next_run = ? WHERE instance_id = ?', [nextRun, instanceId])
		scheduleInstance(instanceId, scheduled.userId, nextRun)
		runningScans.delete(instanceId)
		abortControllers.delete(instanceId)
		scheduled.running = false
	}
}

function scheduleInstance(instanceId: number, userId: number, nextRunTimestamp: number): void {
	const existing = scheduledInstances.get(instanceId)
	if (existing?.timer) {
		clearTimeout(existing.timer)
	}

	const now = Math.floor(Date.now() / 1000)
	const delayMs = Math.max(0, (nextRunTimestamp - now) * 1000)

	const scheduled: ScheduledInstance = {
		instanceId,
		userId,
		timer: setTimeout(() => runScheduledScan(instanceId), delayMs),
		running: existing?.running ?? false,
		lastResult: existing?.lastResult ?? null,
	}

	scheduledInstances.set(instanceId, scheduled)

	const delayHours = (delayMs / 1000 / 3600).toFixed(1)
	log.info(`[CrossSeed Scheduler] Scheduled instance ${instanceId} to run in ${delayHours}h`)
}

function loadEnabledConfigs(): void {
	const configs = db
		.query<CrossSeedConfig & { user_id: number }, []>(
			`
		SELECT c.*, i.user_id
		FROM cross_seed_config c
		JOIN instances i ON c.instance_id = i.id
		WHERE c.enabled = 1
	`
		)
		.all()

	for (const config of configs) {
		const nextRun = config.next_run ?? calculateNextRun(config.last_run, config.interval_hours)

		if (!config.next_run) {
			db.run('UPDATE cross_seed_config SET next_run = ? WHERE instance_id = ?', [nextRun, config.instance_id])
		}

		scheduleInstance(config.instance_id, config.user_id, nextRun)
	}

	log.info(`[CrossSeed Scheduler] Loaded ${configs.length} enabled instance(s)`)
}

function checkMissedScans(): void {
	const now = Math.floor(Date.now() / 1000)
	const configs = db
		.query<CrossSeedConfig & { user_id: number }, [number]>(
			`
		SELECT c.*, i.user_id
		FROM cross_seed_config c
		JOIN instances i ON c.instance_id = i.id
		WHERE c.enabled = 1 AND c.next_run IS NOT NULL AND c.next_run < ?
	`
		)
		.all(now)

	for (const config of configs) {
		if (!scheduledInstances.has(config.instance_id) || runningScans.has(config.instance_id)) continue

		log.info(`[CrossSeed Scheduler] Triggering missed scan for instance ${config.instance_id}`)
		runScheduledScan(config.instance_id)
	}
}

export function startScheduler(): void {
	log.info('[CrossSeed Scheduler] Starting scheduler...')
	loadEnabledConfigs()

	checkInterval = setInterval(checkMissedScans, CHECK_INTERVAL_MS)
}

export function stopScheduler(): void {
	log.info('[CrossSeed Scheduler] Stopping scheduler...')

	if (checkInterval) {
		clearInterval(checkInterval)
		checkInterval = null
	}

	for (const [, scheduled] of scheduledInstances) {
		if (scheduled.timer) {
			clearTimeout(scheduled.timer)
		}
	}
	scheduledInstances.clear()
	runningScans.clear()
}

export function updateInstanceSchedule(instanceId: number, enabled: boolean): void {
	const scheduled = scheduledInstances.get(instanceId)

	if (!enabled) {
		if (scheduled?.timer) {
			clearTimeout(scheduled.timer)
		}
		scheduledInstances.delete(instanceId)
		log.info(`[CrossSeed Scheduler] Disabled schedule for instance ${instanceId}`)
		return
	}

	const config = db
		.query<CrossSeedConfig, [number]>('SELECT * FROM cross_seed_config WHERE instance_id = ?')
		.get(instanceId)

	if (!config) return

	const userId = getInstanceUserId(instanceId)
	if (!userId) return

	const nextRun = calculateNextRun(config.last_run, config.interval_hours)
	db.run('UPDATE cross_seed_config SET next_run = ? WHERE instance_id = ?', [nextRun, instanceId])
	scheduleInstance(instanceId, userId, nextRun)
}

export async function triggerManualScan(
	instanceId: number,
	userId: number,
	force: boolean = false
): Promise<ScanResult> {
	if (runningScans.has(instanceId)) {
		throw new Error('Scan already in progress')
	}

	runningScans.add(instanceId)
	const abortController = new AbortController()
	abortControllers.set(instanceId, abortController)
	const scheduled = scheduledInstances.get(instanceId)
	if (scheduled) {
		scheduled.running = true
	}

	try {
		const result = await runCrossSeedScan({ instanceId, userId, force, signal: abortController.signal })

		if (scheduled) {
			scheduled.lastResult = result
		}

		const config = db
			.query<CrossSeedConfig, [number]>('SELECT * FROM cross_seed_config WHERE instance_id = ? AND enabled = 1')
			.get(instanceId)

		if (config) {
			const nextRun = calculateNextRun(Math.floor(Date.now() / 1000), config.interval_hours)
			db.run('UPDATE cross_seed_config SET next_run = ? WHERE instance_id = ?', [nextRun, instanceId])
			scheduleInstance(instanceId, userId, nextRun)
		}

		return result
	} catch (e) {
		if (e instanceof Error && e.name === 'AbortError') {
			log.info(`[CrossSeed] Scan stopped for instance ${instanceId}`)
			throw new Error('Scan stopped')
		}
		throw e
	} finally {
		runningScans.delete(instanceId)
		abortControllers.delete(instanceId)
		if (scheduled) {
			scheduled.running = false
		}
	}
}

function configToStatus(config: CrossSeedConfig & { label: string }): SchedulerStatus {
	const scheduled = scheduledInstances.get(config.instance_id)
	return {
		instanceId: config.instance_id,
		instanceLabel: config.label,
		enabled: !!config.enabled,
		intervalHours: config.interval_hours,
		dryRun: !!config.dry_run,
		lastRun: config.last_run,
		nextRun: config.next_run,
		running: runningScans.has(config.instance_id),
		lastResult: scheduled?.lastResult ?? null,
	}
}

export function getSchedulerStatus(): SchedulerStatus[] {
	return db
		.query<
			CrossSeedConfig & { label: string },
			[]
		>(`SELECT c.*, i.label FROM cross_seed_config c JOIN instances i ON c.instance_id = i.id`)
		.all()
		.map(configToStatus)
}

export function getInstanceStatus(instanceId: number): SchedulerStatus | null {
	const config = db
		.query<
			CrossSeedConfig & { label: string },
			[number]
		>(`SELECT c.*, i.label FROM cross_seed_config c JOIN instances i ON c.instance_id = i.id WHERE c.instance_id = ?`)
		.get(instanceId)
	return config ? configToStatus(config) : null
}

export function isInstanceRunning(instanceId: number): boolean {
	return runningScans.has(instanceId)
}

export function stopScan(instanceId: number): boolean {
	const controller = abortControllers.get(instanceId)
	if (controller) {
		controller.abort()
		log.info(`[CrossSeed] Stop requested for instance ${instanceId}`)
		return true
	}
	return false
}
