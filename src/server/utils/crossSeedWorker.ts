import { createHash } from 'crypto'
import { constants as fsConstants } from 'fs'
import { link, mkdir, stat, access } from 'fs/promises'
import { dirname, join, basename } from 'path'
import {
	db,
	type Instance,
	type Integration,
	type CrossSeedConfig,
	type CrossSeedSearchee,
	CrossSeedDecisionType,
	MatchMode,
} from '../db'
import { loginToQbt } from './qbt'
import { fetchWithTls } from './fetch'
import { decrypt } from './crypto'
import { log } from './logger'
import {
	matchTorrentsBySizes,
	preFilterCandidate,
	shouldRejectSeasonEpisodeMismatch,
	findBlockedStringInRelease,
	type FileInfo,
	type Searchee,
} from './crossSeedMatcher'
import { cacheTorrent, saveTorrentToOutput } from './crossSeedCache'
import { searchAllIndexers, downloadTorrentDirect, type TorznabResult } from './torznab'

const DEFAULT_DELAY_SECONDS = 30

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

interface CandidateFileInfo {
	name: string
	path: string
	size: number
}

interface CandidateFilesWithRoot {
	rootName: string
	files: CandidateFileInfo[]
}

async function createHardlinks(
	sourceFiles: { name: string; size: number; path: string }[],
	candidateFiles: CandidateFileInfo[],
	linkDir: string
): Promise<{ success: boolean; destinationDir: string; error?: string }> {
	const destinationDir = linkDir
	const availableFiles = [...sourceFiles]

	try {
		await mkdir(destinationDir, { recursive: true })

		for (const candidateFile of candidateFiles) {
			let matches = availableFiles.filter((sf) => sf.size === candidateFile.size)
			if (matches.length > 1) {
				const nameMatch = matches.find((sf) => basename(sf.path) === candidateFile.name)
				if (nameMatch) matches = [nameMatch]
			}
			if (matches.length === 0) {
				return { success: false, destinationDir, error: `No matching source file for ${candidateFile.name}` }
			}

			const sourceFile = matches[0]
			const destPath = join(destinationDir, candidateFile.path)
			const destDir = dirname(destPath)

			if (destDir !== destinationDir) {
				await mkdir(destDir, { recursive: true })
			}

			try {
				await link(sourceFile.path, destPath)
				log.info(`[CrossSeed] Linked: ${sourceFile.path} -> ${destPath}`)
			} catch (e) {
				if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
					log.info(`[CrossSeed] Link already exists: ${destPath}`)
				} else {
					throw e
				}
			}

			const idx = availableFiles.indexOf(sourceFile)
			if (idx !== -1) availableFiles.splice(idx, 1)
		}

		return { success: true, destinationDir }
	} catch (e) {
		return { success: false, destinationDir, error: e instanceof Error ? e.message : 'Unknown error' }
	}
}

async function canCreateHardlink(sourcePath: string, destDir: string): Promise<boolean> {
	try {
		const sourceStat = await stat(sourcePath)
		const destStat = await stat(destDir)
		if (sourceStat.dev !== destStat.dev) {
			return false
		}
		await access(destDir, fsConstants.W_OK)
		return true
	} catch {
		return false
	}
}

export interface ScanOptions {
	instanceId: number
	userId: number
	force?: boolean
	dryRunOverride?: boolean
	signal?: AbortSignal
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
	amount_left: number
}

interface QbtFile {
	name: string
	size: number
	progress: number
	priority: number
	index: number
}

interface QbtVersion {
	major: number
	minor: number
	patch: number
}

const RESUME_SLEEP_MS = 15 * 1000
const RESUME_ERROR_SLEEP_MS = 5 * 60 * 1000
const RESUME_TIMEOUT_MS = 60 * 60 * 1000

async function qbtFetch(instance: Instance, cookie: string | null, endpoint: string): Promise<Response | null> {
	try {
		const res = await fetchWithTls(`${instance.url}/api/v2${endpoint}`, {
			headers: cookie ? { Cookie: cookie } : {},
		})
		return res.ok ? res : null
	} catch {
		return null
	}
}

async function qbtRequest<T>(instance: Instance, cookie: string | null, endpoint: string): Promise<T | null> {
	const res = await qbtFetch(instance, cookie, endpoint)
	return res ? (res.json() as Promise<T>) : null
}

