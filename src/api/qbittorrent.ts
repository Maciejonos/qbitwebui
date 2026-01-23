import JSZip from 'jszip'
import type { Torrent, TorrentFilter, TransferInfo, SyncMaindata } from '../types/qbittorrent'
import type { TorrentProperties, Tracker, PeersResponse, TorrentFile, WebSeed } from '../types/torrentDetails'
import type { QBittorrentPreferences } from '../types/preferences'
import type { RSSItems, RSSRules, RSSRule, MatchingArticles } from '../types/rss'

function getBase(instanceId: number): string {
	return `/api/instances/${instanceId}/qbt/v2`
}

async function request<T>(instanceId: number, endpoint: string, options?: RequestInit): Promise<T> {
	const res = await fetch(`${getBase(instanceId)}${endpoint}`, {
		...options,
		credentials: 'include',
	})
	if (!res.ok) {
		throw new Error(`API error: ${res.status}`)
	}
	const text = await res.text()
	if (!text) {
		throw new Error('Empty response from API')
	}
	try {
		return JSON.parse(text)
	} catch {
		throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`)
	}
}

async function action(instanceId: number, endpoint: string, options?: RequestInit): Promise<void> {
	const res = await fetch(`${getBase(instanceId)}${endpoint}`, {
		...options,
		credentials: 'include',
	})
	if (!res.ok) {
		throw new Error(`API error: ${res.status}`)
	}
}

export interface TorrentFilterOptions {
	filter?: TorrentFilter
	category?: string
	tag?: string
}

export async function getTorrents(instanceId: number, options: TorrentFilterOptions = {}): Promise<Torrent[]> {
	const params = new URLSearchParams()
	if (options.filter && options.filter !== 'all') params.set('filter', options.filter)
	if (options.category) params.set('category', options.category)
	if (options.tag) params.set('tag', options.tag)
	const query = params.toString()
	return request<Torrent[]>(instanceId, `/torrents/info${query ? `?${query}` : ''}`)
}

export async function getTransferInfo(instanceId: number): Promise<TransferInfo> {
	return request<TransferInfo>(instanceId, '/transfer/info')
}

export async function getSyncMaindata(instanceId: number): Promise<SyncMaindata> {
	return request<SyncMaindata>(instanceId, '/sync/maindata?rid=0')
}

export async function stopTorrents(instanceId: number, hashes: string[]): Promise<void> {
	await action(instanceId, '/torrents/stop', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ hashes: hashes.join('|') }),
	})
}

export async function startTorrents(instanceId: number, hashes: string[]): Promise<void> {
	await action(instanceId, '/torrents/start', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ hashes: hashes.join('|') }),
	})
}

export async function deleteTorrents(instanceId: number, hashes: string[], deleteFiles = false): Promise<void> {
	await action(instanceId, '/torrents/delete', {
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
	tags?: string
	paused?: boolean
	sequentialDownload?: boolean
	firstLastPiecePrio?: boolean
	autoTMM?: boolean
}

export async function addTorrent(instanceId: number, options: AddTorrentOptions, files?: File[]): Promise<void> {
	const formData = new FormData()
	if (files) {
		files.forEach((file) => formData.append('torrents', file))
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
	if (options.tags) {
		formData.append('tags', options.tags)
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
	const res = await fetch(`${getBase(instanceId)}/torrents/add`, {
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

export async function getCategories(instanceId: number): Promise<Record<string, Category>> {
	return request<Record<string, Category>>(instanceId, '/torrents/categories')
}

export async function getTorrentProperties(instanceId: number, hash: string): Promise<TorrentProperties> {
	return request<TorrentProperties>(instanceId, `/torrents/properties?hash=${hash}`)
}

export async function getTorrentTrackers(instanceId: number, hash: string): Promise<Tracker[]> {
	return request<Tracker[]>(instanceId, `/torrents/trackers?hash=${hash}`)
}

export async function getTorrentPeers(instanceId: number, hash: string): Promise<PeersResponse> {
	return request<PeersResponse>(instanceId, `/sync/torrentPeers?hash=${hash}`)
}

export async function getTorrentFiles(instanceId: number, hash: string): Promise<TorrentFile[]> {
	return request<TorrentFile[]>(instanceId, `/torrents/files?hash=${hash}`)
}

export async function getTorrentWebSeeds(instanceId: number, hash: string): Promise<WebSeed[]> {
	return request<WebSeed[]>(instanceId, `/torrents/webseeds?hash=${hash}`)
}

export async function setCategory(instanceId: number, hashes: string[], category: string): Promise<void> {
	await action(instanceId, '/torrents/setCategory', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ hashes: hashes.join('|'), category }),
	})
}

export async function addTags(instanceId: number, hashes: string[], tags: string): Promise<void> {
	await action(instanceId, '/torrents/addTags', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ hashes: hashes.join('|'), tags }),
	})
}

export async function removeTags(instanceId: number, hashes: string[], tags: string): Promise<void> {
	await action(instanceId, '/torrents/removeTags', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ hashes: hashes.join('|'), tags }),
	})
}

export async function getTags(instanceId: number): Promise<string[]> {
	return request<string[]>(instanceId, '/torrents/tags')
}

export async function createTags(instanceId: number, tags: string): Promise<void> {
	await action(instanceId, '/torrents/createTags', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ tags }),
	})
}

export async function deleteTags(instanceId: number, tags: string): Promise<void> {
	await action(instanceId, '/torrents/deleteTags', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ tags }),
	})
}

export async function createCategory(instanceId: number, category: string, savePath?: string): Promise<void> {
	const params: Record<string, string> = { category }
	if (savePath) params.savePath = savePath
	await action(instanceId, '/torrents/createCategory', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(params),
	})
}

export async function editCategory(instanceId: number, category: string, savePath: string): Promise<void> {
	await action(instanceId, '/torrents/editCategory', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ category, savePath }),
	})
}

export async function removeCategories(instanceId: number, categories: string[]): Promise<void> {
	await action(instanceId, '/torrents/removeCategories', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ categories: categories.join('\n') }),
	})
}

export async function setFilePriority(
	instanceId: number,
	hash: string,
	ids: number[],
	priority: number
): Promise<void> {
	await action(instanceId, '/torrents/filePrio', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ hash, id: ids.join('|'), priority: priority.toString() }),
	})
}

export async function renameTorrent(instanceId: number, hash: string, name: string): Promise<void> {
	await action(instanceId, '/torrents/rename', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ hash, name }),
	})
}

export async function addTrackers(instanceId: number, hash: string, urls: string[]): Promise<void> {
	await action(instanceId, '/torrents/addTrackers', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ hash, urls: urls.join('\n') }),
	})
}

export async function removeTrackers(instanceId: number, hash: string, urls: string[]): Promise<void> {
	await action(instanceId, '/torrents/removeTrackers', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ hash, urls: urls.join('|') }),
	})
}

async function fetchTorrentBlob(instanceId: number, hash: string): Promise<Blob> {
	const res = await fetch(`${getBase(instanceId)}/torrents/export?hash=${hash}`, { credentials: 'include' })
	if (!res.ok) throw new Error(`Export failed: ${res.status}`)
	return res.blob()
}

function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	a.click()
	URL.revokeObjectURL(url)
}

export async function exportTorrents(instanceId: number, torrents: { hash: string; name: string }[]): Promise<void> {
	if (torrents.length === 1) {
		const blob = await fetchTorrentBlob(instanceId, torrents[0].hash)
		downloadBlob(blob, `${torrents[0].name}.torrent`)
		return
	}
	const zip = new JSZip()
	for (const t of torrents) {
		const blob = await fetchTorrentBlob(instanceId, t.hash)
		zip.file(`${t.name}.torrent`, blob)
	}
	const zipBlob = await zip.generateAsync({ type: 'blob' })
	downloadBlob(zipBlob, 'torrents.zip')
}

export async function getSpeedLimitsMode(instanceId: number): Promise<number> {
	const res = await fetch(`${getBase(instanceId)}/transfer/speedLimitsMode`, { credentials: 'include' })
	return Number(await res.text())
}

export async function toggleSpeedLimitsMode(instanceId: number): Promise<void> {
	await fetch(`${getBase(instanceId)}/transfer/toggleSpeedLimitsMode`, {
		method: 'POST',
		credentials: 'include',
	})
}

export async function getPreferences(instanceId: number): Promise<QBittorrentPreferences> {
	return request<QBittorrentPreferences>(instanceId, '/app/preferences')
}

export async function setPreferences(instanceId: number, prefs: Partial<QBittorrentPreferences>): Promise<void> {
	const res = await fetch(`${getBase(instanceId)}/app/setPreferences`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ json: JSON.stringify(prefs) }),
	})
	if (!res.ok) {
		throw new Error(`Failed to save preferences: ${res.status}`)
	}
}

export async function getRSSItems(instanceId: number, withData = false): Promise<RSSItems> {
	return request<RSSItems>(instanceId, `/rss/items?withData=${withData}`)
}

async function postRSS(instanceId: number, endpoint: string, params: Record<string, string>): Promise<void> {
	const res = await fetch(`${getBase(instanceId)}${endpoint}`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(params),
	})
	if (!res.ok) {
		const text = await res.text()
		throw new Error(text || `API error: ${res.status}`)
	}
}

export async function addRSSFeed(instanceId: number, url: string, path?: string): Promise<void> {
	const params: Record<string, string> = { url }
	if (path) params.path = path
	await postRSS(instanceId, '/rss/addFeed', params)
}

export async function addRSSFolder(instanceId: number, path: string): Promise<void> {
	await postRSS(instanceId, '/rss/addFolder', { path })
}

export async function removeRSSItem(instanceId: number, path: string): Promise<void> {
	await postRSS(instanceId, '/rss/removeItem', { path })
}

export async function moveRSSItem(instanceId: number, itemPath: string, destPath: string): Promise<void> {
	await postRSS(instanceId, '/rss/moveItem', { itemPath, destPath })
}

export async function refreshRSSItem(instanceId: number, itemPath: string): Promise<void> {
	await postRSS(instanceId, '/rss/refreshItem', { itemPath })
}

export async function markRSSAsRead(instanceId: number, itemPath: string, articleId?: string): Promise<void> {
	const params: Record<string, string> = { itemPath }
	if (articleId) params.articleId = articleId
	await postRSS(instanceId, '/rss/markAsRead', params)
}

export async function getRSSRules(instanceId: number): Promise<RSSRules> {
	return request<RSSRules>(instanceId, '/rss/rules')
}

export async function setRSSRule(instanceId: number, ruleName: string, ruleDef: Partial<RSSRule>): Promise<void> {
	await postRSS(instanceId, '/rss/setRule', { ruleName, ruleDef: JSON.stringify(ruleDef) })
}

export async function removeRSSRule(instanceId: number, ruleName: string): Promise<void> {
	await postRSS(instanceId, '/rss/removeRule', { ruleName })
}

export async function renameRSSRule(instanceId: number, ruleName: string, newRuleName: string): Promise<void> {
	await postRSS(instanceId, '/rss/renameRule', { ruleName, newRuleName })
}

export async function getMatchingArticles(instanceId: number, ruleName: string): Promise<MatchingArticles> {
	return request<MatchingArticles>(instanceId, `/rss/matchingArticles?ruleName=${encodeURIComponent(ruleName)}`)
}

export interface LogEntry {
	id: number
	message: string
	timestamp: number
	type: number
}

export interface PeerLogEntry {
	id: number
	ip: string
	timestamp: number
	blocked: boolean
	reason: string
}

export interface LogOptions {
	normal?: boolean
	info?: boolean
	warning?: boolean
	critical?: boolean
	lastKnownId?: number
}

export async function getLog(instanceId: number, options: LogOptions = {}): Promise<LogEntry[]> {
	const params = new URLSearchParams()
	if (options.normal !== undefined) params.set('normal', String(options.normal))
	if (options.info !== undefined) params.set('info', String(options.info))
	if (options.warning !== undefined) params.set('warning', String(options.warning))
	if (options.critical !== undefined) params.set('critical', String(options.critical))
	if (options.lastKnownId !== undefined) params.set('last_known_id', String(options.lastKnownId))
	const query = params.toString()
	return request<LogEntry[]>(instanceId, `/log/main${query ? `?${query}` : ''}`)
}

export async function getPeerLog(instanceId: number, lastKnownId?: number): Promise<PeerLogEntry[]> {
	const params = lastKnownId !== undefined ? `?last_known_id=${lastKnownId}` : ''
	return request<PeerLogEntry[]>(instanceId, `/log/peers${params}`)
}
