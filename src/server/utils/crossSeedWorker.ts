import { createHash } from 'crypto'
import { db, type Instance, type Integration, type CrossSeedConfig, type CrossSeedSearchee, CrossSeedDecisionType } from '../db'
import { loginToQbt } from './qbt'
import { fetchWithTls } from './fetch'
import { decrypt } from './crypto'
import { log } from './logger'
import { matchTorrentsBySizes, preFilterCandidate, type FileInfo } from './crossSeedMatcher'
import { cacheTorrent, saveTorrentToOutput } from './crossSeedCache'

export interface ScanOptions {
	instanceId: number
	userId: number
	force?: boolean
	dryRunOverride?: boolean
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

interface QbtTorrent {
	hash: string
	name: string
	size: number
	state: string
	category: string
	tags: string
	save_path: string
	content_path: string
	progress: number
}

interface QbtFile {
	name: string
	size: number
	progress: number
	priority: number
	index: number
}

interface ProwlarrResult {
	guid: string
	indexerId: number
	indexer: string
	title: string
	size: number
	publishDate: string
	downloadUrl?: string
	magnetUrl?: string
	seeders?: number
	leechers?: number
	infoHash?: string
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

async function prowlarrSearch(integration: Integration, query: string): Promise<ProwlarrResult[]> {
	const apiKey = decrypt(integration.api_key_encrypted)
	const params = new URLSearchParams({ query, type: 'search' })
	const res = await fetchWithTls(`${integration.url}/api/v1/search?${params}`, {
		headers: { 'X-Api-Key': apiKey },
	})
	if (!res.ok) {
		throw new Error(`Prowlarr search failed: HTTP ${res.status}`)
	}
	return res.json() as Promise<ProwlarrResult[]>
}

async function downloadTorrent(integration: Integration, result: ProwlarrResult): Promise<Buffer | null> {
	if (!result.downloadUrl) return null

	const apiKey = decrypt(integration.api_key_encrypted)
	const prowlarrHost = new URL(integration.url).host
	const isProxied = result.downloadUrl.includes(prowlarrHost)
	const fetchUrl = isProxied
		? result.downloadUrl
		: `${integration.url}/api/v1/indexer/${result.indexerId}/download?link=${encodeURIComponent(result.downloadUrl)}`

	try {
		const res = await fetchWithTls(fetchUrl, {
			headers: { 'X-Api-Key': apiKey },
		})
		if (!res.ok) return null
		const data = await res.arrayBuffer()
		return Buffer.from(data)
	} catch (e) {
		log.warn(`[CrossSeed] Failed to download torrent: ${e instanceof Error ? e.message : 'Unknown'}`)
		return null
	}
}

async function addTorrentToQbt(
	instance: Instance,
	cookie: string | null,
	torrentData: Buffer,
	options: { savepath: string; category: string; tags: string; skipRecheck: boolean }
): Promise<boolean> {
	const formData = new FormData()
	formData.append('torrents', new Blob([torrentData], { type: 'application/x-bittorrent' }), 'release.torrent')
	formData.append('savepath', options.savepath)
	if (options.category) formData.append('category', options.category)
	if (options.tags) formData.append('tags', options.tags)
	formData.append('skip_checking', options.skipRecheck ? 'true' : 'false')
	formData.append('paused', options.skipRecheck ? 'false' : 'true')

	const headers: Record<string, string> = {}
	if (cookie) headers.Cookie = cookie

	const res = await fetchWithTls(`${instance.url}/api/v2/torrents/add`, {
		method: 'POST',
		headers,
		body: formData,
	})

	const text = await res.text()
	return res.ok && (text.trim() === 'Ok.' || text.trim() === 'Ok')
}

function parseFileSizesFromTorrent(torrentData: Buffer): FileInfo[] | null {
	try {
		const decoded = decodeBencode(torrentData)
		if (!decoded || !decoded.info) return null

		const info = decoded.info
		const files: FileInfo[] = []

		if (info.files) {
			for (const file of info.files) {
				const pathParts = file.path || []
				const name = pathParts.length > 0 ? pathParts[pathParts.length - 1].toString() : ''
				files.push({ name, size: Number(file.length) })
			}
		} else if (info.name && info.length) {
			files.push({ name: info.name.toString(), size: Number(info.length) })
		}

		return files
	} catch {
		return null
	}
}

type BencodeValue = number | Buffer | string | BencodeValue[] | { [key: string]: BencodeValue }

function decodeBencode(buffer: Buffer): BencodeValue {
	let pos = 0

	function decode(): BencodeValue {
		const char = String.fromCharCode(buffer[pos])

		if (char === 'd') {
			pos++
			const dict: { [key: string]: BencodeValue } = {}
			while (buffer[pos] !== 0x65) {
				const key = decode()
				const value = decode()
				dict[key.toString()] = value
			}
			pos++
			return dict
		}

		if (char === 'l') {
			pos++
			const list: BencodeValue[] = []
			while (buffer[pos] !== 0x65) {
				list.push(decode())
			}
			pos++
			return list
		}

		if (char === 'i') {
			pos++
			const end = buffer.indexOf(0x65, pos)
			const num = parseInt(buffer.slice(pos, end).toString(), 10)
			pos = end + 1
			return num
		}

		if (char >= '0' && char <= '9') {
			const colonIdx = buffer.indexOf(0x3a, pos)
			const len = parseInt(buffer.slice(pos, colonIdx).toString(), 10)
			pos = colonIdx + 1
			const str = buffer.slice(pos, pos + len)
			pos += len
			return str
		}

		throw new Error(`Unknown bencode type at pos ${pos}`)
	}

	return decode()
}

function getInfoHashFromTorrent(torrentData: Buffer): string | null {
	try {
		const decoded = decodeBencode(torrentData)
		if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded) || Buffer.isBuffer(decoded)) return null
		if (!('info' in decoded)) return null

