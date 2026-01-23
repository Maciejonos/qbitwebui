import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

const { state, db, fsMocks } = vi.hoisted(() => {
	const state = {
		config: null as null | {
			instance_id: number
			enabled: number
			interval_hours: number
			delay_seconds: number
			dry_run: number
			category_suffix: string
			tag: string
			skip_recheck: number
			integration_id: number | null
			indexer_ids: string | null
			match_mode: 'strict' | 'flexible'
			link_dir: string | null
			blocklist: string | null
			include_single_episodes: number
			last_run: number | null
			next_run: number | null
			updated_at: number
		},
		integration: null as null | {
			id: number
			user_id: number
			type: string
			label: string
			url: string
			api_key_encrypted: string
			created_at: number
		},
		instance: null as null | {
			id: number
			user_id: number
			label: string
			url: string
			qbt_username: string | null
			qbt_password_encrypted: string | null
			skip_auth: number
			created_at: number
		},
		searchees: new Map<string, {
			id: number
			instance_id: number
			torrent_hash: string
			torrent_name: string
			total_size: number
			file_count: number
			file_sizes: string
			first_searched: number
			last_searched: number
		}>(),
		decisions: new Map<string, {
			searchee_id?: number
			guid?: string
			info_hash: string | null
			candidate_name?: string
			candidate_size?: number
			decision: string
			first_seen?: number
			last_seen: number
		}>(),
		nextSearcheeId: 1,
	}

	const db = {
		query: vi.fn((sql: string) => ({
			get: (...params: unknown[]) => {
				if (sql.includes('FROM cross_seed_config')) {
					return state.config && state.config.instance_id === params[0] ? state.config : undefined
				}
				if (sql.includes('FROM integrations')) {
					return state.integration && state.integration.id === params[0] && state.integration.user_id === params[1]
						? state.integration
						: undefined
				}
				if (sql.includes('FROM instances')) {
					return state.instance && state.instance.id === params[0] && state.instance.user_id === params[1]
						? state.instance
						: undefined
				}
				if (sql.includes('FROM cross_seed_searchee') && sql.includes('torrent_hash = ?')) {
					const key = `${params[0]}:${params[1]}`
					const row = state.searchees.get(key)
					return row ? { id: row.id } : undefined
				}
				if (sql.includes('FROM cross_seed_decision') && sql.includes('guid = ?')) {
					return state.decisions.get(`${params[0]}:${params[1]}`)
				}
				return undefined
			},
			all: (...params: unknown[]) => {
				if (sql.includes('FROM cross_seed_searchee')) {
					return Array.from(state.searchees.values()).filter((row) => row.instance_id === params[0])
				}
				return []
			},
		})),
		run: vi.fn((sql: string, params: unknown[]) => {
			if (sql.startsWith('INSERT INTO cross_seed_searchee')) {
				const [instanceId, hash, name, size, fileCount, fileSizesJson] = params
				const key = `${instanceId}:${hash}`
				let row = state.searchees.get(key)
				const now = Math.floor(Date.now() / 1000)
				if (!row) {
					row = {
						id: state.nextSearcheeId++,
						instance_id: instanceId as number,
						torrent_hash: hash as string,
						torrent_name: name as string,
						total_size: size as number,
						file_count: fileCount as number,
						file_sizes: fileSizesJson as string,
						first_searched: now,
						last_searched: now,
					}
				} else {
					row.last_searched = now
				}
				state.searchees.set(key, row)
				return { changes: 1, lastInsertRowid: row.id }
			}
			if (sql.startsWith('INSERT INTO cross_seed_decision')) {
				const [searcheeId, guid, info_hash, candidate_name, candidate_size, decision] = params
				const key = `${searcheeId}:${guid}`
				const now = Math.floor(Date.now() / 1000)
				const existing = state.decisions.get(key)
				if (existing) {
					existing.info_hash = info_hash as string | null
					existing.decision = decision as string
					existing.last_seen = now
				} else {
					state.decisions.set(key, {
						searchee_id: searcheeId as number,
						guid: guid as string,
						info_hash: info_hash as string | null,
						candidate_name: candidate_name as string,
						candidate_size: candidate_size as number,
						decision: decision as string,
						first_seen: now,
						last_seen: now,
					})
				}
				return { changes: 1 }
			}
			if (sql.startsWith('UPDATE cross_seed_decision SET last_seen')) {
				const [lastSeen, searcheeId, guid] = params
				const key = `${searcheeId}:${guid}`
				const entry = state.decisions.get(key)
				if (entry) entry.last_seen = lastSeen as number
				return { changes: entry ? 1 : 0 }
			}
			if (sql.startsWith('UPDATE cross_seed_config SET last_run')) {
				const [lastRun, instanceId] = params
				if (state.config && state.config.instance_id === instanceId) {
					state.config.last_run = lastRun as number
				}
				return { changes: 1 }
			}
			return { changes: 0 }
		}),
	}

	const fsMocks = {
		link: vi.fn().mockResolvedValue(undefined),
		mkdir: vi.fn().mockResolvedValue(undefined),
		stat: vi.fn().mockResolvedValue({ dev: 1 }),
		access: vi.fn().mockResolvedValue(undefined),
	}

	return { state, db, fsMocks }
})

