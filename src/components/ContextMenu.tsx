import { useState, useRef, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import {
	useCategories,
	useTags,
	useStartTorrents,
	useStopTorrents,
	useDeleteTorrents,
	useSetCategory,
	useAddTags,
	useRemoveTags,
	useRenameTorrent,
	useExportTorrents,
} from '../hooks/useTorrents'
import type { Torrent } from '../types/qbittorrent'

interface Props {
	x: number
	y: number
	torrents: Torrent[]
	onClose: () => void
}

type Submenu = 'category' | 'addTag' | 'removeTag' | 'delete' | null

export function ContextMenu({ x, y, torrents, onClose }: Props) {
	const [submenu, setSubmenu] = useState<Submenu>(null)
	const [renaming, setRenaming] = useState(false)
	const [newName, setNewName] = useState('')
	const ref = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	const { data: categories = {} } = useCategories()
	const { data: tags = [] } = useTags()
	const startMutation = useStartTorrents()
	const stopMutation = useStopTorrents()
	const setCategoryMutation = useSetCategory()
	const addTagsMutation = useAddTags()
	const removeTagsMutation = useRemoveTags()
	const renameMutation = useRenameTorrent()
	const deleteMutation = useDeleteTorrents()
	const exportMutation = useExportTorrents()

	const hashes = torrents.map((t) => t.hash)
	const isSingle = torrents.length === 1
	const currentTags = isSingle
		? torrents[0].tags
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean)
		: []

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) onClose()
		}
		function handleEscape(e: KeyboardEvent) {
			if (e.key === 'Escape') onClose()
		}
		document.addEventListener('mousedown', handleClickOutside)
		document.addEventListener('keydown', handleEscape)
		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
			document.removeEventListener('keydown', handleEscape)
		}
	}, [onClose])

	useEffect(() => {
		if (renaming && inputRef.current) {
			inputRef.current.focus()
			inputRef.current.select()
		}
	}, [renaming])

	const menuStyle: React.CSSProperties = {
		position: 'fixed',
		left: Math.min(x, window.innerWidth - 200),
		top: Math.min(y, window.innerHeight - 300),
		backgroundColor: 'var(--bg-tertiary)',
		borderColor: 'var(--border)',
	}

	function handleStart() {
		startMutation.mutate(hashes)
		onClose()
	}

	function handleStop() {
		stopMutation.mutate(hashes)
		onClose()
	}

	function handleSetCategory(category: string) {
		setCategoryMutation.mutate({ hashes, category })
		onClose()
	}

	function handleAddTag(tag: string) {
		addTagsMutation.mutate({ hashes, tags: tag })
		onClose()
	}

	function handleRemoveTag(tag: string) {
		removeTagsMutation.mutate({ hashes, tags: tag })
		onClose()
	}

	function handleRename() {
		if (isSingle && newName.trim()) {
			renameMutation.mutate({ hash: hashes[0], name: newName.trim() })
			onClose()
		}
	}

	function startRename() {
		setNewName(torrents[0].name)
		setRenaming(true)
		setSubmenu(null)
	}

	function handleDelete(deleteFiles: boolean) {
		deleteMutation.mutate({ hashes, deleteFiles })
		onClose()
	}

	function handleExport() {
		exportMutation.mutate(torrents.map((t) => ({ hash: t.hash, name: t.name })))
		onClose()
	}

	if (renaming && isSingle) {
		return (
			<div ref={ref} className="rounded-lg border shadow-xl z-[200] p-3" style={menuStyle}>
				<div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
					Rename torrent
				</div>
				<input
					ref={inputRef}
					type="text"
					value={newName}
					onChange={(e) => setNewName(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') handleRename()
						if (e.key === 'Escape') onClose()
					}}
					className="w-full px-3 py-2 rounded-lg border text-sm mb-2"
					style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
				/>
				<div className="flex gap-2">
					<button
						onClick={onClose}
						className="flex-1 py-1.5 rounded-lg text-xs"
						style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
					>
						Cancel
					</button>
					<button
						onClick={handleRename}
						className="flex-1 py-1.5 rounded-lg text-xs"
						style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
					>
						Rename
					</button>
				</div>
			</div>
		)
	}

	return (
		<div ref={ref} className="rounded-lg border shadow-xl z-[200] py-1 min-w-[160px]" style={menuStyle}>
			<MenuItem onClick={handleStart}>Start</MenuItem>
			<MenuItem onClick={handleStop}>Stop</MenuItem>
			<div className="h-px my-1" style={{ backgroundColor: 'var(--border)' }} />
			<MenuItem onClick={() => setSubmenu(submenu === 'category' ? null : 'category')} hasSubmenu>
				Set Category
			</MenuItem>
			{submenu === 'category' && (
				<div className="pl-2">
					<MenuItem onClick={() => handleSetCategory('')} small>
						None
					</MenuItem>
					{Object.keys(categories).map((cat) => (
						<MenuItem key={cat} onClick={() => handleSetCategory(cat)} small>
							{cat}
						</MenuItem>
					))}
				</div>
			)}
			<MenuItem onClick={() => setSubmenu(submenu === 'addTag' ? null : 'addTag')} hasSubmenu>
				Add Tag
			</MenuItem>
			{submenu === 'addTag' && (
				<div className="pl-2">
					{tags.length === 0 ? (
						<div className="px-3 py-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
							No tags
						</div>
					) : (
						tags.map((tag) => (
							<MenuItem key={tag} onClick={() => handleAddTag(tag)} small>
								{tag}
							</MenuItem>
						))
					)}
				</div>
			)}
			{isSingle && currentTags.length > 0 && (
				<>
					<MenuItem onClick={() => setSubmenu(submenu === 'removeTag' ? null : 'removeTag')} hasSubmenu>
						Remove Tag
					</MenuItem>
					{submenu === 'removeTag' && (
						<div className="pl-2">
							{currentTags.map((tag) => (
								<MenuItem key={tag} onClick={() => handleRemoveTag(tag)} small>
									{tag}
								</MenuItem>
							))}
						</div>
					)}
				</>
			)}
			{isSingle && (
				<>
					<div className="h-px my-1" style={{ backgroundColor: 'var(--border)' }} />
					<MenuItem onClick={startRename}>Rename</MenuItem>
				</>
			)}
			<div className="h-px my-1" style={{ backgroundColor: 'var(--border)' }} />
			<MenuItem onClick={handleExport}>Export</MenuItem>
			<MenuItem onClick={() => setSubmenu(submenu === 'delete' ? null : 'delete')} hasSubmenu>
				Delete
			</MenuItem>
			{submenu === 'delete' && (
				<div className="pl-2">
					<MenuItem onClick={() => handleDelete(false)} small>
						Keep files
					</MenuItem>
					<MenuItem onClick={() => handleDelete(true)} small>
						Delete files
					</MenuItem>
				</div>
			)}
		</div>
	)
}

function MenuItem({
	children,
	onClick,
	hasSubmenu,
	small,
}: {
	children: React.ReactNode
	onClick: () => void
	hasSubmenu?: boolean
	small?: boolean
}) {
	return (
		<button
			onClick={onClick}
			className={`w-full flex items-center justify-between px-3 ${small ? 'py-1' : 'py-1.5'} text-xs text-left transition-colors hover:opacity-80`}
			style={{ color: 'var(--text-primary)', backgroundColor: 'transparent' }}
		>
			<span>{children}</span>
			{hasSubmenu && <ChevronRight className="w-3 h-3" style={{ color: 'var(--text-muted)' }} strokeWidth={2} />}
		</button>
	)
}
