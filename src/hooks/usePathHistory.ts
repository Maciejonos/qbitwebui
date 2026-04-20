import { useCallback } from 'react'

const STORAGE_KEY = 'qbit-path-history'
const MAX_ENTRIES = 50

function getHistory(): string[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return []
		const parsed = JSON.parse(raw)
		return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : []
	} catch {
		return []
	}
}

function saveHistory(paths: string[]) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(paths.slice(0, MAX_ENTRIES)))
}

export function usePathHistory() {
	const addPath = useCallback((path: string) => {
		const trimmed = path.trim()
		if (!trimmed) return
		const history = getHistory().filter((p) => p !== trimmed)
		history.unshift(trimmed)
		saveHistory(history)
	}, [])

	const getSuggestions = useCallback((input: string): string[] => {
		const history = getHistory()
		if (!input) return history.slice(0, 5)
		const lower = input.toLowerCase()
		return history.filter((p) => p.toLowerCase().includes(lower))
	}, [])

	return { addPath, getSuggestions }
}

