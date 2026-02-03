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
	status: number
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

			const realTrackers = trackers.filter((tr) => tr.url.startsWith('http'))
			const hasWorkingTracker = realTrackers.some((tr) => tr.status === 2)
			if (hasWorkingTracker) continue

			const unregistered = realTrackers.find(
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

export default tools
