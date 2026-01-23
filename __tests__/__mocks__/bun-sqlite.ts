import { vi } from 'vitest'

export class Database {
	exec = vi.fn()
	run = vi.fn(() => ({ changes: 0, lastInsertRowid: 0 }))
	query = vi.fn(() => ({
		get: vi.fn(),
		all: vi.fn(() => []),
	}))
	close = vi.fn()
}
