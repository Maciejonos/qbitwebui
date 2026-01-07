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
