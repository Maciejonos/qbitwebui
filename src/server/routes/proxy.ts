import { Hono } from 'hono'
import { db, type Instance } from '../db'
import { loginToQbt as qbtLogin } from '../utils/qbt'
import { authMiddleware } from '../middleware/auth'
import { fetchWithTls } from '../utils/fetch'
import { log } from '../utils/logger'

const proxy = new Hono()

proxy.use('*', authMiddleware)

interface QbtSession {
	cookie: string | null
	expires: number
}

const qbtSessions = new Map<number, QbtSession>()
const loginInProgress = new Map<number, Promise<string | null>>()
const SESSION_TTL = 30 * 60 * 1000

async function loginToQbt(instance: Instance): Promise<string | null> {
	const existingLogin = loginInProgress.get(instance.id)
	if (existingLogin) {
		return existingLogin
	}

	const loginPromise = (async () => {
		const result = await qbtLogin(instance)
		if (!result.success) {
			throw new Error(result.error)
		}
		qbtSessions.set(instance.id, { cookie: result.cookie, expires: Date.now() + SESSION_TTL })
		return result.cookie
	})()

	loginInProgress.set(instance.id, loginPromise)
	try {
		return await loginPromise
	} finally {
		loginInProgress.delete(instance.id)
	}
}

async function getQbtSession(instance: Instance): Promise<string | null> {
	if (instance.skip_auth) {
		return null
	}
	const cached = qbtSessions.get(instance.id)
	if (cached && cached.expires > Date.now()) {
		return cached.cookie
	}
	return loginToQbt(instance)
}

export function clearQbtSession(instanceId: number) {
	qbtSessions.delete(instanceId)
	loginInProgress.delete(instanceId)
}

proxy.all('/:id/qbt/*', async (c) => {
	const user = c.get('user')
	const instanceId = Number(c.req.param('id'))

	if (isNaN(instanceId)) {
		return c.json({ error: 'Invalid instance ID' }, 400)
	}

	const instance = db
		.query<Instance, [number, number]>('SELECT * FROM instances WHERE id = ? AND user_id = ?')
		.get(instanceId, user.id)

	if (!instance) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	const path = c.req.path.replace(`/api/instances/${instanceId}/qbt`, '')
	const queryString = c.req.url.includes('?') ? c.req.url.slice(c.req.url.indexOf('?')) : ''
	const targetUrl = `${instance.url}/api${path}${queryString}`

	const makeRequest = async (cookie: string | null) => {
		const headers = new Headers()
		if (cookie) {
			headers.set('Cookie', cookie)
		}

		const contentType = c.req.header('content-type') || ''
		let body: string | FormData | ArrayBuffer | undefined

		if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
			if (contentType.includes('multipart/form-data')) {
				body = await c.req.formData()
			} else if (contentType.includes('application/x-www-form-urlencoded')) {
				headers.set('Content-Type', contentType)
				body = await c.req.text()
			} else if (contentType.includes('application/json')) {
				headers.set('Content-Type', contentType)
				body = await c.req.text()
			} else if (contentType) {
				headers.set('Content-Type', contentType)
				body = await c.req.arrayBuffer()
			}
		}

		return fetchWithTls(targetUrl, {
			method: c.req.method,
			headers,
			body,
		})
	}

	try {
		let cookie = await getQbtSession(instance)
		let res = await makeRequest(cookie)

		if (!instance.skip_auth && (res.status === 401 || res.status === 403)) {
			clearQbtSession(instance.id)
			cookie = await loginToQbt(instance)
			res = await makeRequest(cookie)
		}

		const responseHeaders = new Headers()
		const contentType = res.headers.get('content-type')
		if (contentType) {
			responseHeaders.set('Content-Type', contentType)
		}

		return new Response(res.body, {
			status: res.status,
			headers: responseHeaders,
		})
	} catch (e) {
		log.error(
			`qBittorrent proxy failed for instance ${instanceId}: ${e instanceof Error ? e.message : 'Unknown error'}`
		)
		return c.json({ error: 'Failed to connect to qBittorrent instance' }, 502)
	}
})

function deriveAgentUrl(qbtUrl: string): string {
	const url = new URL(qbtUrl)
	url.port = '9999'
	return url.origin
}

proxy.all('/:id/agent/*', async (c) => {
	const user = c.get('user')
	const instanceId = Number(c.req.param('id'))

	if (isNaN(instanceId)) {
		return c.json({ error: 'Invalid instance ID' }, 400)
	}

	const instance = db
		.query<Instance, [number, number]>('SELECT * FROM instances WHERE id = ? AND user_id = ?')
		.get(instanceId, user.id)

	if (!instance) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	if (!instance.agent_enabled) {
		return c.json({ error: 'Agent not enabled for this instance' }, 400)
	}

	const agentUrl = deriveAgentUrl(instance.url)
	const path = c.req.path.replace(`/api/instances/${instanceId}/agent`, '')
	const queryString = c.req.url.includes('?') ? c.req.url.slice(c.req.url.indexOf('?')) : ''
	const targetUrl = `${agentUrl}${path}${queryString}`

	try {
		const cookie = await getQbtSession(instance)
		const sid = cookie?.match(/SID=([^;]+)/)?.[1] || ''

		const headers = new Headers()
		headers.set('X-QBT-SID', sid)

		const res = await fetchWithTls(targetUrl, {
			method: c.req.method,
			headers,
		})

		const responseHeaders = new Headers()
		const contentType = res.headers.get('content-type')
		if (contentType) {
			responseHeaders.set('Content-Type', contentType)
		}

		return new Response(res.body, {
			status: res.status,
			headers: responseHeaders,
		})
	} catch (e) {
		log.error(`Agent proxy failed for instance ${instanceId}: ${e instanceof Error ? e.message : 'Unknown error'}`)
		return c.json({ error: 'Failed to connect to agent' }, 502)
	}
})

export default proxy
