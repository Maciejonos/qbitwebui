import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const SALT_PATH = process.env.SALT_PATH || './data/.salt'

let _key: Buffer | null = null

function getKey(): Buffer {
	if (_key) return _key

	const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
	if (!ENCRYPTION_KEY) {
		throw new Error('ENCRYPTION_KEY environment variable is required')
	}
	if (ENCRYPTION_KEY.length < 32) {
		throw new Error('ENCRYPTION_KEY must be at least 32 characters')
	}

	const salt = getOrCreateSalt()
	_key = pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha256')
	return _key
}

function getOrCreateSalt(): Buffer {
	if (existsSync(SALT_PATH)) {
		return readFileSync(SALT_PATH)
	}
	mkdirSync(dirname(SALT_PATH), { recursive: true })
	const salt = randomBytes(32)
	writeFileSync(SALT_PATH, salt)
	return salt
}

export async function hashPassword(password: string): Promise<string> {
	return Bun.password.hash(password, { algorithm: 'bcrypt', cost: 12 })
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return Bun.password.verify(password, hash)
}

export function encrypt(text: string): string {
	const iv = randomBytes(16)
	const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
	const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
	const authTag = cipher.getAuthTag()
	return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decrypt(encrypted: string): string {
	if (!encrypted || typeof encrypted !== 'string') {
		throw new Error('Invalid encrypted data: empty or not a string')
	}

	const parts = encrypted.split(':')
	if (parts.length !== 3) {
		throw new Error('Invalid encrypted data format: expected iv:authTag:data')
	}

	const [ivB64, authTagB64, dataB64] = parts
	if (!ivB64 || !authTagB64 || !dataB64) {
		throw new Error('Invalid encrypted data: missing components')
	}

	try {
		const iv = Buffer.from(ivB64, 'base64')
		const authTag = Buffer.from(authTagB64, 'base64')
		const data = Buffer.from(dataB64, 'base64')
		const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
		decipher.setAuthTag(authTag)
		return decipher.update(data) + decipher.final('utf8')
	} catch {
		throw new Error('Decryption failed: data may be corrupted')
	}
}

export function generateSessionId(): string {
	return randomBytes(32).toString('hex')
}
