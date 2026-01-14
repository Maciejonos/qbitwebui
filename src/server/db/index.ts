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
const hasSkipAuth = instanceCols.some(c => c.name === 'skip_auth')
const usernameNotNull = instanceCols.find(c => c.name === 'qbt_username')?.notnull

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
	db.exec(`INSERT INTO instances_new SELECT id, user_id, label, url, qbt_username, qbt_password_encrypted, 0, created_at FROM instances`)
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
	return password.split('').sort(() => randomBytes(1)[0] - 128).join('')
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
