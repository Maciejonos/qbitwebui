import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { db, type User, REGISTRATION_DISABLED } from '../db'
import { hashPassword, verifyPassword, generateSessionId } from '../utils/crypto'
import { checkRateLimit, resetRateLimit } from '../utils/rateLimit'
import { authMiddleware } from '../middleware/auth'
import { log } from '../utils/logger'

const auth = new Hono()

const SESSION_DURATION = 7 * 24 * 60 * 60

function validatePassword(password: string): string | null {
	if (!password || password.length < 8) {
		return 'Password must be at least 8 characters'
	}
	if (!/[a-z]/.test(password)) {
		return 'Password must contain a lowercase letter'
	}
	if (!/[A-Z]/.test(password)) {
		return 'Password must contain an uppercase letter'
	}
	if (!/[0-9]/.test(password)) {
		return 'Password must contain a number'
	}
	return null
}

auth.post('/register', async (c) => {
	if (REGISTRATION_DISABLED) {
		return c.json({ error: 'Registration is disabled' }, 403)
	}
	const body = await c.req.json<{ username: string; password: string }>()
	const { username, password } = body

	if (!username || username.length < 3 || username.length > 32) {
		return c.json({ error: 'Username must be 3-32 characters' }, 400)
	}
	const passwordError = validatePassword(password)
	if (passwordError) {
		return c.json({ error: passwordError }, 400)
	}

	const existing = db.query<{ id: number }, [string]>(
		'SELECT id FROM users WHERE username = ?'
	).get(username)
	if (existing) {
		return c.json({ error: 'Username already exists' }, 400)
	}

	const passwordHash = await hashPassword(password)
	const result = db.run(
		'INSERT INTO users (username, password_hash) VALUES (?, ?)',
		[username, passwordHash]
	)

	const sessionId = generateSessionId()
	const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION
	db.run(
		'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
		[sessionId, result.lastInsertRowid, expiresAt]
	)

	setCookie(c, 'session', sessionId, {
		httpOnly: true,
		sameSite: 'Lax',
		maxAge: SESSION_DURATION,
		path: '/',
	})

	log.info(`User registered: ${username}`)
	return c.json({ id: result.lastInsertRowid, username }, 201)
})

auth.post('/login', async (c) => {
	const ip = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
	const rateCheck = checkRateLimit(`login:${ip}`)
	if (!rateCheck.allowed) {
		return c.json({ error: `Too many attempts. Try again in ${rateCheck.retryAfter}s` }, 429)
	}

	const body = await c.req.json<{ username: string; password: string }>()
	const { username, password } = body

	const user = db.query<User, [string]>(
		'SELECT id, username, password_hash FROM users WHERE username = ?'
	).get(username)

	if (!user || !(await verifyPassword(password, user.password_hash))) {
		log.warn(`Login failed for user: ${username} from ${ip}`)
		return c.json({ error: 'Invalid credentials' }, 401)
	}

	resetRateLimit(`login:${ip}`)

	const sessionId = generateSessionId()
	const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION
	db.run(
		'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
		[sessionId, user.id, expiresAt]
	)

	setCookie(c, 'session', sessionId, {
		httpOnly: true,
		sameSite: 'Lax',
		maxAge: SESSION_DURATION,
		path: '/',
	})

	log.info(`User logged in: ${user.username}`)
	return c.json({ id: user.id, username: user.username })
})

auth.post('/logout', async (c) => {
	const sessionId = getCookie(c, 'session')
	if (sessionId) {
		db.run('DELETE FROM sessions WHERE id = ?', [sessionId])
	}
	deleteCookie(c, 'session', { path: '/' })
	return c.json({ success: true })
})

auth.get('/me', authMiddleware, (c) => {
	const user = c.get('user')
	return c.json(user)
})

auth.post('/password', authMiddleware, async (c) => {
	const user = c.get('user')
	const body = await c.req.json<{ currentPassword: string; newPassword: string }>()

	const passwordError = validatePassword(body.newPassword)
	if (passwordError) {
		return c.json({ error: passwordError }, 400)
	}

	const dbUser = db.query<User, [number]>(
		'SELECT id, username, password_hash FROM users WHERE id = ?'
	).get(user.id)

	if (!dbUser || !(await verifyPassword(body.currentPassword, dbUser.password_hash))) {
		return c.json({ error: 'Current password is incorrect' }, 400)
	}

	const newHash = await hashPassword(body.newPassword)
	db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id])

	const currentSession = getCookie(c, 'session')
	if (currentSession) {
		db.run('DELETE FROM sessions WHERE user_id = ? AND id != ?', [user.id, currentSession])
	}

	return c.json({ success: true })
})

export default auth
