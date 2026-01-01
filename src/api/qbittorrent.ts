import type { Torrent, TorrentFilter, TransferInfo } from '../types/qbittorrent'
import type { TorrentProperties, Tracker, PeersResponse, TorrentFile, WebSeed } from '../types/torrentDetails'

const BASE = '/api/v2'

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
	const res = await fetch(`${BASE}${endpoint}`, {
		...options,
		credentials: 'include',
	})
	if (!res.ok) {
		throw new Error(`API error: ${res.status}`)
	}
	const text = await res.text()
	if (!text) return {} as T
	try {
		return JSON.parse(text)
	} catch {
		throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`)
	}
}

export async function login(username: string, password: string): Promise<boolean> {
	const res = await fetch(`${BASE}/auth/login`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ username, password }),
	})
	const text = await res.text()
	return text === 'Ok.'
}

export async function checkSession(): Promise<boolean> {
	try {
		const res = await fetch(`${BASE}/app/version`, { credentials: 'include' })
		return res.ok
	} catch {
		return false
	}
}

export interface TorrentFilterOptions {
	filter?: TorrentFilter
	category?: string
	tag?: string
}

export async function getTorrents(options: TorrentFilterOptions = {}): Promise<Torrent[]> {
	const params = new URLSearchParams()
	if (options.filter && options.filter !== 'all') params.set('filter', options.filter)
	if (options.category) params.set('category', options.category)
	if (options.tag) params.set('tag', options.tag)
	const query = params.toString()
	return request<Torrent[]>(`/torrents/info${query ? `?${query}` : ''}`)
}

export async function getTransferInfo(): Promise<TransferInfo> {
	return request<TransferInfo>('/transfer/info')
}

export async function stopTorrents(hashes: string[]): Promise<void> {
	await request('/torrents/stop', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ hashes: hashes.join('|') }),
	})
}

export async function startTorrents(hashes: string[]): Promise<void> {
	await request('/torrents/start', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ hashes: hashes.join('|') }),
	})
}

export async function deleteTorrents(hashes: string[], deleteFiles = false): Promise<void> {
	await request('/torrents/delete', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			hashes: hashes.join('|'),
			deleteFiles: deleteFiles.toString(),
		}),
	})
}

export interface AddTorrentOptions {
	urls?: string
	savepath?: string
	category?: string
	paused?: boolean
	sequentialDownload?: boolean
	firstLastPiecePrio?: boolean
	autoTMM?: boolean
}

export async function addTorrent(options: AddTorrentOptions, file?: File): Promise<void> {
	const formData = new FormData()
	if (file) {
		formData.append('torrents', file)
	}
	if (options.urls) {
		formData.append('urls', options.urls)
	}
	if (options.savepath) {
		formData.append('savepath', options.savepath)
	}
	if (options.category) {
		formData.append('category', options.category)
	}
	if (options.paused !== undefined) {
		formData.append('paused', options.paused.toString())
	}
	if (options.sequentialDownload) {
		formData.append('sequentialDownload', 'true')
	}
	if (options.firstLastPiecePrio) {
		formData.append('firstLastPiecePrio', 'true')
	}
	if (options.autoTMM !== undefined) {
		formData.append('autoTMM', options.autoTMM.toString())
	}
	const res = await fetch(`${BASE}/torrents/add`, {
		method: 'POST',
		credentials: 'include',
		body: formData,
	})
	if (!res.ok) {
		throw new Error(`Failed to add torrent: ${res.status}`)
	}
}

export interface Category {
	name: string
	savePath: string
}

export async function getCategories(): Promise<Record<string, Category>> {
	return request<Record<string, Category>>('/torrents/categories')
}

export async function getTorrentProperties(hash: string): Promise<TorrentProperties> {
	return request<TorrentProperties>(`/torrents/properties?hash=${hash}`)
}

export async function getTorrentTrackers(hash: string): Promise<Tracker[]> {
	return request<Tracker[]>(`/torrents/trackers?hash=${hash}`)
}

export async function getTorrentPeers(hash: string): Promise<PeersResponse> {
	return request<PeersResponse>(`/sync/torrentPeers?hash=${hash}`)
}

export async function getTorrentFiles(hash: string): Promise<TorrentFile[]> {
	return request<TorrentFile[]>(`/torrents/files?hash=${hash}`)
}

export async function getTorrentWebSeeds(hash: string): Promise<WebSeed[]> {
	return request<WebSeed[]>(`/torrents/webseeds?hash=${hash}`)
}
