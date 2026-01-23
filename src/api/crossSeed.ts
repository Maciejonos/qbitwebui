export type MatchMode = 'strict' | 'flexible'

export interface CrossSeedConfig {
	instance_id: number
	enabled: boolean
	interval_hours: number
	delay_seconds: number
	dry_run: boolean
	category_suffix: string
	tag: string
	skip_recheck: boolean
	integration_id: number | null
	indexer_ids: number[]
	match_mode: MatchMode
	link_dir: string | null
	blocklist: string[]
	include_single_episodes: boolean
	last_run: number | null
	next_run: number | null
}

export interface TorznabIndexer {
	id: number
	name: string
	protocol: string
	supportsSearch: boolean
	categories: number[]
}

export interface ScanResult {
	instanceId: number
	torrentsTotal: number
	torrentsScanned: number
	torrentsSkipped: number
	matchesFound: number
	torrentsAdded: number
	errors: string[]
	dryRun: boolean
	startedAt: number
	completedAt: number
}

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

export interface CacheStats {
	cache: { count: number; totalSize: number }
	output: { count: number; files: string[] }
}

export interface Searchee {
	id: number
	instance_id: number
	torrent_hash: string
	torrent_name: string
	total_size: number
	file_count: number
	file_sizes: string
	first_searched: number
	last_searched: number
	decision_count: number
}

export interface Decision {
	id: number
	searchee_id: number
	guid: string
	info_hash: string | null
	candidate_name: string
	candidate_size: number | null
	decision: string
	first_seen: number
	last_seen: number
}

export async function getCrossSeedConfig(instanceId: number): Promise<CrossSeedConfig> {
	const res = await fetch(`/api/cross-seed/config/${instanceId}`, { credentials: 'include' })
	if (!res.ok) throw new Error('Failed to fetch cross-seed config')
	return res.json()
}

export async function updateCrossSeedConfig(
	instanceId: number,
	config: Partial<Omit<CrossSeedConfig, 'instance_id' | 'last_run' | 'next_run'>>
): Promise<{ linkDirValid?: boolean }> {
	const res = await fetch(`/api/cross-seed/config/${instanceId}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(config),
	})
	if (!res.ok) {
		const err = await res.json()
		throw new Error(err.error || 'Failed to update config')
	}
	return res.json()
}

export async function getIndexers(instanceId: number, integrationId?: number): Promise<TorznabIndexer[]> {
	const params = integrationId ? `?integrationId=${integrationId}` : ''
	const res = await fetch(`/api/cross-seed/indexers/${instanceId}${params}`, { credentials: 'include' })
	if (!res.ok) {
		const err = await res.json()
		throw new Error(err.error || 'Failed to fetch indexers')
	}
	return res.json()
}

export async function triggerScan(instanceId: number, force = false): Promise<ScanResult> {
	const res = await fetch(`/api/cross-seed/scan/${instanceId}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({ force }),
	})
	if (!res.ok) {
		const err = await res.json()
		throw new Error(err.error || 'Scan failed')
	}
	return res.json()
}

export async function getSchedulerStatus(): Promise<SchedulerStatus[]> {
	const res = await fetch('/api/cross-seed/status', { credentials: 'include' })
	if (!res.ok) throw new Error('Failed to fetch scheduler status')
	return res.json()
}

export async function getInstanceStatus(instanceId: number): Promise<SchedulerStatus> {
	const res = await fetch(`/api/cross-seed/status/${instanceId}`, { credentials: 'include' })
	if (!res.ok) throw new Error('Failed to fetch instance status')
	return res.json()
}

export async function clearCache(instanceId: number): Promise<{ cacheCleared: number; outputCleared: number }> {
	const res = await fetch(`/api/cross-seed/cache/${instanceId}/clear`, {
		method: 'POST',
		credentials: 'include',
	})
	if (!res.ok) throw new Error('Failed to clear cache')
	return res.json()
}

export async function getCacheStats(instanceId: number): Promise<CacheStats> {
	const res = await fetch(`/api/cross-seed/cache/${instanceId}/stats`, { credentials: 'include' })
	if (!res.ok) throw new Error('Failed to fetch cache stats')
	return res.json()
}

export async function getSearchHistory(
	instanceId: number,
	limit = 100,
	offset = 0
): Promise<{ searchees: Searchee[]; total: number }> {
	const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
	const res = await fetch(`/api/cross-seed/history/${instanceId}?${params}`, { credentials: 'include' })
	if (!res.ok) throw new Error('Failed to fetch search history')
	return res.json()
}

export async function getDecisions(instanceId: number, searcheeId: number): Promise<Decision[]> {
	const res = await fetch(`/api/cross-seed/history/${instanceId}/${searcheeId}/decisions`, {
		credentials: 'include',
	})
	if (!res.ok) throw new Error('Failed to fetch decisions')
	return res.json()
}

export async function stopScan(instanceId: number): Promise<{ stopped: boolean }> {
	const res = await fetch(`/api/cross-seed/stop/${instanceId}`, {
		method: 'POST',
		credentials: 'include',
	})
	if (!res.ok) {
		const err = await res.json()
		throw new Error(err.error || 'Failed to stop scan')
	}
	return res.json()
}

export interface LogEntry {
	timestamp: string
	level: 'INFO' | 'WARN' | 'ERROR'
	message: string
}

export async function getLogs(limit = 100): Promise<LogEntry[]> {
	const res = await fetch(`/api/cross-seed/logs?limit=${limit}`, { credentials: 'include' })
	if (!res.ok) throw new Error('Failed to fetch logs')
	return res.json()
}
