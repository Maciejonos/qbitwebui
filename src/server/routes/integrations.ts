import { Hono } from 'hono'
import { db, type Integration } from '../db'
import { encrypt, decrypt } from '../utils/crypto'
import { validateUrl } from '../utils/url'
import { loginToQbt } from '../utils/qbt'
import { authMiddleware } from '../middleware/auth'
import { log } from '../utils/logger'

const integrations = new Hono()

integrations.use('*', authMiddleware)

interface IntegrationResponse {
	id: number
	type: string
	label: string
	url: string
	created_at: number
}

function toResponse(i: Integration): IntegrationResponse {
	return {
		id: i.id,
		type: i.type,
		label: i.label,
		url: i.url,
		created_at: i.created_at,
	}
}

integrations.get('/', (c) => {
	const user = c.get('user')
	const list = db
		.query<Integration, [number]>('SELECT * FROM integrations WHERE user_id = ? ORDER BY created_at')
		.all(user.id)
	return c.json(list.map(toResponse))
})

integrations.post('/', async (c) => {
	const user = c.get('user')
	const body = await c.req.json<{
		type: string
		label: string
		url: string
		api_key: string
	}>()

	if (!body.type || !body.label || !body.url || !body.api_key) {
		return c.json({ error: 'Missing required fields' }, 400)
	}

	if (body.type !== 'prowlarr') {
		return c.json({ error: 'Unsupported integration type' }, 400)
	}

	try {
		validateUrl(body.url)
	} catch (e) {
		return c.json({ error: e instanceof Error ? e.message : 'Invalid URL' }, 400)
	}

	const encrypted = encrypt(body.api_key)

	try {
		const result = db.run(
			`INSERT INTO integrations (user_id, type, label, url, api_key_encrypted)
			 VALUES (?, ?, ?, ?, ?)`,
			[user.id, body.type, body.label, body.url, encrypted]
		)

		const integration = db
			.query<Integration, [number]>('SELECT * FROM integrations WHERE id = ?')
			.get(Number(result.lastInsertRowid))

		if (!integration) {
			return c.json({ error: 'Failed to create integration' }, 500)
		}

		return c.json(toResponse(integration), 201)
	} catch (e: unknown) {
		if (e instanceof Error && e.message.includes('UNIQUE')) {
			return c.json({ error: 'Integration with this label already exists' }, 400)
		}
		throw e
	}
})

function getUserIntegration(userId: number, integrationId: number) {
	return db
		.query<Integration, [number, number]>('SELECT * FROM integrations WHERE id = ? AND user_id = ?')
		.get(integrationId, userId)
}

integrations.delete('/:id', (c) => {
	const integration = getUserIntegration(c.get('user').id, Number(c.req.param('id')))
	if (!integration) return c.json({ error: 'Integration not found' }, 404)

	db.run('DELETE FROM integrations WHERE id = ?', [integration.id])
	return c.json({ success: true })
})

