import xml2js from 'xml2js'
import { fetchWithTls } from './fetch'
import { log } from './logger'
import { db, IndexerStatus, type CrossSeedIndexer } from '../db'

const RATE_LIMIT_SNOOZE_MS = 60 * 60 * 1000
const ERROR_SNOOZE_MS = 10 * 60 * 1000

export interface TorznabIndexer {
	id: number
	name: string
	protocol: string
	supportsSearch: boolean
	categories: number[]
}

export interface TorznabResult {
	guid: string
	title: string
	link: string
	size: number | undefined
	pubDate: string
	indexer: string
	indexerId: number
	infoHash?: string
}

interface TorznabXmlResult {
	guid: [string]
	title: [string]
	link: [string]
	size?: [string]
	pubDate?: [string]
	'torznab:attr'?: Array<{ $: { name: string; value: string } }>
}

interface TorznabXmlResponse {
	rss?: {
		channel?: [{ item?: TorznabXmlResult[] }]
	}
}

export async function getTorznabIndexers(prowlarrUrl: string, apiKey: string): Promise<TorznabIndexer[]> {
	const res = await fetchWithTls(`${prowlarrUrl}/api/v1/indexer`, {
		headers: { 'X-Api-Key': apiKey },
	})
	if (!res.ok) {
		throw new Error(`Failed to fetch indexers: HTTP ${res.status}`)
	}
	const indexers = (await res.json()) as Array<{
		id: number
		name: string
		protocol: string
		supportsSearch: boolean
		enable: boolean
		capabilities?: { categories?: Array<{ id: number }> }
	}>
	return indexers
		.filter((i) => i.enable && i.supportsSearch && i.protocol === 'torrent')
		.map((i) => ({
			id: i.id,
			name: i.name,
			protocol: i.protocol,
			supportsSearch: i.supportsSearch,
			categories: i.capabilities?.categories?.map((c) => c.id) ?? [],
		}))
}

function getIndexerStatus(integrationId: number, indexerId: number): CrossSeedIndexer | null {
	return db
		.query<
			CrossSeedIndexer,
			[number, number]
		>('SELECT * FROM cross_seed_indexer WHERE integration_id = ? AND indexer_id = ?')
		.get(integrationId, indexerId)
}

function updateIndexerStatus(
	integrationId: number,
	indexerId: number,
	name: string,
	status: string,
	retryAfter: number
): void {
	db.run(
		`INSERT INTO cross_seed_indexer (integration_id, indexer_id, name, status, retry_after)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(integration_id, indexer_id) DO UPDATE SET
		 	name = excluded.name,
		 	status = excluded.status,
		 	retry_after = excluded.retry_after`,
		[integrationId, indexerId, name, status, retryAfter]
	)
	const retryDate = new Date(retryAfter).toISOString()
	log.info(`[CrossSeed] Snoozing ${name} (${status}) until ${retryDate}`)
}

function isIndexerAvailable(integrationId: number, indexerId: number): boolean {
	const status = getIndexerStatus(integrationId, indexerId)
	if (!status) return true
	if (status.status === IndexerStatus.OK) return true
	if (!status.retry_after) return true
	return Date.now() > status.retry_after
}

function clearIndexerStatus(integrationId: number, indexerId: number): void {
	db.run('UPDATE cross_seed_indexer SET status = ?, retry_after = NULL WHERE integration_id = ? AND indexer_id = ?', [
		IndexerStatus.OK,
		integrationId,
		indexerId,
	])
}

function handleResponseError(
	response: Response,
	integrationId: number,
	indexerId: number,
	indexerName: string
): number {
	const retryAfterHeader = response.headers.get('Retry-After')
	const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN

	let retryAfter: number
	if (!Number.isNaN(retryAfterSeconds)) {
		retryAfter = Date.now() + retryAfterSeconds * 1000
	} else if (response.status === 429) {
		retryAfter = Date.now() + RATE_LIMIT_SNOOZE_MS
	} else {
		retryAfter = Date.now() + ERROR_SNOOZE_MS
	}

	const status = response.status === 429 ? IndexerStatus.RATE_LIMITED : IndexerStatus.UNKNOWN_ERROR
	updateIndexerStatus(integrationId, indexerId, indexerName, status, retryAfter)
	return retryAfter
}

