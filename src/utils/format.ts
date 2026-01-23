export function formatSpeed(bytes: number, showZero = true): string {
	if (bytes === 0 && !showZero) return '—'
	if (bytes < 1024) return `${bytes} B/s`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`
	return `${(bytes / 1024 / 1024).toFixed(2)} MB/s`
}

export function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
	if (bytes < 1024 * 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
	return `${(bytes / 1024 / 1024 / 1024 / 1024).toFixed(2)} TB`
}

export function formatCompactSpeed(bytes: number): string {
	if (bytes === 0) return '-'
	if (bytes < 1024) return `${bytes}B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`
	return `${(bytes / 1024 / 1024).toFixed(1)}M`
}

export function formatCompactSize(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)}M`
	return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}G`
}

export function formatEta(seconds: number): string {
	if (seconds < 0 || seconds === 8640000) return '∞'
	if (seconds < 60) return `${seconds}s`
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
	return `${Math.floor(seconds / 86400)}d`
}

export function formatDate(timestamp: number): string {
	if (timestamp <= 0 || timestamp === -1) return '—'
	return new Date(timestamp * 1000).toLocaleString(undefined, {
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
	})
}

export function formatDuration(seconds: number): string {
	if (seconds < 0) return '—'
	const d = Math.floor(seconds / 86400)
	const h = Math.floor((seconds % 86400) / 3600)
	const m = Math.floor((seconds % 3600) / 60)
	const s = seconds % 60
	if (d > 0) return `${d}d ${h}h ${m}m`
	if (h > 0) return `${h}h ${m}m ${s}s`
	if (m > 0) return `${m}m ${s}s`
	return `${s}s`
}

export function formatRelativeTime(timestamp: number): string {
	if (timestamp <= 0) return 'Never'
	const now = Math.floor(Date.now() / 1000)
	const diff = now - timestamp
	if (diff < 60) return 'Just now'
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
	if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
	return `${Math.floor(diff / 604800)}w ago`
}

export function formatRelativeDate(timestamp: number): string {
	if (!timestamp || timestamp < 0) return '-'
	const date = new Date(timestamp * 1000)
	const now = new Date()
	const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
	if (diffDays === 0) return 'Today'
	if (diffDays === 1) return 'Yesterday'
	if (diffDays < 7) return `${diffDays}d ago`
	return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function normalizeSearch(str: string): string {
	return str.toLowerCase().replace(/[._-]+/g, ' ')
}

export function formatCountdown(timestamp: number | null, fallback = '—'): string {
	if (!timestamp) return fallback
	const diff = timestamp - Math.floor(Date.now() / 1000)
	if (diff <= 0) return 'Now'
	const hours = Math.floor(diff / 3600)
	const mins = Math.floor((diff % 3600) / 60)
	if (hours > 0) return `${hours}h ${mins}m`
	return `${mins}m`
}