		const bencodedInfo = encodeBencode(decoded.info)
		return createHash('sha1').update(bencodedInfo).digest('hex')
	} catch {
		return null
	}
}

function encodeBencode(data: BencodeValue): Buffer {
	if (typeof data === 'number') {
		return Buffer.from(`i${data}e`)
	}

	if (Buffer.isBuffer(data)) {
		return Buffer.concat([Buffer.from(`${data.length}:`), data])
	}

	if (typeof data === 'string') {
		const buf = Buffer.from(data)
		return Buffer.concat([Buffer.from(`${buf.length}:`), buf])
	}

	if (Array.isArray(data)) {
		const parts = [Buffer.from('l')]
		for (const item of data) {
			parts.push(encodeBencode(item))
		}
		parts.push(Buffer.from('e'))
		return Buffer.concat(parts)
	}

	if (typeof data === 'object' && data !== null) {
		const parts = [Buffer.from('d')]
		const keys = Object.keys(data).sort()
		for (const key of keys) {
			parts.push(encodeBencode(key))
			parts.push(encodeBencode(data[key]))
		}
		parts.push(Buffer.from('e'))
		return Buffer.concat(parts)
	}

	return Buffer.from('')
}

export async function runCrossSeedScan(options: ScanOptions): Promise<ScanResult> {
	const startedAt = Date.now()
	const result: ScanResult = {
		instanceId: options.instanceId,
		torrentsTotal: 0,
		torrentsScanned: 0,
		torrentsSkipped: 0,
		matchesFound: 0,
		torrentsAdded: 0,
		errors: [],
		dryRun: true,
		startedAt,
		completedAt: 0,
	}

	const config = db.query<CrossSeedConfig, [number]>(
		'SELECT * FROM cross_seed_config WHERE instance_id = ?'
	).get(options.instanceId)

	if (!config) {
		result.errors.push('Cross-seed not configured for this instance')
		result.completedAt = Date.now()
		return result
	}

	result.dryRun = options.dryRunOverride !== undefined ? options.dryRunOverride : !!config.dry_run

	if (!config.integration_id) {
		result.errors.push('No Prowlarr integration configured')
		result.completedAt = Date.now()
		return result
	}

	const integration = db.query<Integration, [number, number]>(
		'SELECT * FROM integrations WHERE id = ? AND user_id = ?'
	).get(config.integration_id, options.userId)

	if (!integration) {
		result.errors.push('Prowlarr integration not found or access denied')
		result.completedAt = Date.now()
		return result
	}

	const instance = db.query<Instance, [number, number]>(
		'SELECT * FROM instances WHERE id = ? AND user_id = ?'
	).get(options.instanceId, options.userId)

	if (!instance) {
		result.errors.push('Instance not found or access denied')
		result.completedAt = Date.now()
		return result
	}

	log.info(`[CrossSeed] Starting scan for instance ${instance.label} (dry_run=${result.dryRun}, force=${options.force})`)

	const loginResult = await loginToQbt(instance)
	if (!loginResult.success) {
		result.errors.push(`qBittorrent login failed: ${loginResult.error}`)
		result.completedAt = Date.now()
		return result
	}

	const torrents = await qbtRequest<QbtTorrent[]>(instance, loginResult.cookie, '/torrents/info')
	if (!torrents) {
		result.errors.push('Failed to fetch torrents from qBittorrent')
		result.completedAt = Date.now()
		return result
	}

	result.torrentsTotal = torrents.length

	const completedTorrents = torrents.filter((t) => t.progress === 1)
	log.info(`[CrossSeed] Found ${completedTorrents.length} completed torrents out of ${torrents.length} total`)

	const existingSearchees = new Map<string, CrossSeedSearchee>()
	if (!options.force) {
		const searchees = db.query<CrossSeedSearchee, [number]>(
			'SELECT * FROM cross_seed_searchee WHERE instance_id = ?'
		).all(options.instanceId)
		for (const s of searchees) {
			existingSearchees.set(s.torrent_hash, s)
		}
	}

	const existingHashes = new Set(
		torrents.map((t) => t.hash.toLowerCase())
	)

	for (const torrent of completedTorrents) {
		const existingSearchee = existingSearchees.get(torrent.hash)
		if (existingSearchee && !options.force) {
			result.torrentsSkipped++
			continue
		}

		result.torrentsScanned++
		log.info(`[CrossSeed] Searching for: ${torrent.name}`)

		try {
			const files = await qbtRequest<QbtFile[]>(instance, loginResult.cookie, `/torrents/files?hash=${torrent.hash}`)
			if (!files || files.length === 0) {
				log.warn(`[CrossSeed] No files found for torrent: ${torrent.name}`)
				continue
			}

			const sourceFiles: FileInfo[] = files.map((f) => ({ name: f.name, size: f.size }))
			const fileSizesJson = JSON.stringify(sourceFiles.map((f) => f.size).sort((a, b) => a - b))

			const searchQuery = torrent.name
				.replace(/\[.*?\]/g, '')
				.replace(/\(.*?\)/g, '')
				.replace(/\.\w{2,4}$/, '')
				.replace(/[._-]/g, ' ')
				.trim()

			let searchResults: ProwlarrResult[]
			try {
				searchResults = await prowlarrSearch(integration, searchQuery)
			} catch (e) {
				result.errors.push(`Search failed for ${torrent.name}: ${e instanceof Error ? e.message : 'Unknown'}`)
				continue
			}

			log.info(`[CrossSeed] Found ${searchResults.length} results for: ${torrent.name}`)

			const preFiltered = searchResults.filter((r) => {
				const check = preFilterCandidate(torrent.name, torrent.size, r.title, r.size)
				return check.pass
			})

			log.info(`[CrossSeed] ${preFiltered.length} results passed pre-filter`)

			for (const candidate of preFiltered) {
				if (candidate.infoHash && existingHashes.has(candidate.infoHash.toLowerCase())) {
					log.info(`[CrossSeed] Skipping ${candidate.title} - already in client`)
					continue
				}

				const existingDecision = db.query<{ decision: string }, [number, string]>(
					'SELECT decision FROM cross_seed_decision WHERE searchee_id = ? AND guid = ?'
				).get(existingSearchee?.id ?? 0, candidate.guid)

				if (existingDecision) {
					db.run(
						'UPDATE cross_seed_decision SET last_seen = ? WHERE searchee_id = ? AND guid = ?',
						[Math.floor(Date.now() / 1000), existingSearchee?.id ?? 0, candidate.guid]
					)
					if (existingDecision.decision === CrossSeedDecisionType.MATCH || existingDecision.decision === CrossSeedDecisionType.MATCH_SIZE_ONLY) {
						continue
					}
				}

				const torrentData = await downloadTorrent(integration, candidate)
				if (!torrentData) {
					log.warn(`[CrossSeed] Failed to download torrent for: ${candidate.title}`)
					continue
				}

				const candidateInfoHash = getInfoHashFromTorrent(torrentData)
				if (candidateInfoHash && existingHashes.has(candidateInfoHash.toLowerCase())) {
					log.info(`[CrossSeed] Skipping ${candidate.title} - already in client (by infohash)`)
					continue
				}

				const candidateFiles = parseFileSizesFromTorrent(torrentData)
				if (!candidateFiles) {
					log.warn(`[CrossSeed] Failed to parse torrent file for: ${candidate.title}`)
					continue
				}

				const matchResult = matchTorrentsBySizes(sourceFiles, candidateFiles)

				if (candidateInfoHash) {
					cacheTorrent(options.instanceId, candidateInfoHash, torrentData)
				}

				const searcheeId = existingSearchee?.id ?? db.run(
					`INSERT INTO cross_seed_searchee (instance_id, torrent_hash, torrent_name, total_size, file_count, file_sizes)
					 VALUES (?, ?, ?, ?, ?, ?)
					 ON CONFLICT(instance_id, torrent_hash) DO UPDATE SET last_searched = unixepoch()
					 RETURNING id`,
					[options.instanceId, torrent.hash, torrent.name, torrent.size, files.length, fileSizesJson]
				).lastInsertRowid

				db.run(
					`INSERT INTO cross_seed_decision (searchee_id, guid, info_hash, candidate_name, candidate_size, decision)
					 VALUES (?, ?, ?, ?, ?, ?)
					 ON CONFLICT(searchee_id, guid) DO UPDATE SET
					 	info_hash = excluded.info_hash,
					 	decision = excluded.decision,
					 	last_seen = unixepoch()`,
					[searcheeId, candidate.guid, candidateInfoHash, candidate.title, candidate.size, matchResult.decision]
				)

				if (matchResult.matched) {
					result.matchesFound++
					log.info(`[CrossSeed] MATCH: ${torrent.name} -> ${candidate.title} (${matchResult.decision})`)

					if (!result.dryRun) {
						const category = torrent.category
							? `${torrent.category}${config.category_suffix}`
							: config.category_suffix.replace(/^_/, '')
						const tags = config.tag || 'cross-seed'

						const added = await addTorrentToQbt(instance, loginResult.cookie, torrentData, {
							savepath: torrent.save_path,
							category,
							tags,
							skipRecheck: !!config.skip_recheck,
						})

						if (added) {
							result.torrentsAdded++
							log.info(`[CrossSeed] Added torrent: ${candidate.title}`)
							if (candidateInfoHash) {
								existingHashes.add(candidateInfoHash.toLowerCase())
							}
						} else {
							result.errors.push(`Failed to add torrent: ${candidate.title}`)
						}
					} else {
						log.info(`[CrossSeed] DRY RUN - Would add: ${candidate.title}`)
						if (candidateInfoHash) {
							saveTorrentToOutput(options.instanceId, candidate.title, candidateInfoHash, torrentData)
						}
					}

					break
				}
			}

			if (!existingSearchee) {
				db.run(
					`INSERT INTO cross_seed_searchee (instance_id, torrent_hash, torrent_name, total_size, file_count, file_sizes)
					 VALUES (?, ?, ?, ?, ?, ?)
					 ON CONFLICT(instance_id, torrent_hash) DO UPDATE SET last_searched = unixepoch()`,
					[options.instanceId, torrent.hash, torrent.name, torrent.size, files.length, fileSizesJson]
				)
			} else {
				db.run(
					'UPDATE cross_seed_searchee SET last_searched = ? WHERE id = ?',
					[Math.floor(Date.now() / 1000), existingSearchee.id]
				)
			}
		} catch (e) {
			result.errors.push(`Error processing ${torrent.name}: ${e instanceof Error ? e.message : 'Unknown'}`)
			log.error(`[CrossSeed] Error processing ${torrent.name}: ${e instanceof Error ? e.message : 'Unknown'}`)
		}
	}

	result.completedAt = Date.now()
	const duration = ((result.completedAt - result.startedAt) / 1000).toFixed(1)
	log.info(
		`[CrossSeed] Scan complete for ${instance.label}: ${result.torrentsScanned} scanned, ${result.torrentsSkipped} skipped, ${result.matchesFound} matches, ${result.torrentsAdded} added (${duration}s)`
	)

	db.run(
		'UPDATE cross_seed_config SET last_run = ? WHERE instance_id = ?',
		[Math.floor(Date.now() / 1000), options.instanceId]
	)

	return result
}