async function qbtRequestText(instance: Instance, cookie: string | null, endpoint: string): Promise<string | null> {
	const res = await qbtFetch(instance, cookie, endpoint)
	return res ? res.text() : null
}

const DEFAULT_QBT_VERSION: QbtVersion = { major: 4, minor: 0, patch: 0 }

async function getQbtVersion(instance: Instance, cookie: string | null): Promise<QbtVersion> {
	const versionStr = await qbtRequestText(instance, cookie, '/app/version')
	const match = versionStr?.match(/v?(\d+)\.(\d+)\.?(\d+)?/)
	if (!match) return DEFAULT_QBT_VERSION
	return {
		major: parseInt(match[1], 10) || 4,
		minor: parseInt(match[2], 10) || 0,
		patch: parseInt(match[3], 10) || 0,
	}
}

async function getTorrentInfo(
	instance: Instance,
	cookie: string | null,
	hash: string,
	numRetries = 0
): Promise<QbtTorrent | null> {
	const retries = Math.max(numRetries, 0)
	for (let i = 0; i <= retries; i++) {
		const torrents = await qbtRequest<QbtTorrent[]>(instance, cookie, `/torrents/info?hashes=${hash}`)
		if (torrents && torrents.length > 0) {
			return torrents[0]
		}
		if (i < retries) {
			const delay = Math.min(1000 * 2 ** i, 10000)
			await wait(delay)
		}
	}
	return null
}

