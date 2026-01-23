export interface LogEntry {
	timestamp: string
	level: 'INFO' | 'WARN' | 'ERROR'
	message: string
}

const MAX_LOG_ENTRIES = 500
const logBuffer: LogEntry[] = []

const timestamp = () => new Date().toISOString()

function addToBuffer(level: LogEntry['level'], msg: string) {
	const entry: LogEntry = { timestamp: timestamp(), level, message: msg }
	logBuffer.push(entry)
	if (logBuffer.length > MAX_LOG_ENTRIES) {
		logBuffer.shift()
	}
}

export const log = {
	info: (msg: string) => {
		addToBuffer('INFO', msg)
		console.log(`[${timestamp()}] [INFO] ${msg}`)
	},
	warn: (msg: string) => {
		addToBuffer('WARN', msg)
		console.warn(`[${timestamp()}] [WARN] ${msg}`)
	},
	error: (msg: string) => {
		addToBuffer('ERROR', msg)
		console.error(`[${timestamp()}] [ERROR] ${msg}`)
	},
}

export function getLogs(filter?: string, limit = 100): LogEntry[] {
	let entries = logBuffer
	if (filter) {
		entries = entries.filter((e) => e.message.includes(filter))
	}
	return entries.slice(-limit)
}

export function clearLogs(): void {
	logBuffer.length = 0
}