integrations.post('/test', async (c) => {
	const body = await c.req.json<{ url: string; api_key: string }>()

	if (!body.url || !body.api_key) {
		return c.json({ error: 'URL and API key are required' }, 400)
	}

	try {
		validateUrl(body.url)
	} catch (e) {
		return c.json({ error: e instanceof Error ? e.message : 'Invalid URL' }, 400)
	}

	try {
		const res = await fetch(`${body.url}/api/v1/system/status`, {
			headers: { 'X-Api-Key': body.api_key },
		})

		if (!res.ok) {
			return c.json({ error: `Connection failed: HTTP ${res.status}` }, 400)
		}

		const data = (await res.json()) as { version: string }
		return c.json({ success: true, version: data.version })
	} catch (e) {
		log.error(`Prowlarr test failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
		return c.json({ error: 'Connection failed' }, 400)
	}
})

async function fetchProwlarrApi(integration: Integration, endpoint: string, label: string) {
	const apiKey = decrypt(integration.api_key_encrypted)
	const res = await fetch(`${integration.url}/api/v1/${endpoint}`, {
		headers: { 'X-Api-Key': apiKey },
	})
	if (!res.ok) {
		throw new Error(`Failed to fetch ${label}: HTTP ${res.status}`)
	}
	return res.json()
}

integrations.get('/:id/indexers', async (c) => {
	const integration = getUserIntegration(c.get('user').id, Number(c.req.param('id')))
	if (!integration) return c.json({ error: 'Integration not found' }, 404)

	try {
		return c.json(await fetchProwlarrApi(integration, 'indexer', 'indexers'))
	} catch (e) {
		log.error(`Prowlarr indexers fetch failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
		return c.json({ error: 'Failed to fetch indexers' }, 400)
	}
})

integrations.get('/:id/categories', async (c) => {
	const integration = getUserIntegration(c.get('user').id, Number(c.req.param('id')))
	if (!integration) return c.json({ error: 'Integration not found' }, 404)

	try {
		return c.json(await fetchProwlarrApi(integration, 'indexer/categories', 'categories'))
	} catch (e) {
		log.error(`Prowlarr categories fetch failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
		return c.json({ error: 'Failed to fetch categories' }, 400)
	}
})

integrations.get('/:id/search', async (c) => {
	const integration = getUserIntegration(c.get('user').id, Number(c.req.param('id')))
	if (!integration) return c.json({ error: 'Integration not found' }, 404)

	const query = c.req.query('query')
	const indexerIds = c.req.query('indexerIds')
	const categories = c.req.query('categories')
	const type = c.req.query('type') || 'search'

	if (!query) {
		return c.json({ error: 'Query is required' }, 400)
	}

	try {
		const apiKey = decrypt(integration.api_key_encrypted)
		const params = new URLSearchParams({ query, type })
		if (indexerIds) params.set('indexerIds', indexerIds)
		if (categories) params.set('categories', categories)

		const res = await fetch(`${integration.url}/api/v1/search?${params}`, {
			headers: { 'X-Api-Key': apiKey },
		})

		if (!res.ok) {
			return c.json({ error: `Search failed: HTTP ${res.status}` }, 400)
		}

		const results = await res.json()
		return c.json(results)
	} catch (e) {
		log.error(`Prowlarr search failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
		return c.json({ error: 'Search failed' }, 400)
	}
})

integrations.post('/:id/grab', async (c) => {
	const userId = c.get('user').id
	const integration = getUserIntegration(userId, Number(c.req.param('id')))
	if (!integration) return c.json({ error: 'Integration not found' }, 404)

	const body = await c.req.json<{
		guid: string
		indexerId: number
		downloadUrl?: string
		magnetUrl?: string
		instanceId: number
		category?: string
		savepath?: string
		downloadPath?: string
	}>()

	if (!body.instanceId) {
		return c.json({ error: 'Instance ID is required' }, 400)
	}

	const instance = db
		.query<
			{
				id: number
				url: string
				qbt_username: string | null
				qbt_password_encrypted: string | null
				skip_auth: number
			},
			[number, number]
		>('SELECT id, url, qbt_username, qbt_password_encrypted, skip_auth FROM instances WHERE id = ? AND user_id = ?')
		.get(body.instanceId, userId)

	if (!instance) {
		return c.json({ error: 'qBittorrent instance not found' }, 404)
	}

	try {
		const loginResult = await loginToQbt(instance)
		if (!loginResult.success) {
			return c.json({ error: 'Failed to authenticate with qBittorrent' }, 400)
		}

		const formData = new FormData()

		if (body.category) {
			formData.append('category', body.category)
		}
		if (body.savepath) {
			formData.append('savepath', body.savepath)
		}
		if (body.downloadPath) {
			formData.append('downloadPath', body.downloadPath)
		}

		if (body.magnetUrl) {
			formData.append('urls', body.magnetUrl)
		} else if (body.downloadUrl) {
			const apiKey = decrypt(integration.api_key_encrypted)
			const prowlarrHost = new URL(integration.url).host
			const isAlreadyProxied = body.downloadUrl.includes(prowlarrHost)
			const fetchUrl = isAlreadyProxied
				? body.downloadUrl
				: `${integration.url}/api/v1/indexer/${body.indexerId}/download?link=${encodeURIComponent(body.downloadUrl)}`
			const torrentRes = await fetch(fetchUrl, {
				headers: { 'X-Api-Key': apiKey },
				redirect: 'manual',
			})
			const location = torrentRes.headers.get('location')
			if ((torrentRes.status === 301 || torrentRes.status === 302) && location?.startsWith('magnet:')) {
				formData.append('urls', location.replace(/&amp;/g, '&'))
			} else if (!torrentRes.ok) {
				return c.json({ error: `Failed to download from Prowlarr: HTTP ${torrentRes.status}` }, 400)
			} else {
				const torrentData = await torrentRes.arrayBuffer()
				formData.append('torrents', new Blob([torrentData], { type: 'application/x-bittorrent' }), 'release.torrent')
			}
		} else {
			return c.json({ error: 'No download URL available' }, 400)
		}

		const addHeaders: Record<string, string> = {}
		if (loginResult.cookie) addHeaders.Cookie = loginResult.cookie
		const addRes = await fetch(`${instance.url}/api/v2/torrents/add`, {
			method: 'POST',
			headers: addHeaders,
			body: formData,
		})

		const addText = await addRes.text()
		if (!addRes.ok || (addText.trim() !== 'Ok.' && addText.trim() !== 'Ok')) {
			return c.json({ error: `Failed to add torrent: ${addText || `HTTP ${addRes.status}`}` }, 400)
		}

		return c.json({ success: true })
	} catch (e) {
		log.error(`Prowlarr grab failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
		return c.json({ error: 'Failed to grab release' }, 400)
	}
})

export default integrations

