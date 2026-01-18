import type { TorrentFile } from '../types/torrentDetails'

export interface FileTreeNode {
	name: string
	path: string
	isFolder: boolean
	size: number
	progress: number
	priority: 'skip' | 'normal' | 'high' | 'max' | 'mixed'
	availability: number
	children: FileTreeNode[]
	fileIndices: number[]
}

export function buildFileTree(files: TorrentFile[]): FileTreeNode[] {
	const root: FileTreeNode[] = []

	for (let i = 0; i < files.length; i++) {
		const file = files[i]
		const parts = file.name.split('/')
		let currentLevel = root
		let currentPath = ''

		for (let j = 0; j < parts.length; j++) {
			const part = parts[j]
			const isFile = j === parts.length - 1
			currentPath = currentPath ? `${currentPath}/${part}` : part

			let existing = currentLevel.find(n => n.name === part)

			if (!existing) {
				const newNode: FileTreeNode = {
					name: part,
					path: currentPath,
					isFolder: !isFile,
					size: isFile ? file.size : 0,
					progress: isFile ? file.progress : 0,
					priority: isFile ? getPriorityLabel(file.priority) : 'normal',
					availability: isFile ? file.availability : 0,
					children: [],
					fileIndices: isFile ? [i] : [],
				}
				currentLevel.push(newNode)
				existing = newNode
			}

			if (!isFile) {
				existing.fileIndices.push(i)
				existing.size += file.size
				currentLevel = existing.children
			}
		}
	}

	calculateFolderStats(root, files)
	sortNodes(root)

	return root
}

function getPriorityLabel(priority: number): 'skip' | 'normal' | 'high' | 'max' {
	if (priority === 0) return 'skip'
	if (priority === 6) return 'high'
	if (priority === 7) return 'max'
	return 'normal'
}

function calculateFolderStats(nodes: FileTreeNode[], files: TorrentFile[]): void {
	for (const node of nodes) {
		if (node.isFolder) {
			calculateFolderStats(node.children, files)

			let totalSize = 0
			let downloadedSize = 0
			let totalAvailability = 0

			for (const idx of node.fileIndices) {
				const file = files[idx]
				totalSize += file.size
				downloadedSize += file.size * file.progress
				totalAvailability += file.availability
			}

			node.progress = totalSize > 0 ? downloadedSize / totalSize : 0
			node.availability = node.fileIndices.length > 0 ? totalAvailability / node.fileIndices.length : 0

			const priorities = new Set(node.fileIndices.map(idx => files[idx].priority))
			if (priorities.size === 1) {
				node.priority = getPriorityLabel([...priorities][0])
			} else {
				node.priority = 'mixed'
			}
		}
	}
}

function sortNodes(nodes: FileTreeNode[]): void {
	nodes.sort((a, b) => {
		if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
		return a.name.localeCompare(b.name)
	})
	for (const node of nodes) {
		if (node.isFolder) sortNodes(node.children)
	}
}

export function flattenVisibleNodes(
	nodes: FileTreeNode[],
	expanded: Set<string>,
	depth: number = 0
): { node: FileTreeNode; depth: number }[] {
	const result: { node: FileTreeNode; depth: number }[] = []
	for (const node of nodes) {
		result.push({ node, depth })
		if (node.isFolder && expanded.has(node.path)) {
			result.push(...flattenVisibleNodes(node.children, expanded, depth + 1))
		}
	}
	return result
}

export function getInitialExpanded(nodes: FileTreeNode[]): Set<string> {
	const expanded = new Set<string>()

	function expandSingleChildPath(children: FileTreeNode[]) {
		const folders = children.filter(n => n.isFolder)
		if (folders.length === 1) {
			expanded.add(folders[0].path)
			expandSingleChildPath(folders[0].children)
		}
	}

	expandSingleChildPath(nodes)
	return expanded
}
