import { Hono } from 'hono'
import { db, type Instance } from '../db'
import { encrypt } from '../utils/crypto'
import { validateUrl } from '../utils/url'
import { loginToQbt, testQbtConnection, testStoredQbtInstance } from '../utils/qbt'
import { authMiddleware } from '../middleware/auth'
import { clearQbtSession } from './proxy'
import { fetchWithTls } from '../utils/fetch'

const instances = new Hono()

instances.use('*', authMiddleware)

interface InstanceResponse {
	id: number
	label: string
	url: string
	qbt_username: string | null
	skip_auth: boolean
	agent_enabled: boolean
	created_at: number
}

function toResponse(i: Instance): InstanceResponse {
	return {
		id: i.id,
		label: i.label,
		url: i.url,
		qbt_username: i.qbt_username,
		skip_auth: !!i.skip_auth,
		agent_enabled: !!i.agent_enabled,
		created_at: i.created_at,
	}
}

instances.get('/', (c) => {
	const user = c.get('user')
	const list = db
		.query<Instance, [number]>('SELECT * FROM instances WHERE user_id = ? ORDER BY created_at')
		.all(user.id)
	return c.json(list.map(toResponse))
})

interface TorrentInfo {
	state: string
	downloaded: number
	uploaded: number
}

interface TransferInfo {
	dl_info_speed: number
	up_info_speed: number
}

interface SyncMaindata {
	server_state: {
		alltime_dl: number
		alltime_ul: number
		free_space_on_disk: number
	}
}

interface InstanceStats {
	id: number
	label: string
	online: boolean
	total: number
	downloading: number
	seeding: number
	paused: number
	error: number
	dlSpeed: number
	upSpeed: number
	allTimeDownload: number
	allTimeUpload: number
	freeSpaceOnDisk: number
}

async function fetchInstanceStats(instance: Instance): Promise<InstanceStats> {
	const base: InstanceStats = {
		id: instance.id,
		label: instance.label,
		online: false,
		total: 0,
		downloading: 0,
		seeding: 0,
		paused: 0,
		error: 0,
		dlSpeed: 0,
		upSpeed: 0,
		allTimeDownload: 0,
		allTimeUpload: 0,
		freeSpaceOnDisk: 0,
	}

	try {
		const loginResult = await loginToQbt(instance)
		if (!loginResult.success) {
			return base
		}

		const headers: Record<string, string> = {}
		if (loginResult.cookie) headers.Cookie = loginResult.cookie
		const [torrentsRes, transferRes, syncRes] = await Promise.all([
			fetchWithTls(`${instance.url}/api/v2/torrents/info`, { headers }),
			fetchWithTls(`${instance.url}/api/v2/transfer/info`, { headers }),
			fetchWithTls(`${instance.url}/api/v2/sync/maindata?rid=0`, { headers }),
		])

		if (!torrentsRes.ok || !transferRes.ok || !syncRes.ok) {
			return base
		}

		const torrents = (await torrentsRes.json()) as TorrentInfo[]
		const transfer = (await transferRes.json()) as TransferInfo
		const sync = (await syncRes.json()) as SyncMaindata

		base.online = true
		base.total = torrents.length
		base.dlSpeed = transfer.dl_info_speed
		base.upSpeed = transfer.up_info_speed
		base.allTimeDownload = sync.server_state.alltime_dl
		base.allTimeUpload = sync.server_state.alltime_ul
		base.freeSpaceOnDisk = sync.server_state.free_space_on_disk

		for (const t of torrents) {
			if (t.state === 'pausedUP' || t.state === 'pausedDL' || t.state === 'stoppedUP' || t.state === 'stoppedDL') {
				base.paused++
			} else if (t.state === 'error' || t.state === 'missingFiles') {
				base.error++
			} else if (t.state.includes('UP') || t.state === 'uploading') {
				base.seeding++
			} else if (t.state.includes('DL') || t.state === 'downloading' || t.state === 'metaDL') {
				base.downloading++
			}
		}

		return base
	} catch {
		return base
	}
}

instances.get('/stats', async (c) => {
	const user = c.get('user')
	const list = db
		.query<Instance, [number]>('SELECT * FROM instances WHERE user_id = ? ORDER BY created_at')
		.all(user.id)

	const stats = await Promise.all(list.map(fetchInstanceStats))
	return c.json(stats)
})