vi.mock('../../src/server/db', () => ({
	db,
	CrossSeedDecisionType: {
		MATCH: 'MATCH',
		MATCH_SIZE_ONLY: 'MATCH_SIZE_ONLY',
		SIZE_MISMATCH: 'SIZE_MISMATCH',
		FILE_COUNT_MISMATCH: 'FILE_COUNT_MISMATCH',
		ALREADY_EXISTS: 'ALREADY_EXISTS',
		DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
		NO_DOWNLOAD_LINK: 'NO_DOWNLOAD_LINK',
	},
	MatchMode: {
		STRICT: 'strict',
		FLEXIBLE: 'flexible',
	},
}))

vi.mock('../../src/server/utils/qbt', () => ({
	loginToQbt: vi.fn(),
}))

vi.mock('../../src/server/utils/crypto', () => ({
	decrypt: vi.fn(() => 'apikey'),
}))

vi.mock('../../src/server/utils/torznab', () => ({
	searchAllIndexers: vi.fn(),
	downloadTorrentDirect: vi.fn(),
}))

vi.mock('../../src/server/utils/crossSeedCache', () => ({
	cacheTorrent: vi.fn(),
	saveTorrentToOutput: vi.fn(() => '/tmp/output.torrent'),
}))

vi.mock('fs/promises', () => ({
	...fsMocks,
	default: fsMocks,
}))

vi.mock('../../src/server/utils/fetch', () => ({
	fetchWithTls: vi.fn(),
}))

vi.mock('../../src/server/utils/logger', () => ({
	log: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}))

import { runCrossSeedScan } from '../../src/server/utils/crossSeedWorker'
import { loginToQbt } from '../../src/server/utils/qbt'
import { searchAllIndexers, downloadTorrentDirect } from '../../src/server/utils/torznab'
import { cacheTorrent, saveTorrentToOutput } from '../../src/server/utils/crossSeedCache'
import { fetchWithTls } from '../../src/server/utils/fetch'

const mockLoginToQbt = loginToQbt as Mock
const mockSearchAllIndexers = searchAllIndexers as Mock
const mockDownloadTorrentDirect = downloadTorrentDirect as Mock
const mockCacheTorrent = cacheTorrent as Mock
const mockSaveTorrentToOutput = saveTorrentToOutput as Mock
const mockFetchWithTls = fetchWithTls as Mock

function makeTorrentData(name: string, length: number): Buffer {
	return Buffer.from(`d4:infod4:name${name.length}:${name}6:lengthi${length}eee`)
}

type BencodeValue = number | string | Buffer | BencodeValue[] | { [key: string]: BencodeValue }

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
	const parts: Buffer[] = [Buffer.from('d')]
	const keys = Object.keys(data).sort()
	for (const key of keys) {
		parts.push(encodeBencode(key))
		parts.push(encodeBencode(data[key]))
	}
	parts.push(Buffer.from('e'))
	return Buffer.concat(parts)
}

function makeMultiFileTorrentData(
	name: string,
	files: Array<{ path: string[]; length: number }>
): Buffer {
	return encodeBencode({
		info: {
			name,
			files: files.map((file) => ({ length: file.length, path: file.path })),
		},
	})
}

