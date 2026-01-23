import { Hono } from 'hono'
import { db, type Instance } from '../db'
import { loginToQbt } from '../utils/qbt'
import { authMiddleware } from '../middleware/auth'
import { fetchWithTls } from '../utils/fetch'
import { log } from '../utils/logger'

const tools = new Hono()

tools.use('*', authMiddleware)

interface Torrent {
	hash: string
	name: string
	size: number
	state: string
}

interface Tracker {
	url: string
	msg: string
}

interface OrphanResult {
	instanceId: number
	instanceLabel: string
	hash: string
	name: string
	size: number
	reason: 'missingFiles' | 'unregistered'
	trackerMessage?: string
}

async function qbtRequest<T>(instance: Instance, cookie: string | null, endpoint: string): Promise<T | null> {
	try {
		const res = await fetchWithTls(`${instance.url}/api/v2${endpoint}`, {
			headers: cookie ? { Cookie: cookie } : {},
		})
		if (!res.ok) return null
		return res.json() as Promise<T>
	} catch {
		return null
	}
}

tools.post('/orphans/scan', async (c) => {
	const user = c.get('user')
	const instances = db.query<Instance, [number]>('SELECT * FROM instances WHERE user_id = ?').all(user.id)

	log.info(`[Orphan Scan] Starting scan for user ${user.username} across ${instances.length} instance(s)`)

	const orphans: OrphanResult[] = []
	let totalTorrents = 0
	let totalChecked = 0

	for (const instance of instances) {
		log.info(`[Orphan Scan] Scanning instance: ${instance.label}`)

		const loginResult = await loginToQbt(instance)
		if (!loginResult.success) {
			log.warn(`[Orphan Scan] Failed to connect to ${instance.label}: ${loginResult.error}`)
			continue
		}

		const torrents = await qbtRequest<Torrent[]>(instance, loginResult.cookie, '/torrents/info')
		if (!torrents) {
			log.warn(`[Orphan Scan] Failed to fetch torrents from ${instance.label}`)
			continue
		}

		totalTorrents += torrents.length
		log.info(`[Orphan Scan] ${instance.label}: Found ${torrents.length} torrents`)

		const missingFiles = torrents.filter((t) => t.state === 'missingFiles')
		for (const t of missingFiles) {
			log.info(`[Orphan Scan] ${instance.label}: Missing files - ${t.name}`)
			orphans.push({
				instanceId: instance.id,
				instanceLabel: instance.label,
				hash: t.hash,
				name: t.name,
				size: t.size,
				reason: 'missingFiles',
			})
		}

		const toCheck = torrents.filter((t) => t.state !== 'missingFiles')
		for (const t of toCheck) {
			totalChecked++
			const trackers = await qbtRequest<Tracker[]>(instance, loginResult.cookie, `/torrents/trackers?hash=${t.hash}`)
			if (!trackers) continue

			const unregistered = trackers.find(
				(tr) => tr.msg && /unregistered|not registered|torrent not found/i.test(tr.msg)
			)
			if (unregistered) {
				log.info(`[Orphan Scan] ${instance.label}: Unregistered - ${t.name} (${unregistered.msg})`)
				orphans.push({
					instanceId: instance.id,
					instanceLabel: instance.label,
					hash: t.hash,
					name: t.name,
					size: t.size,
					reason: 'unregistered',
					trackerMessage: unregistered.msg,
				})
			}
		}
	}

	log.info(`[Orphan Scan] Scan complete: ${orphans.length} orphan(s) found across ${totalTorrents} torrents`)

	return c.json({ orphans, totalTorrents, totalChecked })
})

