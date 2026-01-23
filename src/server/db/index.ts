import { Database } from 'bun:sqlite'
import { randomBytes } from 'crypto'

const dbPath = process.env.DATABASE_PATH || './data/qbitwebui.db'

import { mkdirSync } from 'fs'
import { dirname } from 'path'

mkdirSync(dirname(dbPath), { recursive: true })

export const db = new Database(dbPath)
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

db.exec(`
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		created_at INTEGER DEFAULT (unixepoch())
	)
`)

db.exec(`
	CREATE TABLE IF NOT EXISTS instances (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		label TEXT NOT NULL,
		url TEXT NOT NULL,
		qbt_username TEXT,
		qbt_password_encrypted TEXT,
		skip_auth INTEGER DEFAULT 0,
		created_at INTEGER DEFAULT (unixepoch()),
		UNIQUE(user_id, label)
	)
`)

const instanceCols = db.query<{ name: string; notnull: number }, []>(`PRAGMA table_info(instances)`).all()
const hasSkipAuth = instanceCols.some((c) => c.name === 'skip_auth')
const usernameNotNull = instanceCols.find((c) => c.name === 'qbt_username')?.notnull

if (!hasSkipAuth || usernameNotNull) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS instances_new (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			label TEXT NOT NULL,
			url TEXT NOT NULL,
			qbt_username TEXT,
			qbt_password_encrypted TEXT,
			skip_auth INTEGER DEFAULT 0,
			created_at INTEGER DEFAULT (unixepoch()),
			UNIQUE(user_id, label)
		)
	`)
	db.exec(
		`INSERT INTO instances_new SELECT id, user_id, label, url, qbt_username, qbt_password_encrypted, 0, created_at FROM instances`
	)
	db.exec(`DROP TABLE instances`)
	db.exec(`ALTER TABLE instances_new RENAME TO instances`)
}

db.exec(`
	CREATE TABLE IF NOT EXISTS sessions (
		id TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		expires_at INTEGER NOT NULL
	)
`)

db.exec(`
	CREATE TABLE IF NOT EXISTS integrations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		type TEXT NOT NULL,
		label TEXT NOT NULL,
		url TEXT NOT NULL,
		api_key_encrypted TEXT NOT NULL,
		created_at INTEGER DEFAULT (unixepoch()),
		UNIQUE(user_id, label)
	)
`)

db.exec(`
	CREATE TABLE IF NOT EXISTS cross_seed_config (
		instance_id INTEGER PRIMARY KEY REFERENCES instances(id) ON DELETE CASCADE,
		enabled INTEGER DEFAULT 0,
		interval_hours INTEGER DEFAULT 24,
		dry_run INTEGER DEFAULT 1,
		category_suffix TEXT DEFAULT '_cross-seed',
		tag TEXT DEFAULT 'cross-seed',
		skip_recheck INTEGER DEFAULT 0,
		integration_id INTEGER REFERENCES integrations(id) ON DELETE SET NULL,
		last_run INTEGER,
		next_run INTEGER,
		updated_at INTEGER DEFAULT (unixepoch())
	)
`)

const crossSeedCols = db.query<{ name: string }, []>('PRAGMA table_info(cross_seed_config)').all()
if (!crossSeedCols.some((c) => c.name === 'indexer_ids')) {
	db.exec('ALTER TABLE cross_seed_config ADD COLUMN indexer_ids TEXT')
}
if (!crossSeedCols.some((c) => c.name === 'delay_seconds')) {
	db.exec('ALTER TABLE cross_seed_config ADD COLUMN delay_seconds INTEGER DEFAULT 30')
}
if (!crossSeedCols.some((c) => c.name === 'match_mode')) {
	db.exec("ALTER TABLE cross_seed_config ADD COLUMN match_mode TEXT DEFAULT 'strict'")
}
if (!crossSeedCols.some((c) => c.name === 'link_dir')) {
	db.exec('ALTER TABLE cross_seed_config ADD COLUMN link_dir TEXT')
}
if (!crossSeedCols.some((c) => c.name === 'blocklist')) {
	db.exec('ALTER TABLE cross_seed_config ADD COLUMN blocklist TEXT')
}
if (!crossSeedCols.some((c) => c.name === 'include_single_episodes')) {
	db.exec('ALTER TABLE cross_seed_config ADD COLUMN include_single_episodes INTEGER DEFAULT 0')
}

db.exec(`
	CREATE TABLE IF NOT EXISTS cross_seed_searchee (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		instance_id INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
		torrent_hash TEXT NOT NULL,
		torrent_name TEXT NOT NULL,
		total_size INTEGER NOT NULL,
		file_count INTEGER NOT NULL,
		file_sizes TEXT NOT NULL,
		first_searched INTEGER DEFAULT (unixepoch()),
		last_searched INTEGER DEFAULT (unixepoch()),
		UNIQUE(instance_id, torrent_hash)
	)
`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_cross_seed_searchee_instance ON cross_seed_searchee(instance_id)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_cross_seed_searchee_hash ON cross_seed_searchee(torrent_hash)`)