function resetState() {
	state.config = {
		instance_id: 1,
		enabled: 1,
		interval_hours: 24,
		delay_seconds: 0,
		dry_run: 0,
		category_suffix: '_cross-seed',
		tag: 'cross-seed',
		skip_recheck: 0,
		integration_id: 10,
		indexer_ids: null,
		match_mode: 'strict',
		link_dir: null,
		blocklist: null,
		include_single_episodes: 0,
		last_run: null,
		next_run: null,
		updated_at: Math.floor(Date.now() / 1000),
	}
	state.integration = {
		id: 10,
		user_id: 1,
		type: 'prowlarr',
		label: 'Prowlarr',
		url: 'http://prowlarr',
		api_key_encrypted: 'encrypted',
		created_at: Math.floor(Date.now() / 1000),
	}
	state.instance = {
		id: 1,
		user_id: 1,
		label: 'QBT',
		url: 'http://qbt',
		qbt_username: 'user',
		qbt_password_encrypted: 'pass',
		skip_auth: 0,
		created_at: Math.floor(Date.now() / 1000),
	}
	state.searchees.clear()
	state.decisions.clear()
	state.nextSearcheeId = 1
}

function mockQbtResponses(torrents: unknown[], files: unknown[]) {
	let addedTorrent = false
	mockFetchWithTls.mockImplementation((url: string) => {
		if (url.endsWith('/api/v2/app/version')) {
			return Promise.resolve(new Response('v5.0.0', { status: 200 }))
		}
		if (url.includes('/api/v2/torrents/info')) {
			const hashMatch = url.match(/hashes=([a-fA-F0-9]+)/)
			if (hashMatch) {
				const queriedHash = hashMatch[1].toUpperCase()
				const found = (torrents as { hash: string }[]).find((t) => t.hash.toUpperCase() === queriedHash)
				if (found) {
					return Promise.resolve(new Response(JSON.stringify([found]), { status: 200 }))
				}
				if (addedTorrent) {
					return Promise.resolve(
						new Response(
							JSON.stringify([
								{
									hash: queriedHash,
									name: 'Added',
									state: 'pausedUP',
									amount_left: 0,
								},
							]),
							{ status: 200 }
						)
					)
				}
				return Promise.resolve(new Response('[]', { status: 200 }))
			}
			return Promise.resolve(new Response(JSON.stringify(torrents), { status: 200 }))
		}
		if (url.includes('/api/v2/torrents/files')) {
			return Promise.resolve(new Response(JSON.stringify(files), { status: 200 }))
		}
		if (url.endsWith('/api/v2/torrents/add')) {
			addedTorrent = true
			return Promise.resolve(new Response('Ok.', { status: 200 }))
		}
		if (url.includes('/api/v2/torrents/stop') || url.includes('/api/v2/torrents/start') || url.includes('/api/v2/torrents/recheck')) {
			return Promise.resolve(new Response('', { status: 200 }))
		}
		return Promise.resolve(new Response('Not Found', { status: 404 }))
	})
}