function parseTorznabResults(xml: TorznabXmlResponse, indexer: TorznabIndexer): TorznabResult[] {
	const items = xml?.rss?.channel?.[0]?.item
	if (!items || !Array.isArray(items)) {
		return []
	}

	return items
		.map((item) => {
			const attrs = item['torznab:attr'] ?? []
			const infoHashAttr = attrs.find((a) => a.$.name === 'infohash')
			return {
				guid: item.guid[0],
				title: item.title[0],
				link: item.link[0],
				size: item.size?.[0] ? parseInt(item.size[0], 10) || undefined : undefined,
				pubDate: item.pubDate?.[0] ?? '',
				indexer: indexer.name,
				indexerId: indexer.id,
				infoHash: infoHashAttr?.$.value,
			}
		})
		.filter((r) => r.title && r.link)
}

export async function searchTorznab(
	prowlarrUrl: string,
	apiKey: string,
	indexer: TorznabIndexer,
	query: string,
	integrationId: number
): Promise<TorznabResult[]> {
	if (!isIndexerAvailable(integrationId, indexer.id)) {
		const status = getIndexerStatus(integrationId, indexer.id)
		const retryDate = status?.retry_after ? new Date(status.retry_after).toISOString() : 'unknown'
		log.info(`[CrossSeed] Skipping ${indexer.name} - snoozed until ${retryDate}`)
		return []
	}

	const torznabUrl = `${prowlarrUrl}/${indexer.id}/api`
	const params = new URLSearchParams({
		t: 'search',
		apikey: apiKey,
		q: query,
	})

	const url = `${torznabUrl}?${params}`
	log.info(`[CrossSeed] Searching ${indexer.name}: ${query}`)

	let res: Response
	try {
		res = await fetchWithTls(url, {
			headers: { 'User-Agent': 'cross-seed-webui/1.0' },
			signal: AbortSignal.timeout(60000),
		})
	} catch (e) {
		const retryAfter = Date.now() + ERROR_SNOOZE_MS
		updateIndexerStatus(integrationId, indexer.id, indexer.name, IndexerStatus.UNKNOWN_ERROR, retryAfter)
		throw new Error(`${indexer.name} failed to respond: ${e instanceof Error ? e.message : 'Unknown'}`)
	}

	if (!res.ok) {
		handleResponseError(res, integrationId, indexer.id, indexer.name)
		if (res.status === 429) {
			return []
		}
		throw new Error(`Torznab search failed for ${indexer.name}: HTTP ${res.status}`)
	}

	clearIndexerStatus(integrationId, indexer.id)

	const xmlText = await res.text()
	try {
		const parsed: TorznabXmlResponse = await xml2js.parseStringPromise(xmlText)
		const results = parseTorznabResults(parsed, indexer)
		log.info(`[CrossSeed] ${indexer.name} returned ${results.length} results`)
		return results
	} catch (e) {
		log.warn(`[CrossSeed] Failed to parse XML from ${indexer.name}: ${e instanceof Error ? e.message : 'Unknown'}`)
		return []
	}
}