tools.post('/speedtest', async (c) => {
	const user = c.get('user')
	const instances = db.query<Instance, [number]>('SELECT * FROM instances WHERE user_id = ?').all(user.id)

	// Active states that indicate a torrent is using bandwidth
	const activeStates = new Set([
		'downloading',
		'uploading',
		'stalledDL',
		'stalledUP',
		'forcedDL',
		'forcedUP',
		'queuedDL',
		'queuedUP',
		'checkingDL',
		'checkingUP',
		'moving',
	])

	// Store active torrents per instance so we can resume them later
	const activeTorrentsMap: Map<Instance, { cookie: string; hashes: string[] }> = new Map()

	log.info('[Speedtest] Pausing active torrents across all instances...')

	// Pause active torrents on all instances
	for (const instance of instances) {
		const loginResult = await loginToQbt(instance)
		if (!loginResult.success || !loginResult.cookie) continue

		const torrents = await qbtRequest<Torrent[]>(instance, loginResult.cookie, '/torrents/info')
		if (!torrents) continue

		const activeHashes = torrents.filter((t) => activeStates.has(t.state)).map((t) => t.hash)

		if (activeHashes.length > 0) {
			activeTorrentsMap.set(instance, { cookie: loginResult.cookie, hashes: activeHashes })

			// Stop active torrents (v5+ uses stop instead of pause)
			await fetchWithTls(`${instance.url}/api/v2/torrents/stop`, {
				method: 'POST',
				headers: {
					Cookie: loginResult.cookie,
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: `hashes=${activeHashes.join('|')}`,
			})

			log.info(`[Speedtest] Sent stop command for ${activeHashes.length} torrents on ${instance.label}`)
		}
	}

	// Poll to verify all torrents are actually paused (max 10 seconds)
	const pausedStates = new Set(['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP'])
	const maxWaitMs = 10000
	const pollIntervalMs = 500
	let waitedMs = 0

	while (waitedMs < maxWaitMs) {
		await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
		waitedMs += pollIntervalMs

		let allPaused = true

		for (const [instance, { cookie, hashes }] of activeTorrentsMap) {
			const torrents = await qbtRequest<Torrent[]>(instance, cookie, '/torrents/info')
			if (!torrents) continue

			const stillActive = torrents.filter(
				(t) => hashes.includes(t.hash) && !pausedStates.has(t.state)
			)

			if (stillActive.length > 0) {
				allPaused = false
				break
			}
		}

		if (allPaused) {
			log.info(`[Speedtest] All torrents confirmed paused after ${waitedMs}ms`)
			break
		}
	}

	if (waitedMs >= maxWaitMs) {
		log.warn('[Speedtest] Timeout waiting for torrents to pause, proceeding anyway')
	}

	log.info('[Speedtest] Starting speedtest...')

	let speedtestResult
	let speedtestError

	try {
		const proc = Bun.spawnSync(['speedtest', '--accept-license', '--accept-gdpr', '-f', 'json'], {
			stdout: 'pipe',
			stderr: 'pipe',
		})

		const output = proc.stdout.toString()
		const stderr = proc.stderr.toString()

		if (proc.exitCode !== 0) {
			speedtestError = { error: 'Speedtest failed', details: stderr }
		} else {
			const result = JSON.parse(output)
			const downloadBps = result.download?.bandwidth * 8 || 0
			const uploadBps = result.upload?.bandwidth * 8 || 0

			log.info(
				`[Speedtest] Complete: ${(downloadBps / 1_000_000).toFixed(2)} Mbps down, ${(uploadBps / 1_000_000).toFixed(2)} Mbps up`
			)

			speedtestResult = {
				download: downloadBps,
				upload: uploadBps,
				ping: result.ping?.latency || 0,
				server: {
					name: result.server?.name,
					country: result.server?.country,
					sponsor: result.server?.name,
				},
				timestamp: result.timestamp,
			}
		}
	} catch (error) {
		log.error(`[Speedtest] Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
		speedtestError = { error: 'Speedtest failed to run' }
	}

	// Resume torrents that were active before (always do this, even if speedtest failed)
	log.info('[Speedtest] Resuming previously active torrents...')

	for (const [instance, { cookie, hashes }] of activeTorrentsMap) {
		await fetchWithTls(`${instance.url}/api/v2/torrents/start`, {
			method: 'POST',
			headers: {
				Cookie: cookie,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: `hashes=${hashes.join('|')}`,
		})

		log.info(`[Speedtest] Started ${hashes.length} torrents on ${instance.label}`)
	}

	if (speedtestError) {
		return c.json(speedtestError, 500)
	}

	return c.json(speedtestResult)
})

export default tools
