import { decrypt } from './crypto'
import { fetchWithTls } from './fetch'
import { log } from './logger'

interface QbtInstance {
	url: string
	qbt_username: string | null
	qbt_password_encrypted: string | null
	skip_auth: number
}

export type QbtLoginResult =
	| {
			success: true
			cookie: string | null
			version?: string
	  }
	| {
			success: false
			error: string
			status?: number
	  }

export async function loginToQbt(instance: QbtInstance, timeout?: number): Promise<QbtLoginResult> {
	if (instance.skip_auth) {
		return { success: true, cookie: null }
	}

	if (!instance.qbt_username || !instance.qbt_password_encrypted) {
		return { success: false, error: 'Credentials required' }
	}

	try {
		const password = decrypt(instance.qbt_password_encrypted)
		const res = await fetchWithTls(`${instance.url}/api/v2/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				username: instance.qbt_username,
				password,
			}),
			signal: timeout ? AbortSignal.timeout(timeout) : undefined,
		})

		if (!res.ok) {
			return { success: false, error: `Login failed: HTTP ${res.status}`, status: res.status }
		}

		const text = await res.text()
		if (text !== 'Ok.') {
			return { success: false, error: 'Invalid credentials', status: 401 }
		}

		const cookie = res.headers.get('set-cookie')?.split(';')[0]
		if (!cookie) {
			return { success: false, error: 'No session cookie received' }
		}

		return { success: true, cookie }
	} catch (e) {
		log.error(`qBittorrent login failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
		return { success: false, error: 'Connection failed' }
	}
}

export async function testQbtConnection(
	url: string,
	username?: string,
	password?: string,
	skipAuth?: boolean
): Promise<QbtLoginResult> {
	try {
		let cookie: string | null = null

		if (!skipAuth) {
			if (!username || !password) {
				return { success: false, error: 'Credentials required' }
			}

			const loginRes = await fetchWithTls(`${url}/api/v2/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({ username, password }),
			})

			if (!loginRes.ok) {
				return { success: false, error: `Login failed: HTTP ${loginRes.status}`, status: loginRes.status }
			}

			const loginText = await loginRes.text()
			if (loginText !== 'Ok.') {
				return { success: false, error: 'Invalid credentials', status: 401 }
			}

			cookie = loginRes.headers.get('set-cookie')?.split(';')[0] || null
			if (!cookie) {
				return { success: false, error: 'No session cookie received' }
			}
		}

		const versionRes = await fetchWithTls(`${url}/api/v2/app/version`, {
			headers: cookie ? { Cookie: cookie } : {},
		})

		if (!versionRes.ok) {
			return { success: false, error: skipAuth ? 'Connection failed - is IP bypass enabled?' : 'Failed to get version' }
		}

		const version = await versionRes.text()
		return { success: true, cookie, version }
	} catch (e) {
		log.error(`qBittorrent connection test failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
		return { success: false, error: 'Connection failed' }
	}
}

export async function testStoredQbtInstance(instance: QbtInstance): Promise<QbtLoginResult> {
	const loginResult = await loginToQbt(instance)
	if (!loginResult.success) {
		return loginResult
	}

	try {
		const versionRes = await fetchWithTls(`${instance.url}/api/v2/app/version`, {
			headers: loginResult.cookie ? { Cookie: loginResult.cookie } : {},
		})

		if (!versionRes.ok) {
			return {
				success: false,
				error: instance.skip_auth ? 'Connection failed - is IP bypass enabled?' : 'Failed to get version',
			}
		}

		const version = await versionRes.text()
		return { success: true, cookie: loginResult.cookie, version }
	} catch (e) {
		log.error(`qBittorrent stored instance test failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
		return { success: false, error: 'Connection failed' }
	}
}

interface SyncMaindata {
	server_state: {
		alltime_dl: number
		alltime_ul: number
	}
}

export async function fetchInstanceTransferStats(
	instance: QbtInstance
): Promise<{ uploaded: number; downloaded: number } | null> {
	try {
		const loginResult = await loginToQbt(instance)
		if (!loginResult.success) return null

		const headers: Record<string, string> = {}
		if (loginResult.cookie) headers.Cookie = loginResult.cookie

		const res = await fetchWithTls(`${instance.url}/api/v2/sync/maindata?rid=0`, { headers })
		if (!res.ok) return null

		const data = (await res.json()) as SyncMaindata
		return {
			uploaded: data.server_state.alltime_ul,
			downloaded: data.server_state.alltime_dl,
		}
	} catch {
		return null
	}
}