db.exec(`
	CREATE TABLE IF NOT EXISTS cross_seed_decision (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		searchee_id INTEGER NOT NULL REFERENCES cross_seed_searchee(id) ON DELETE CASCADE,
		guid TEXT NOT NULL,
		info_hash TEXT,
		candidate_name TEXT NOT NULL,
		candidate_size INTEGER,
		decision TEXT NOT NULL,
		first_seen INTEGER DEFAULT (unixepoch()),
		last_seen INTEGER DEFAULT (unixepoch()),
		UNIQUE(searchee_id, guid)
	)
`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_cross_seed_decision_searchee ON cross_seed_decision(searchee_id)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_cross_seed_decision_info_hash ON cross_seed_decision(info_hash)`)

db.exec(`
	CREATE TABLE IF NOT EXISTS cross_seed_indexer (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		integration_id INTEGER NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
		indexer_id INTEGER NOT NULL,
		name TEXT,
		status TEXT DEFAULT 'OK',
		retry_after INTEGER,
		UNIQUE(integration_id, indexer_id)
	)
`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_cross_seed_indexer_integration ON cross_seed_indexer(integration_id)`)

export interface User {
	id: number
	username: string
	password_hash: string
	created_at: number
}

export interface Instance {
	id: number
	user_id: number
	label: string
	url: string
	qbt_username: string | null
	qbt_password_encrypted: string | null
	skip_auth: number
	created_at: number
}

export interface Integration {
	id: number
	user_id: number
	type: string
	label: string
	url: string
	api_key_encrypted: string
	created_at: number
}

export const MatchMode = {
	STRICT: 'strict',
	FLEXIBLE: 'flexible',
} as const

export type MatchModeType = (typeof MatchMode)[keyof typeof MatchMode]

export interface CrossSeedConfig {
	instance_id: number
	enabled: number
	interval_hours: number
	dry_run: number
	category_suffix: string
	tag: string
	skip_recheck: number
	integration_id: number | null
	indexer_ids: string | null
	delay_seconds: number
	match_mode: MatchModeType
	link_dir: string | null
	blocklist: string | null
	include_single_episodes: number
	last_run: number | null
	next_run: number | null
	updated_at: number
}

export const IndexerStatus = {
	OK: 'OK',
	RATE_LIMITED: 'RATE_LIMITED',
	UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

export interface CrossSeedIndexer {
	id: number
	integration_id: number
	indexer_id: number
	name: string | null
	status: string
	retry_after: number | null
}

export interface CrossSeedSearchee {
	id: number
	instance_id: number
	torrent_hash: string
	torrent_name: string
	total_size: number
	file_count: number
	file_sizes: string
	first_searched: number
	last_searched: number
}

export interface CrossSeedDecision {
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

export const CrossSeedDecisionType = {
	MATCH: 'MATCH',
	MATCH_SIZE_ONLY: 'MATCH_SIZE_ONLY',
	SIZE_MISMATCH: 'SIZE_MISMATCH',
	FILE_TREE_MISMATCH: 'FILE_TREE_MISMATCH',
	ALREADY_EXISTS: 'ALREADY_EXISTS',
	DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
	NO_DOWNLOAD_LINK: 'NO_DOWNLOAD_LINK',
	BLOCKED_RELEASE: 'BLOCKED_RELEASE',
} as const

export const BlocklistType = {
	NAME: 'name',
	NAME_REGEX: 'nameRegex',
	FOLDER: 'folder',
	FOLDER_REGEX: 'folderRegex',
	CATEGORY: 'category',
	TAG: 'tag',
	TRACKER: 'tracker',
	INFOHASH: 'infoHash',
	SIZE_BELOW: 'sizeBelow',
	SIZE_ABOVE: 'sizeAbove',
	LEGACY: 'legacy',
} as const

export type BlocklistTypeValue = (typeof BlocklistType)[keyof typeof BlocklistType]

function cleanupExpiredSessions() {
	const now = Math.floor(Date.now() / 1000)
	db.run('DELETE FROM sessions WHERE expires_at < ?', [now])
}

cleanupExpiredSessions()
setInterval(cleanupExpiredSessions, 60 * 60 * 1000)

export const AUTH_DISABLED = process.env.DISABLE_AUTH === 'true'
export const REGISTRATION_DISABLED = process.env.DISABLE_REGISTRATION === 'true'

if (AUTH_DISABLED) {
	const guest = db.query<{ id: number }, []>('SELECT id FROM users WHERE id = 1').get()
	if (!guest) {
		db.run('INSERT INTO users (id, username, password_hash) VALUES (1, ?, ?)', ['guest', 'disabled'])
	}
}

export let defaultCredentials: { username: string; password: string } | null = null

function generateSecurePassword(): string {
	const lower = 'abcdefghijklmnopqrstuvwxyz'
	const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
	const digits = '0123456789'
	const all = lower + upper + digits
	const bytes = randomBytes(16)
	let password = ''
	password += lower[bytes[0] % lower.length]
	password += upper[bytes[1] % upper.length]
	password += digits[bytes[2] % digits.length]
	for (let i = 3; i < 16; i++) {
		password += all[bytes[i] % all.length]
	}
	return password
		.split('')
		.sort(() => randomBytes(1)[0] - 128)
		.join('')
}

async function initDefaultAdmin() {
	if (!REGISTRATION_DISABLED || AUTH_DISABLED) return
	const userCount = db.query<{ count: number }, []>('SELECT COUNT(*) as count FROM users').get()
	if (!userCount || userCount.count === 0) {
		const { hashPassword } = await import('../utils/crypto')
		const password = generateSecurePassword()
		const passwordHash = await hashPassword(password)
		db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', ['admin', passwordHash])
		defaultCredentials = { username: 'admin', password }
	}
}

export function clearDefaultCredentials() {
	defaultCredentials = null
}

await initDefaultAdmin()