describe('crossSeedWorker', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		resetState()
		mockLoginToQbt.mockResolvedValue({ success: true, cookie: 'SID=abc' })
	})

	it('adds a matched torrent when not dry-run', async () => {
		const torrents = [
			{
				hash: 'HASH1',
				name: 'Movie.2024.1080p.mkv',
				size: 1000,
				state: 'uploading',
				category: 'movies',
				tags: '',
				save_path: '/downloads',
				content_path: '/downloads/Movie.2024.1080p.mkv',
				progress: 1,
			},
		]
		const files = [{ name: 'Movie.2024.1080p.mkv', size: 1000 }]
		mockQbtResponses(torrents, files)

		mockSearchAllIndexers.mockResolvedValue([
			{
				guid: 'guid-1',
				title: 'Movie 2024 1080p',
				link: 'http://indexer/download/1',
				size: 1000,
				pubDate: '',
				indexer: 'Test',
				indexerId: 1,
			},
		])

		mockDownloadTorrentDirect.mockResolvedValue(makeTorrentData('Movie.2024.1080p.mkv', 1000))

		const result = await runCrossSeedScan({ instanceId: 1, userId: 1, force: false })

		expect(result.matchesFound).toBe(1)
		expect(result.torrentsAdded).toBe(1)
		expect(result.torrentsScanned).toBe(1)
		expect(result.torrentsSkipped).toBe(0)
		expect(mockCacheTorrent).toHaveBeenCalledTimes(1)
		expect(mockSaveTorrentToOutput).not.toHaveBeenCalled()
		expect(mockFetchWithTls.mock.calls.some((call) => String(call[0]).endsWith('/api/v2/torrents/add'))).toBe(true)
	})

	it('matches multi-file torrents in strict mode using basenames', async () => {
		state.config!.match_mode = 'strict'

		const torrents = [
			{
				hash: 'HASH2',
				name: 'Show.S01',
				size: 3000,
				state: 'uploading',
				category: 'shows',
				tags: '',
				save_path: '/downloads',
				content_path: '/downloads/Show.S01',
				progress: 1,
			},
		]
		const files = [
			{ name: 'Show.S01/E01.mkv', size: 1000 },
			{ name: 'Show.S01/E02.mkv', size: 2000 },
		]
		mockQbtResponses(torrents, files)

		mockSearchAllIndexers.mockResolvedValue([
			{
				guid: 'guid-2',
				title: 'Show S01',
				link: 'http://indexer/download/2',
				size: 3000,
				pubDate: '',
				indexer: 'Test',
				indexerId: 1,
			},
		])

		mockDownloadTorrentDirect.mockResolvedValue(
			makeMultiFileTorrentData('Show.S01', [
				{ path: ['Show.S01', 'E01.mkv'], length: 1000 },
				{ path: ['Show.S01', 'E02.mkv'], length: 2000 },
			])
		)

		const result = await runCrossSeedScan({ instanceId: 1, userId: 1, force: false })

		expect(result.matchesFound).toBe(1)
		expect(result.torrentsAdded).toBe(1)
		expect(mockFetchWithTls.mock.calls.some((call) => String(call[0]).endsWith('/api/v2/torrents/add'))).toBe(true)
	})

	it('adds size-only matches in flexible mode using hardlinks', async () => {
		state.config!.match_mode = 'flexible'
		state.config!.link_dir = '/links'

		const torrents = [
			{
				hash: 'HASH3',
				name: 'Movie.2024.1080p.mkv',
				size: 1000,
				state: 'uploading',
				category: 'movies',
				tags: '',
				save_path: '/downloads',
				content_path: '/downloads/Movie.2024.1080p.mkv',
				progress: 1,
			},
		]
		const files = [{ name: 'Movie.2024.1080p.mkv', size: 1000 }]
		mockQbtResponses(torrents, files)

		mockSearchAllIndexers.mockResolvedValue([
			{
				guid: 'guid-3',
				title: 'Movie 2024 1080p',
				link: 'http://indexer/download/3',
				size: 1000,
				pubDate: '',
				indexer: 'Test',
				indexerId: 1,
			},
		])

		mockDownloadTorrentDirect.mockResolvedValue(makeTorrentData('Movie.2024.1080p.REPACK.mkv', 1000))

		const result = await runCrossSeedScan({ instanceId: 1, userId: 1, force: false })

		expect(result.matchesFound).toBe(1)
		expect(result.torrentsAdded).toBe(1)
		expect(fsMocks.link.mock.calls.length).toBeGreaterThan(0)
		expect(fsMocks.link.mock.calls[0][0]).toBe('/downloads/Movie.2024.1080p.mkv')
		expect(fsMocks.link.mock.calls[0][1]).toBe('/links/Movie.2024.1080p.REPACK.mkv')
	})

	it('saves to output in dry-run mode', async () => {
		state.config!.dry_run = 1

		const torrents = [
			{
				hash: 'HASH1',
				name: 'Movie.2024.1080p.mkv',
				size: 1000,
				state: 'uploading',
				category: 'movies',
				tags: '',
				save_path: '/downloads',
				content_path: '/downloads/Movie.2024.1080p.mkv',
				progress: 1,
			},
		]
		const files = [{ name: 'Movie.2024.1080p.mkv', size: 1000 }]
		mockQbtResponses(torrents, files)

		mockSearchAllIndexers.mockResolvedValue([
			{
				guid: 'guid-1',
				title: 'Movie 2024 1080p',
				link: 'http://indexer/download/1',
				size: 1000,
				pubDate: '',
				indexer: 'Test',
				indexerId: 1,
			},
		])
		mockDownloadTorrentDirect.mockResolvedValue(makeTorrentData('Movie.2024.1080p.mkv', 1000))

		const result = await runCrossSeedScan({ instanceId: 1, userId: 1, force: false })

		expect(result.matchesFound).toBe(1)
		expect(result.torrentsAdded).toBe(0)
		expect(mockSaveTorrentToOutput).toHaveBeenCalledTimes(1)
		expect(mockFetchWithTls.mock.calls.some((call) => String(call[0]).endsWith('/api/v2/torrents/add'))).toBe(false)
	})

	it('skips torrents that were already searched when not forced', async () => {
		state.searchees.set('1:HASH1', {
			id: 1,
			instance_id: 1,
			torrent_hash: 'HASH1',
			torrent_name: 'Movie',
			total_size: 1000,
			file_count: 1,
			file_sizes: '[1000]',
			first_searched: 0,
			last_searched: 0,
		})

		const torrents = [
			{
				hash: 'HASH1',
				name: 'Movie.2024.1080p.mkv',
				size: 1000,
				state: 'uploading',
				category: 'movies',
				tags: '',
				save_path: '/downloads',
				content_path: '/downloads/Movie.2024.1080p.mkv',
				progress: 1,
			},
		]
		mockQbtResponses(torrents, [])

		const result = await runCrossSeedScan({ instanceId: 1, userId: 1, force: false })

		expect(result.torrentsSkipped).toBe(1)
		expect(result.torrentsScanned).toBe(0)
		expect(mockSearchAllIndexers).not.toHaveBeenCalled()
		expect(mockDownloadTorrentDirect).not.toHaveBeenCalled()
	})

	it('skips candidates already in the client by infohash', async () => {
		const torrents = [
			{
				hash: 'HASH1',
				name: 'Movie.2024.1080p.mkv',
				size: 1000,
				state: 'uploading',
				category: 'movies',
				tags: '',
				save_path: '/downloads',
				content_path: '/downloads/Movie.2024.1080p.mkv',
				progress: 1,
			},
			{
				hash: 'EXISTING',
				name: 'Already added',
				size: 1000,
				state: 'uploading',
				category: 'movies',
				tags: '',
				save_path: '/downloads',
				content_path: '/downloads/Already added',
				progress: 0.5,
			},
		]
		mockQbtResponses(torrents, [{ name: 'Movie.2024.1080p.mkv', size: 1000 }])

		mockSearchAllIndexers.mockResolvedValue([
			{
				guid: 'guid-1',
				title: 'Movie 2024 1080p',
				link: 'http://indexer/download/1',
				size: 1000,
				pubDate: '',
				indexer: 'Test',
				indexerId: 1,
				infoHash: 'EXISTING',
			},
		])

		const result = await runCrossSeedScan({ instanceId: 1, userId: 1, force: true })

		expect(result.matchesFound).toBe(0)
		expect(mockDownloadTorrentDirect).not.toHaveBeenCalled()
	})

	it('passes configured indexer ids to search', async () => {
		state.config!.indexer_ids = JSON.stringify([5, 9])

		const torrents = [
			{
				hash: 'HASH1',
				name: 'Movie.2024.1080p.mkv',
				size: 1000,
				state: 'uploading',
				category: 'movies',
				tags: '',
				save_path: '/downloads',
				content_path: '/downloads/Movie.2024.1080p.mkv',
				progress: 1,
			},
		]
		const files = [{ name: 'Movie.2024.1080p.mkv', size: 1000 }]
		mockQbtResponses(torrents, files)

		mockSearchAllIndexers.mockResolvedValue([])

		await runCrossSeedScan({ instanceId: 1, userId: 1, force: false })

		expect(mockSearchAllIndexers).toHaveBeenCalledWith('http://prowlarr', 'apikey', 'Movie 2024 1080p', 10, [5, 9])
	})

	it('returns error when qBittorrent login fails', async () => {
		mockLoginToQbt.mockResolvedValueOnce({ success: false, error: 'bad credentials' })

		const result = await runCrossSeedScan({ instanceId: 1, userId: 1, force: false })

		expect(result.errors[0]).toContain('qBittorrent login failed')
		expect(mockFetchWithTls).not.toHaveBeenCalled()
	})

	it('returns error when qBittorrent torrent list fetch fails', async () => {
		mockFetchWithTls.mockImplementation((url: string) => {
			if (url.endsWith('/api/v2/app/version')) {
				return Promise.resolve(new Response('v5.0.0', { status: 200 }))
			}
			if (url.includes('/api/v2/torrents/info')) {
				return Promise.resolve(new Response('fail', { status: 500 }))
			}
			return Promise.resolve(new Response('Not Found', { status: 404 }))
		})

		const result = await runCrossSeedScan({ instanceId: 1, userId: 1, force: false })

		expect(result.errors[0]).toContain('Failed to fetch torrents from qBittorrent')
		expect(mockSearchAllIndexers).not.toHaveBeenCalled()
	})

	it('records search errors when torznab search throws', async () => {
		const torrents = [
			{
				hash: 'HASH1',
				name: 'Movie.2024.1080p.mkv',
				size: 1000,
				state: 'uploading',
				category: 'movies',
				tags: '',
				save_path: '/downloads',
				content_path: '/downloads/Movie.2024.1080p.mkv',
				progress: 1,
			},
		]
		const files = [{ name: 'Movie.2024.1080p.mkv', size: 1000 }]
		mockQbtResponses(torrents, files)

		mockSearchAllIndexers.mockRejectedValueOnce(new Error('torznab down'))

		const result = await runCrossSeedScan({ instanceId: 1, userId: 1, force: false })

		expect(result.errors[0]).toContain('Search failed for Movie.2024.1080p.mkv')
		expect(result.matchesFound).toBe(0)
	})

	it('records add failure when qBittorrent rejects the torrent', async () => {
		const torrents = [
			{
				hash: 'HASH1',
				name: 'Movie.2024.1080p.mkv',
				size: 1000,
				state: 'uploading',
				category: 'movies',
				tags: '',
				save_path: '/downloads',
				content_path: '/downloads/Movie.2024.1080p.mkv',
				progress: 1,
			},
		]
		const files = [{ name: 'Movie.2024.1080p.mkv', size: 1000 }]

		mockFetchWithTls.mockImplementation((url: string) => {
			if (url.endsWith('/api/v2/torrents/info')) {
				return Promise.resolve(new Response(JSON.stringify(torrents), { status: 200 }))
			}
			if (url.includes('/api/v2/torrents/files')) {
				return Promise.resolve(new Response(JSON.stringify(files), { status: 200 }))
			}
			if (url.endsWith('/api/v2/torrents/add')) {
				return Promise.resolve(new Response('Nope', { status: 200 }))
			}
			return Promise.resolve(new Response('Not Found', { status: 404 }))
		})

		mockSearchAllIndexers.mockResolvedValue([
			{
				guid: 'guid-1',
				title: 'Movie 2024 1080p',
				link: 'http://indexer/download/1',
				size: 1000,
				pubDate: '',
				indexer: 'Test',
				indexerId: 1,
			},
		])
		mockDownloadTorrentDirect.mockResolvedValue(makeTorrentData('Movie.2024.1080p.mkv', 1000))

		const result = await runCrossSeedScan({ instanceId: 1, userId: 1, force: false })

		expect(result.matchesFound).toBe(1)
		expect(result.torrentsAdded).toBe(0)
		expect(result.errors[0]).toContain('Failed to add torrent: Movie 2024 1080p')
	})

	it('updates last_seen for existing decisions', async () => {
		state.searchees.set('1:HASH1', {
			id: 1,
			instance_id: 1,
			torrent_hash: 'HASH1',
			torrent_name: 'Movie',
			total_size: 1000,
			file_count: 1,
			file_sizes: '[1000]',
			first_searched: 0,
			last_searched: 0,
		})
		state.decisions.set('1:guid-1', {
			decision: 'SIZE_MISMATCH',
			info_hash: null,
			last_seen: 100,
		})

		const torrents = [
			{
				hash: 'HASH1',
				name: 'Movie.2024.1080p.mkv',
				size: 1000,
				state: 'uploading',
				category: 'movies',
				tags: '',
				save_path: '/downloads',
				content_path: '/downloads/Movie.2024.1080p.mkv',
				progress: 1,
			},
		]
		const files = [{ name: 'Movie.2024.1080p.mkv', size: 1000 }]
		mockQbtResponses(torrents, files)

		mockSearchAllIndexers.mockResolvedValue([
			{
				guid: 'guid-1',
				title: 'Movie 2024 1080p',
				link: 'http://indexer/download/1',
				size: 1000,
				pubDate: '',
				indexer: 'Test',
				indexerId: 1,
			},
		])
		mockDownloadTorrentDirect.mockResolvedValue(makeTorrentData('Movie.2024.1080p.mkv', 2000))

		await runCrossSeedScan({ instanceId: 1, userId: 1, force: true })

		const updated = state.decisions.get('1:guid-1')
		expect(updated?.last_seen).toBeGreaterThan(100)
	})
})