export async function searchAllIndexers(
	prowlarrUrl: string,
	apiKey: string,
	query: string,
	integrationId: number,
	indexerIds?: number[]
): Promise<TorznabResult[]> {
	let indexers = await getTorznabIndexers(prowlarrUrl, apiKey)
	if (indexerIds && indexerIds.length > 0) {
		const idSet = new Set(indexerIds)
		indexers = indexers.filter((i) => idSet.has(i.id))
	}

	const availableIndexers = indexers.filter((i) => isIndexerAvailable(integrationId, i.id))
	const skippedCount = indexers.length - availableIndexers.length
	if (skippedCount > 0) {
		log.info(`[CrossSeed] Skipping ${skippedCount} snoozed indexer(s)`)
	}
	if (availableIndexers.length === 0) {
		return []
	}
	log.info(`[CrossSeed] Searching ${availableIndexers.length} indexer(s) in parallel`)

	const outcomes = await Promise.allSettled(
		availableIndexers.map((indexer) => searchTorznab(prowlarrUrl, apiKey, indexer, query, integrationId))
	)

	const results: TorznabResult[] = []
	for (let i = 0; i < outcomes.length; i++) {
		const outcome = outcomes[i]
		const indexer = availableIndexers[i]
		if (outcome.status === 'fulfilled') {
			results.push(...outcome.value)
		} else {
			log.warn(
				`[CrossSeed] Search failed for ${indexer.name}: ${outcome.reason instanceof Error ? outcome.reason.message : 'Unknown'}`
			)
		}
	}

	return results
}

const SNATCH_RETRIES = 4
const SNATCH_DELAY_MS = 60 * 1000

async function snatchOnce(link: string): Promise<Buffer | { error: string; retryAfterMs?: number; noRetry?: boolean }> {
	try {
		const res = await fetchWithTls(link, {
			headers: { 'User-Agent': 'cross-seed-webui/1.0' },
			signal: AbortSignal.timeout(60000),
		})

		const retryAfterSeconds = Number(res.headers.get('Retry-After'))
		const retryAfterMs = !Number.isNaN(retryAfterSeconds) ? retryAfterSeconds * 1000 : undefined

		if (res.status === 429) {
			return { error: 'Rate limited', retryAfterMs, noRetry: true }
		}
		if (!res.ok) {
			return { error: `HTTP ${res.status}`, retryAfterMs }
		}

		const contentType = res.headers.get('content-type') || ''
		if (contentType.includes('magnet') || link.startsWith('magnet:')) {
			return { error: 'Magnet links not supported', noRetry: true }
		}

		const data = await res.arrayBuffer()
		return Buffer.from(data)
	} catch (e) {
		if (e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
			return { error: 'Timeout' }
		}
		return { error: e instanceof Error ? e.message : 'Unknown error' }
	}
}

export async function downloadTorrentDirect(
	link: string,
	options: { retries?: number; delayMs?: number } = {}
): Promise<Buffer | null> {
	if (!link) return null

	const retries = options.retries ?? SNATCH_RETRIES
	const delayMs = options.delayMs ?? SNATCH_DELAY_MS
	const retryAfterEndTime = Date.now() + retries * delayMs

	for (let i = 0; i <= retries; i++) {
		const result = await snatchOnce(link)

		if (Buffer.isBuffer(result)) {
			if (i > 0) {
				log.info(`[CrossSeed] Snatched torrent on attempt ${i + 1}/${retries + 1}`)
			}
			return result
		}

		const { error, retryAfterMs, noRetry } = result

		if (noRetry) {
			log.warn(`[CrossSeed] Download failed (no retry): ${error}`)
			return null
		}

		if (retryAfterMs && Date.now() + retryAfterMs >= retryAfterEndTime) {
			log.warn(`[CrossSeed] Download failed, Retry-After exceeds timeout: ${error}`)
			return null
		}

		const actualDelay = Math.max(delayMs, retryAfterMs ?? 0)

		if (i < retries) {
			log.warn(
				`[CrossSeed] Snatch attempt ${i + 1}/${retries + 1} failed, retrying in ${actualDelay / 1000}s: ${error}`
			)
			await new Promise((resolve) => setTimeout(resolve, actualDelay))
		} else {
			log.warn(`[CrossSeed] Download failed after ${retries + 1} attempts: ${error}`)
		}
	}

	return null
}
