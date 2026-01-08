export interface FileEntry {
	name: string
	size: number
	isDirectory: boolean
	modified: number
}

export async function listFiles(path: string): Promise<FileEntry[]> {
	const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`, {
		credentials: 'include',
	})
	if (!res.ok) {
		const error = await res.json()
		throw new Error(error.error || 'Failed to list files')
	}
	return res.json()
}

export function getDownloadUrl(path: string): string {
	return `/api/files/download?path=${encodeURIComponent(path)}`
}

export async function checkWritable(): Promise<boolean> {
	const res = await fetch('/api/files/writable', { credentials: 'include' })
	if (!res.ok) return false
	const data = await res.json()
	return data.writable
}

export async function deleteFiles(paths: string[]): Promise<void> {
	const res = await fetch('/api/files/delete', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({ paths }),
	})
	if (!res.ok) {
		const error = await res.json()
		throw new Error(error.error || 'Failed to delete files')
	}
}

export async function moveFiles(paths: string[], destination: string): Promise<void> {
	const res = await fetch('/api/files/move', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({ paths, destination }),
	})
	if (!res.ok) {
		const error = await res.json()
		throw new Error(error.error || 'Failed to move files')
	}
}

export async function copyFiles(paths: string[], destination: string): Promise<void> {
	const res = await fetch('/api/files/copy', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({ paths, destination }),
	})
	if (!res.ok) {
		const error = await res.json()
		throw new Error(error.error || 'Failed to copy files')
	}
}

export async function renameFile(path: string, newName: string): Promise<void> {
	const res = await fetch('/api/files/rename', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({ path, newName }),
	})
	if (!res.ok) {
		const error = await res.json()
		throw new Error(error.error || 'Failed to rename file')
	}
}