async function qbtPost(instance: Instance, cookie: string | null, endpoint: string, body: string): Promise<boolean> {
	try {
		const res = await fetchWithTls(`${instance.url}/api/v2${endpoint}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				...(cookie ? { Cookie: cookie } : {}),
			},
			body,
		})
		return res.ok
	} catch {
		return false
	}
}

async function recheckTorrent(
	instance: Instance,
	cookie: string | null,
	hash: string,
	version: QbtVersion
): Promise<void> {
	const stopEndpoint = version.major >= 5 ? '/torrents/stop' : '/torrents/pause'
	await qbtPost(instance, cookie, stopEndpoint, `hashes=${hash}`)
	await qbtPost(instance, cookie, '/torrents/recheck', `hashes=${hash}`)
}

async function resumeInjection(
	instance: Instance,
	cookie: string | null,
	infoHash: string,
	version: QbtVersion
): Promise<void> {
	const stopTime = Date.now() + RESUME_TIMEOUT_MS
	let sleepTime = RESUME_SLEEP_MS

	while (Date.now() < stopTime) {
		await wait(sleepTime)

		const torrentInfo = await getTorrentInfo(instance, cookie, infoHash)
		if (!torrentInfo) {
			sleepTime = RESUME_ERROR_SLEEP_MS
			continue
		}

		if (['checkingDL', 'checkingUP', 'checkingResumeData'].includes(torrentInfo.state)) {
			sleepTime = RESUME_SLEEP_MS
			continue
		}

		const pausedStates = ['pausedDL', 'stoppedDL', 'pausedUP', 'stoppedUP']
		if (!pausedStates.includes(torrentInfo.state)) {
			log.warn(`[CrossSeed] Will not resume ${torrentInfo.name}: state is ${torrentInfo.state}`)
			return
		}

		if (torrentInfo.amount_left > 0) {
			log.warn(`[CrossSeed] Will not resume ${torrentInfo.name}: ${torrentInfo.amount_left} bytes remaining`)
			return
		}

		log.info(`[CrossSeed] Resuming ${torrentInfo.name}`)
		const resumeEndpoint = version.major >= 5 ? '/torrents/start' : '/torrents/resume'
		await qbtPost(instance, cookie, resumeEndpoint, `hashes=${infoHash}`)
		return
	}

	log.warn(`[CrossSeed] Resume monitoring timeout for ${infoHash}`)
}

async function addTorrentToQbt(
	instance: Instance,
	cookie: string | null,
	torrentData: Buffer,
	opts: {
		savepath: string
		category: string
		tags: string
		skipRecheck: boolean
		infoHash?: string
		version: QbtVersion
	}
): Promise<boolean> {
	const toRecheck = !opts.skipRecheck
	const formData = new FormData()
	formData.append('torrents', new Blob([torrentData], { type: 'application/x-bittorrent' }), 'release.torrent')
	formData.append('savepath', opts.savepath)
	if (opts.category) formData.append('category', opts.category)
	if (opts.tags) formData.append('tags', opts.tags)
	formData.append('skip_checking', toRecheck ? 'false' : 'true')
	formData.append(opts.version.major >= 5 ? 'stopped' : 'paused', toRecheck ? 'true' : 'false')
	formData.append('autoTMM', 'false')
	formData.append('contentLayout', 'Original')

	try {
		const res = await fetchWithTls(`${instance.url}/api/v2/torrents/add`, {
			method: 'POST',
			headers: cookie ? { Cookie: cookie } : {},
			body: formData,
		})
		const text = await res.text()
		const apiSuccess = res.ok && text.trim().startsWith('Ok')

		if (!apiSuccess) {
			log.error(`[CrossSeed] API returned failure: ${text}`)
			return false
		}
	} catch (e) {
		log.error(`[CrossSeed] Failed to add torrent: ${e instanceof Error ? e.message : 'Unknown'}`)
		return false
	}

	if (!opts.infoHash) {
		return true
	}

	const newInfo = await getTorrentInfo(instance, cookie, opts.infoHash, 5)
	if (!newInfo) {
		log.error(`[CrossSeed] Failed to verify torrent was added: ${opts.infoHash}`)
		return false
	}

	if (toRecheck) {
		await recheckTorrent(instance, cookie, newInfo.hash, opts.version)
		resumeInjection(instance, cookie, opts.infoHash, opts.version).catch((e) => {
			log.error(`[CrossSeed] Resume monitoring error: ${e instanceof Error ? e.message : 'Unknown'}`)
		})
	}

	return true
}

interface TorrentInfo {
	files?: { path?: Buffer[]; length: number }[]
	name?: Buffer
	length?: number
}

function parseTorrentInfo(torrentData: Buffer): TorrentInfo | null {
	try {
		const decoded = decodeBencode(torrentData) as { info?: TorrentInfo }
		return decoded?.info ?? null
	} catch {
		return null
	}
}

function parseFileSizesFromTorrent(torrentData: Buffer): FileInfo[] | null {
	const info = parseTorrentInfo(torrentData)
	if (!info) return null

	if (info.files) {
		return info.files.map((file) => {
			const pathParts = file.path || []
			const name = pathParts.length > 0 ? pathParts[pathParts.length - 1].toString() : ''
			return { name, size: Number(file.length) }
		})
	}
	if (info.name && info.length) {
		return [{ name: info.name.toString(), size: Number(info.length) }]
	}
	return []
}

function parseFilesWithPathsFromTorrent(torrentData: Buffer): CandidateFilesWithRoot | null {
	const info = parseTorrentInfo(torrentData)
	if (!info) return null

	const torrentName = info.name?.toString() || ''

	if (info.files) {
		return {
			rootName: torrentName,
			files: info.files.map((file) => {
				const pathParts = file.path || []
				const internalPath = pathParts.map((p) => p.toString()).join('/')
				return {
					name: pathParts.length > 0 ? pathParts[pathParts.length - 1].toString() : '',
					path: torrentName ? `${torrentName}/${internalPath}` : internalPath,
					size: Number(file.length),
				}
			}),
		}
	}
	if (info.name && info.length) {
		return { rootName: torrentName, files: [{ name: torrentName, path: torrentName, size: Number(info.length) }] }
	}
	return { rootName: torrentName, files: [] }
}

type BencodeValue = number | Buffer | string | BencodeValue[] | { [key: string]: BencodeValue }

const MAX_BENCODE_DEPTH = 100
const MAX_BENCODE_ITERATIONS = 100000

function decodeBencode(buffer: Buffer): BencodeValue {
	let pos = 0
	let iterations = 0

	function checkBounds(): void {
		if (pos >= buffer.length) {
			throw new Error('Unexpected end of buffer')
		}
		if (++iterations > MAX_BENCODE_ITERATIONS) {
			throw new Error('Bencode parsing exceeded maximum iterations')
		}
	}

	function decode(depth: number): BencodeValue {
		if (depth > MAX_BENCODE_DEPTH) {
			throw new Error('Bencode parsing exceeded maximum depth')
		}
		checkBounds()
		const char = String.fromCharCode(buffer[pos])

		if (char === 'd') {
			pos++
			const dict: { [key: string]: BencodeValue } = {}
			while (pos < buffer.length && buffer[pos] !== 0x65) {
				const key = decode(depth + 1)
				const value = decode(depth + 1)
				dict[key.toString()] = value
			}
			if (pos >= buffer.length) throw new Error('Unterminated dict')
			pos++
			return dict
		}

		if (char === 'l') {
			pos++
			const list: BencodeValue[] = []
			while (pos < buffer.length && buffer[pos] !== 0x65) {
				list.push(decode(depth + 1))
			}
			if (pos >= buffer.length) throw new Error('Unterminated list')
			pos++
			return list
		}

		if (char === 'i') {
			pos++
			const end = buffer.indexOf(0x65, pos)
			if (end === -1 || end > pos + 20) throw new Error('Invalid integer encoding')
			const num = parseInt(buffer.slice(pos, end).toString(), 10)
			if (isNaN(num)) throw new Error('Invalid integer value')
			pos = end + 1
			return num
		}

		if (char >= '0' && char <= '9') {
			const colonIdx = buffer.indexOf(0x3a, pos)
			if (colonIdx === -1 || colonIdx > pos + 10) throw new Error('Invalid string length')
			const len = parseInt(buffer.slice(pos, colonIdx).toString(), 10)
			if (isNaN(len) || len < 0 || len > buffer.length) throw new Error('Invalid string length value')
			pos = colonIdx + 1
			if (pos + len > buffer.length) throw new Error('String extends past buffer')
			const str = buffer.slice(pos, pos + len)
			pos += len
			return str
		}

		throw new Error(`Unknown bencode type at pos ${pos}`)
	}

	return decode(0)
}

function getInfoHashFromTorrent(torrentData: Buffer): string | null {
	try {
		const decoded = decodeBencode(torrentData)
		if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded) || Buffer.isBuffer(decoded))
			return null
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
		const parts: Buffer[] = [Buffer.from('l')]
		for (const item of data) {
			parts.push(encodeBencode(item))
		}
		parts.push(Buffer.from('e'))
		return Buffer.concat(parts)
	}

	if (typeof data === 'object' && data !== null) {
		const parts: Buffer[] = [Buffer.from('d')]
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

function upsertSearchee(
	instanceId: number,
	hash: string,
	name: string,
	size: number,
	fileCount: number,
	fileSizesJson: string
): number {
	db.run(
		`INSERT INTO cross_seed_searchee (instance_id, torrent_hash, torrent_name, total_size, file_count, file_sizes)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(instance_id, torrent_hash) DO UPDATE SET last_searched = unixepoch()`,
		[instanceId, hash, name, size, fileCount, fileSizesJson]
	)
	const row = db
		.query<
			{ id: number },
			[number, string]
		>('SELECT id FROM cross_seed_searchee WHERE instance_id = ? AND torrent_hash = ?')
		.get(instanceId, hash)
	return row!.id
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

	const config = db
		.query<CrossSeedConfig, [number]>('SELECT * FROM cross_seed_config WHERE instance_id = ?')
		.get(options.instanceId)

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

	const integration = db
		.query<Integration, [number, number]>('SELECT * FROM integrations WHERE id = ? AND user_id = ?')
		.get(config.integration_id, options.userId)

	if (!integration) {
		result.errors.push('Prowlarr integration not found or access denied')
		result.completedAt = Date.now()
		return result
	}

	const instance = db
		.query<Instance, [number, number]>('SELECT * FROM instances WHERE id = ? AND user_id = ?')
		.get(options.instanceId, options.userId)

	if (!instance) {
		result.errors.push('Instance not found or access denied')
		result.completedAt = Date.now()
		return result
	}

	const delaySeconds = config.delay_seconds ?? DEFAULT_DELAY_SECONDS
	log.info(
		`[CrossSeed] Starting scan for instance ${instance.label} (dry_run=${result.dryRun}, force=${options.force}, delay=${delaySeconds}s)`
	)

	const loginResult = await loginToQbt(instance)
	if (!loginResult.success) {
		result.errors.push(`qBittorrent login failed: ${loginResult.error}`)
		result.completedAt = Date.now()
		return result
	}

	const qbtVersion = await getQbtVersion(instance, loginResult.cookie)
	log.info(`[CrossSeed] qBittorrent version: ${qbtVersion.major}.${qbtVersion.minor}.${qbtVersion.patch}`)

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
	const searchees = db
		.query<CrossSeedSearchee, [number]>('SELECT * FROM cross_seed_searchee WHERE instance_id = ?')
		.all(options.instanceId)
	for (const s of searchees) {
		existingSearchees.set(s.torrent_hash, s)
	}

	const existingHashes = new Set(torrents.map((t) => t.hash.toLowerCase()))
	let lastSearchTime = 0

	const blocklist: string[] = config.blocklist ? JSON.parse(config.blocklist) : []
	const includeSingleEpisodes = !!config.include_single_episodes

	for (const torrent of completedTorrents) {
		if (options.signal?.aborted) {
			const error = new Error('Scan aborted')
			error.name = 'AbortError'
			throw error
		}

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

			const sourceFiles: FileInfo[] = files.map((f) => ({ name: basename(f.name), size: f.size }))

			if (blocklist.length > 0) {
				const searchee: Searchee = {
					title: torrent.name,
					files: sourceFiles,
					length: torrent.size,
					infoHash: torrent.hash,
					path: torrent.content_path,
					category: torrent.category,
					tags: torrent.tags ? torrent.tags.split(',').map((t) => t.trim()) : undefined,
				}
				const blocked = findBlockedStringInRelease(searchee, blocklist)
				if (blocked) {
					log.info(`[CrossSeed] Skipping ${torrent.name} - matches blocklist: ${blocked}`)
					continue
				}
			}
			const fileSizesJson = JSON.stringify(sourceFiles.map((f) => f.size).sort((a, b) => a - b))

			const searchQuery = torrent.name
				.replace(/\[.*?\]/g, '')
				.replace(/\(.*?\)/g, '')
				.replace(/\.\w{2,4}$/, '')
				.replace(/[._-]/g, ' ')
				.trim()

			const apiKey = decrypt(integration.api_key_encrypted)
			let indexerIds: number[] | undefined
			if (config.indexer_ids) {
				try {
					const parsed = JSON.parse(config.indexer_ids)
					indexerIds = Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : undefined
				} catch {
					indexerIds = undefined
				}
			}

			const now = Date.now()
			const waitUntil = lastSearchTime + delaySeconds * 1000
			if (now < waitUntil) {
				const waitMs = waitUntil - now
				log.info(`[CrossSeed] Waiting ${(waitMs / 1000).toFixed(1)}s before next search`)
				await wait(waitMs)
			}
			lastSearchTime = Date.now()

			let searchResults: TorznabResult[]
			try {
				searchResults = await searchAllIndexers(
					integration.url,
					apiKey,
					searchQuery,
					config.integration_id!,
					indexerIds
				)
			} catch (e) {
				result.errors.push(`Search failed for ${torrent.name}: ${e instanceof Error ? e.message : 'Unknown'}`)
				continue
			}

			log.info(`[CrossSeed] Found ${searchResults.length} results for: ${torrent.name}`)

			const preFiltered: Array<{ result: TorznabResult; reason?: string }> = []
			for (const r of searchResults) {
				const check = preFilterCandidate(torrent.name, torrent.size, r.title, r.size)
				if (check.pass) {
					preFiltered.push({ result: r })
				}
			}

			log.info(`[CrossSeed] ${preFiltered.length} results passed pre-filter`)

			for (const { result: candidate } of preFiltered) {
				if (candidate.infoHash && existingHashes.has(candidate.infoHash.toLowerCase())) {
					log.info(`[CrossSeed] Skipping ${candidate.title} - already in client`)
					continue
				}

				const existingDecision = db
					.query<
						{ decision: string; info_hash: string | null },
						[number, string]
					>('SELECT decision, info_hash FROM cross_seed_decision WHERE searchee_id = ? AND guid = ?')
					.get(existingSearchee?.id ?? 0, candidate.guid)

				if (existingDecision) {
					db.run('UPDATE cross_seed_decision SET last_seen = ? WHERE searchee_id = ? AND guid = ?', [
						Math.floor(Date.now() / 1000),
						existingSearchee?.id ?? 0,
						candidate.guid,
					])
					if (
						!options.force &&
						(existingDecision.decision === CrossSeedDecisionType.MATCH ||
							existingDecision.decision === CrossSeedDecisionType.MATCH_SIZE_ONLY)
					) {
						const inClient = existingDecision.info_hash && existingHashes.has(existingDecision.info_hash.toLowerCase())
						if (inClient) {
							continue
						}
					}
				}

				const torrentData = await downloadTorrentDirect(candidate.link)
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

				if (blocklist.length > 0) {
					const candidateSearchee: Searchee = {
						title: candidate.title,
						files: candidateFiles,
						length: candidate.size ?? candidateFiles.reduce((sum, f) => sum + f.size, 0),
					}
					const blockedCandidate = findBlockedStringInRelease(candidateSearchee, blocklist)
					if (blockedCandidate) {
						log.info(`[CrossSeed] Skipping candidate ${candidate.title} - matches blocklist: ${blockedCandidate}`)
						continue
					}
				}

				if (shouldRejectSeasonEpisodeMismatch(torrent.name, candidate.title, candidateFiles, includeSingleEpisodes)) {
					log.info(`[CrossSeed] Skipping ${candidate.title} - single episode cannot match season pack`)
					continue
				}

				const matchResult = matchTorrentsBySizes(sourceFiles, candidateFiles)

				if (candidateInfoHash) {
					cacheTorrent(options.instanceId, candidateInfoHash, torrentData)
				}

				const searcheeId =
					existingSearchee?.id ??
					upsertSearchee(options.instanceId, torrent.hash, torrent.name, torrent.size, files.length, fileSizesJson)

				db.run(
					`INSERT INTO cross_seed_decision (searchee_id, guid, info_hash, candidate_name, candidate_size, decision)
					 VALUES (?, ?, ?, ?, ?, ?)
					 ON CONFLICT(searchee_id, guid) DO UPDATE SET
					 	info_hash = excluded.info_hash,
					 	decision = excluded.decision,
					 	last_seen = unixepoch()`,
					[searcheeId, candidate.guid, candidateInfoHash, candidate.title, candidate.size ?? null, matchResult.decision]
				)

				if (matchResult.matched) {
					const isFlexibleMode = config.match_mode === MatchMode.FLEXIBLE
					const hasLinkDir = !!config.link_dir

					if (matchResult.decision === CrossSeedDecisionType.MATCH_SIZE_ONLY) {
						if (!isFlexibleMode) {
							log.info(`[CrossSeed] Skipping MATCH_SIZE_ONLY: ${torrent.name} -> ${candidate.title} (strict mode)`)
							continue
						}
						if (!hasLinkDir) {
							log.info(
								`[CrossSeed] Skipping MATCH_SIZE_ONLY: ${torrent.name} -> ${candidate.title} (no link_dir configured)`
							)
							continue
						}
					}

					result.matchesFound++
					log.info(`[CrossSeed] MATCH: ${torrent.name} -> ${candidate.title} (${matchResult.decision})`)

					if (!result.dryRun) {
						const category = torrent.category
							? `${torrent.category}${config.category_suffix}`
							: config.category_suffix.replace(/^_/, '')
						const tags = config.tag || 'cross-seed'

						let savepath = torrent.save_path
						let needsRecheck = !config.skip_recheck

						if (matchResult.decision === CrossSeedDecisionType.MATCH_SIZE_ONLY && config.link_dir) {
							const candidateFilesWithRoot = parseFilesWithPathsFromTorrent(torrentData)
							if (!candidateFilesWithRoot) {
								log.warn(`[CrossSeed] Failed to parse file paths for linking: ${candidate.title}`)
								continue
							}

							const sourceFilesWithPaths = files.map((f) => ({
								name: basename(f.name),
								size: f.size,
								path: torrent.content_path.endsWith(f.name) ? torrent.content_path : join(torrent.content_path, f.name),
							}))

							const canLink = await canCreateHardlink(sourceFilesWithPaths[0]?.path || '', config.link_dir)
							if (!canLink) {
								log.warn(
									`[CrossSeed] Cannot create hardlinks (different filesystem or no write access): ${candidate.title}`
								)
								continue
							}

							const linkResult = await createHardlinks(
								sourceFilesWithPaths,
								candidateFilesWithRoot.files,
								config.link_dir
							)

							if (!linkResult.success) {
								log.error(`[CrossSeed] Failed to create hardlinks: ${linkResult.error}`)
								continue
							}

							savepath = linkResult.destinationDir
							needsRecheck = true
							log.info(`[CrossSeed] Created hardlinks in: ${savepath}`)
						}

						const added = await addTorrentToQbt(instance, loginResult.cookie, torrentData, {
							savepath,
							category,
							tags,
							skipRecheck: !needsRecheck,
							infoHash: candidateInfoHash ?? undefined,
							version: qbtVersion,
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

			upsertSearchee(options.instanceId, torrent.hash, torrent.name, torrent.size, files.length, fileSizesJson)
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

	db.run('UPDATE cross_seed_config SET last_run = ? WHERE instance_id = ?', [
		Math.floor(Date.now() / 1000),
		options.instanceId,
	])

	return result
}