instances.post('/', async (c) => {
	const user = c.get('user')
	const body = await c.req.json<{
		label: string
		url: string
		qbt_username?: string
		qbt_password?: string
		skip_auth?: boolean
		agent_enabled?: boolean
	}>()

	if (!body.label || !body.url) {
		return c.json({ error: 'Missing required fields' }, 400)
	}

	if (!body.skip_auth && (!body.qbt_username || !body.qbt_password)) {
		return c.json({ error: 'Credentials required when skip_auth is disabled' }, 400)
	}

	try {
		validateUrl(body.url)
	} catch (e) {
		return c.json({ error: e instanceof Error ? e.message : 'Invalid URL' }, 400)
	}

	const encrypted = body.qbt_password ? encrypt(body.qbt_password) : null

	try {
		const result = db.run(
			`INSERT INTO instances (user_id, label, url, qbt_username, qbt_password_encrypted, skip_auth, agent_enabled)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				user.id,
				body.label,
				body.url,
				body.qbt_username || null,
				encrypted,
				body.skip_auth ? 1 : 0,
				body.agent_enabled ? 1 : 0,
			]
		)

		const instance = db
			.query<Instance, [number]>('SELECT * FROM instances WHERE id = ?')
			.get(Number(result.lastInsertRowid))

		if (!instance) {
			return c.json({ error: 'Failed to create instance' }, 500)
		}

		return c.json(toResponse(instance), 201)
	} catch (e: unknown) {
		if (e instanceof Error && e.message.includes('UNIQUE')) {
			return c.json({ error: 'Instance with this label already exists' }, 400)
		}
		throw e
	}
})

instances.put('/:id', async (c) => {
	const user = c.get('user')
	const id = Number(c.req.param('id'))
	const body = await c.req.json<{
		label?: string
		url?: string
		qbt_username?: string
		qbt_password?: string
		skip_auth?: boolean
		agent_enabled?: boolean
	}>()

	const existing = db
		.query<Instance, [number, number]>('SELECT * FROM instances WHERE id = ? AND user_id = ?')
		.get(id, user.id)

	if (!existing) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	const updates: string[] = []
	const values: (string | number)[] = []

	if (body.label !== undefined) {
		updates.push('label = ?')
		values.push(body.label)
	}
	if (body.url !== undefined) {
		try {
			validateUrl(body.url)
		} catch (e) {
			return c.json({ error: e instanceof Error ? e.message : 'Invalid URL' }, 400)
		}
		updates.push('url = ?')
		values.push(body.url)
	}
	if (body.qbt_username !== undefined) {
		updates.push('qbt_username = ?')
		values.push(body.qbt_username)
	}
	if (body.qbt_password !== undefined) {
		updates.push('qbt_password_encrypted = ?')
		values.push(encrypt(body.qbt_password))
	}
	if (body.skip_auth !== undefined) {
		updates.push('skip_auth = ?')
		values.push(body.skip_auth ? 1 : 0)
	}
	if (body.agent_enabled !== undefined) {
		updates.push('agent_enabled = ?')
		values.push(body.agent_enabled ? 1 : 0)
	}

	if (updates.length > 0) {
		values.push(id)
		db.run(`UPDATE instances SET ${updates.join(', ')} WHERE id = ?`, values)
	}

	const updated = db.query<Instance, [number]>('SELECT * FROM instances WHERE id = ?').get(id)

	if (!updated) {
		return c.json({ error: 'Failed to update instance' }, 500)
	}

	return c.json(toResponse(updated))
})

instances.post('/:id/test', async (c) => {
	const user = c.get('user')
	const id = Number(c.req.param('id'))

	const instance = db
		.query<Instance, [number, number]>('SELECT * FROM instances WHERE id = ? AND user_id = ?')
		.get(id, user.id)

	if (!instance) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	const result = await testStoredQbtInstance(instance)
	if (!result.success) {
		const status = result.error === 'Invalid credentials' ? 401 : 400
		return c.json({ error: result.error }, status)
	}

	return c.json({ success: true, version: result.version })
})

instances.post('/test', async (c) => {
	const body = await c.req.json<{
		url: string
		username?: string
		password?: string
		skip_auth?: boolean
	}>()

	if (!body.url) {
		return c.json({ error: 'URL is required' }, 400)
	}

	if (!body.skip_auth && (!body.username || !body.password)) {
		return c.json({ error: 'Credentials required when skip_auth is disabled' }, 400)
	}

	try {
		validateUrl(body.url)
	} catch (e) {
		return c.json({ error: e instanceof Error ? e.message : 'Invalid URL' }, 400)
	}

	const result = await testQbtConnection(body.url, body.username, body.password, body.skip_auth)
	if (!result.success) {
		const status = result.error === 'Invalid credentials' ? 401 : 400
		return c.json({ error: result.error }, status)
	}

	return c.json({ success: true, version: result.version })
})

instances.post('/test-agent', async (c) => {
	const body = await c.req.json<{ url: string }>()

	if (!body.url) {
		return c.json({ error: 'URL is required' }, 400)
	}

	try {
		validateUrl(body.url)
	} catch (e) {
		return c.json({ error: e instanceof Error ? e.message : 'Invalid URL' }, 400)
	}

	try {
		const agentUrl = new URL(body.url)
		agentUrl.port = '9999'
		const res = await fetchWithTls(`${agentUrl.origin}/health`, { signal: AbortSignal.timeout(5000) })
		if (res.ok) return c.json({ success: true })
		return c.json({ error: 'Agent not responding' }, 400)
	} catch {
		return c.json({ error: 'Agent not reachable at port 9999' }, 400)
	}
})

instances.delete('/:id', (c) => {
	const user = c.get('user')
	const id = Number(c.req.param('id'))

	const existing = db
		.query<Instance, [number, number]>('SELECT * FROM instances WHERE id = ? AND user_id = ?')
		.get(id, user.id)

	if (!existing) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	db.run('DELETE FROM instances WHERE id = ?', [id])
	clearQbtSession(id)
	return c.json({ success: true })
})

export default instances
