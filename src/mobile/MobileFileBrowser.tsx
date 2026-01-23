import { useState, useEffect, useCallback } from 'react'
import {
	ChevronLeft,
	RefreshCw,
	FolderOpen,
	Folder,
	File,
	Download,
	Check,
	Pencil,
	FolderInput,
	Copy,
	Trash2,
} from 'lucide-react'
import {
	listFiles,
	getDownloadUrl,
	checkWritable,
	deleteFiles,
	moveFiles,
	copyFiles,
	renameFile,
	type FileEntry,
} from '../api/files'
import { formatSize } from '../utils/format'

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface Props {
	onBack: () => void
}

export function MobileFileBrowser({ onBack }: Props) {
	const [path, setPath] = useState('/')
	const [files, setFiles] = useState<FileEntry[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [writable, setWritable] = useState(false)
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [selectionMode, setSelectionMode] = useState(false)
	const [showActionSheet, setShowActionSheet] = useState(false)
	const [showFolderPicker, setShowFolderPicker] = useState<'move' | 'copy' | null>(null)
	const [pickerPath, setPickerPath] = useState('/')
	const [pickerFolders, setPickerFolders] = useState<FileEntry[]>([])
	const [pickerLoading, setPickerLoading] = useState(false)
	const [showRenameModal, setShowRenameModal] = useState(false)
	const [renameValue, setRenameValue] = useState('')
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const [actionLoading, setActionLoading] = useState(false)

	useEffect(() => {
		checkWritable().then(setWritable)
	}, [])

	const loadFiles = useCallback(async () => {
		setLoading(true)
		setError('')
		try {
			const data = await listFiles(path)
			setFiles(data)
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to load')
			setFiles([])
		} finally {
			setLoading(false)
		}
	}, [path])

	useEffect(() => {
		loadFiles()
		setSelected(new Set())
		setSelectionMode(false)
	}, [loadFiles])

	useEffect(() => {
		if (showFolderPicker) {
			setPickerLoading(true)
			listFiles(pickerPath)
				.then((files) => setPickerFolders(files.filter((f) => f.isDirectory)))
				.catch(() => setPickerFolders([]))
				.finally(() => setPickerLoading(false))
		}
	}, [showFolderPicker, pickerPath])

	function handleNavigate(name: string) {
		if (selectionMode) return
		setPath(path === '/' ? `/${name}` : `${path}/${name}`)
	}

	function handleBack() {
		const parts = path.split('/').filter(Boolean)
		parts.pop()
		setPath(parts.length ? `/${parts.join('/')}` : '/')
	}

	function getFullPath(name: string) {
		return path === '/' ? `/${name}` : `${path}/${name}`
	}

	function toggleSelect(name: string) {
		const next = new Set(selected)
		if (next.has(name)) next.delete(name)
		else next.add(name)
		setSelected(next)
		if (next.size === 0) setSelectionMode(false)
	}

	function selectAll() {
		if (selected.size === files.length) {
			setSelected(new Set())
			setSelectionMode(false)
		} else {
			setSelected(new Set(files.map((f) => f.name)))
		}
	}

	function startSelection(name: string) {
		setSelectionMode(true)
		setSelected(new Set([name]))
	}

	async function handleDelete() {
		setActionLoading(true)
		setError('')
		try {
			await deleteFiles(Array.from(selected).map(getFullPath))
			setSelected(new Set())
			setSelectionMode(false)
			setShowDeleteConfirm(false)
			setShowActionSheet(false)
			await loadFiles()
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Delete failed')
		} finally {
			setActionLoading(false)
		}
	}

	async function handleMoveOrCopy(destination: string) {
		const mode = showFolderPicker
		setActionLoading(true)
		setError('')
		try {
			const paths = Array.from(selected).map(getFullPath)
			if (mode === 'move') await moveFiles(paths, destination)
			else await copyFiles(paths, destination)
			setSelected(new Set())
			setSelectionMode(false)
			setShowFolderPicker(null)
			setShowActionSheet(false)
			setPickerPath('/')
			await loadFiles()
		} catch (e) {
			setError(e instanceof Error ? e.message : `${mode} failed`)
		} finally {
			setActionLoading(false)
		}
	}

	async function handleRename() {
		if (!renameValue.trim()) return
		const name = Array.from(selected)[0]
		setActionLoading(true)
		setError('')
		try {
			await renameFile(getFullPath(name), renameValue.trim())
			setSelected(new Set())
			setSelectionMode(false)
			setShowRenameModal(false)
			setShowActionSheet(false)
			await loadFiles()
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Rename failed')
		} finally {
			setActionLoading(false)
		}
	}

	function openRename() {
		const name = Array.from(selected)[0]
		setRenameValue(name)
		setShowRenameModal(true)
		setShowActionSheet(false)
	}

	function openFolderPicker(mode: 'move' | 'copy') {
		setPickerPath('/')
		setShowFolderPicker(mode)
		setShowActionSheet(false)
	}

	const pathParts = path.split('/').filter(Boolean)
	const pickerPathParts = pickerPath.split('/').filter(Boolean)

	return (
		<div className="flex flex-col h-full">
			<div className="p-4 space-y-3">
				<div className="flex items-center gap-3">
					<button onClick={onBack} className="p-2 -ml-2 rounded-xl active:bg-[var(--bg-tertiary)]">
						<ChevronLeft className="w-5 h-5" style={{ color: 'var(--text-primary)' }} strokeWidth={2} />
					</button>
					<h2 className="text-lg font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>
						Files
					</h2>
					{selectionMode && (
						<button
							onClick={() => {
								setSelectionMode(false)
								setSelected(new Set())
							}}
							className="text-sm font-medium"
							style={{ color: 'var(--accent)' }}
						>
							Cancel
						</button>
					)}
				</div>

				<div
					className="flex items-center gap-2 p-3 rounded-xl border overflow-x-auto"
					style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
				>
					<button
						onClick={handleBack}
						disabled={path === '/'}
						className="p-1.5 rounded-lg shrink-0 disabled:opacity-30"
						style={{ backgroundColor: 'var(--bg-tertiary)' }}
					>
						<ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} strokeWidth={2} />
					</button>
					<div className="flex items-center text-sm overflow-x-auto scrollbar-none">
						<button
							onClick={() => setPath('/')}
							className="px-1 py-0.5 rounded shrink-0"
							style={{ color: path === '/' ? 'var(--text-primary)' : 'var(--text-muted)' }}
						>
							/
						</button>
						{pathParts.map((part, i) => (
							<div key={i} className="flex items-center shrink-0">
								<button
									onClick={() => setPath(`/${pathParts.slice(0, i + 1).join('/')}`)}
									className="px-1 py-0.5 rounded truncate max-w-[120px]"
									style={{ color: i === pathParts.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}
								>
									{part}
								</button>
								{i < pathParts.length - 1 && <span style={{ color: 'var(--text-muted)' }}>/</span>}
							</div>
						))}
					</div>
					<button
						onClick={loadFiles}
						className="ml-auto p-1.5 rounded-lg shrink-0"
						style={{ backgroundColor: 'var(--bg-tertiary)' }}
					>
						<RefreshCw
							className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
							style={{ color: 'var(--text-secondary)' }}
							strokeWidth={2}
						/>
					</button>
				</div>

				{error && (
					<div
						className="px-4 py-3 rounded-xl text-sm"
						style={{ backgroundColor: 'color-mix(in srgb, var(--error) 15%, transparent)', color: 'var(--error)' }}
					>
						{error}
					</div>
				)}
			</div>

			<div className="flex-1 overflow-y-auto px-4 pb-4">
				{loading && files.length === 0 ? (
					<div className="flex items-center justify-center py-12">
						<div
							className="w-8 h-8 border-2 rounded-full animate-spin"
							style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
						/>
					</div>
				) : files.length === 0 ? (
					<div className="text-center py-12">
						<div
							className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
							style={{ backgroundColor: 'var(--bg-secondary)' }}
						>
							<FolderOpen className="w-8 h-8" style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
						</div>
						<p className="text-sm" style={{ color: 'var(--text-muted)' }}>
							Empty folder
						</p>
					</div>
				) : (
					<div className="space-y-1">
						{selectionMode && writable && (
							<button
								onClick={selectAll}
								className="w-full text-left px-3 py-2 text-sm"
								style={{ color: 'var(--accent)' }}
							>
								{selected.size === files.length ? 'Deselect All' : 'Select All'}
							</button>
						)}
						{files.map((file) => (
							<div
								key={file.name}
								onClick={() => {
									if (selectionMode && writable) toggleSelect(file.name)
									else if (file.isDirectory) handleNavigate(file.name)
								}}
								onContextMenu={(e) => {
									if (writable) {
										e.preventDefault()
										startSelection(file.name)
									}
								}}
								className="flex items-center gap-3 p-3 rounded-xl active:bg-[var(--bg-tertiary)] transition-colors"
								style={{ backgroundColor: selected.has(file.name) ? 'var(--bg-tertiary)' : 'var(--bg-secondary)' }}
							>
								{selectionMode && writable && (
									<div
										className="w-5 h-5 rounded flex items-center justify-center shrink-0 border"
										style={{
											backgroundColor: selected.has(file.name) ? 'var(--accent)' : 'transparent',
											borderColor: selected.has(file.name) ? 'var(--accent)' : 'var(--text-muted)',
										}}
									>
										{selected.has(file.name) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
									</div>
								)}
								{file.isDirectory ? (
									<Folder className="w-5 h-5 shrink-0" style={{ color: 'var(--warning)' }} fill="currentColor" />
								) : (
									<File className="w-5 h-5 shrink-0" style={{ color: 'var(--text-muted)' }} fill="currentColor" />
								)}
								<div className="flex-1 min-w-0">
									<div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
										{file.name}
									</div>
									<div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
										{!file.isDirectory && <span>{formatSize(file.size)}</span>}
										<span>{formatDate(file.modified)}</span>
									</div>
								</div>
								{!selectionMode && (
									<a
										href={getDownloadUrl(getFullPath(file.name))}
										onClick={(e) => e.stopPropagation()}
										className="p-2 rounded-lg shrink-0"
										style={{ backgroundColor: 'var(--bg-tertiary)' }}
									>
										<Download className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} strokeWidth={2} />
									</a>
								)}
							</div>
						))}
					</div>
				)}
			</div>

			{selectionMode && selected.size > 0 && writable && (
				<div
					className="sticky bottom-0 p-4 border-t"
					style={{
						backgroundColor: 'var(--bg-primary)',
						borderColor: 'var(--border)',
						paddingBottom: 'calc(70px + env(safe-area-inset-bottom, 1rem))',
					}}
				>
					<button
						onClick={() => setShowActionSheet(true)}
						className="w-full py-3 rounded-xl text-sm font-medium"
						style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
					>
						Actions ({selected.size} selected)
					</button>
				</div>
			)}

			{showActionSheet && (
				<>
					<div
						className="fixed inset-0 z-50"
						style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
						onClick={() => setShowActionSheet(false)}
					/>
					<div
						className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t"
						style={{
							backgroundColor: 'var(--bg-primary)',
							borderColor: 'var(--border)',
							paddingBottom: 'env(safe-area-inset-bottom, 0px)',
						}}
					>
						<div className="flex justify-center pt-3 pb-2">
							<div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
						</div>
						<div className="px-5 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
							<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
								{selected.size} item{selected.size > 1 ? 's' : ''} selected
							</h3>
						</div>
						<div className="p-4 space-y-2">
							{selected.size === 1 && (
								<button
									onClick={openRename}
									className="w-full flex items-center gap-4 px-4 py-3 rounded-xl active:bg-[var(--bg-tertiary)]"
									style={{ backgroundColor: 'var(--bg-secondary)' }}
								>
									<Pencil className="w-5 h-5" style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
									<span style={{ color: 'var(--text-primary)' }}>Rename</span>
								</button>
							)}
							<button
								onClick={() => openFolderPicker('move')}
								className="w-full flex items-center gap-4 px-4 py-3 rounded-xl active:bg-[var(--bg-tertiary)]"
								style={{ backgroundColor: 'var(--bg-secondary)' }}
							>
								<FolderInput className="w-5 h-5" style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
								<span style={{ color: 'var(--text-primary)' }}>Move to...</span>
							</button>
							<button
								onClick={() => openFolderPicker('copy')}
								className="w-full flex items-center gap-4 px-4 py-3 rounded-xl active:bg-[var(--bg-tertiary)]"
								style={{ backgroundColor: 'var(--bg-secondary)' }}
							>
								<Copy className="w-5 h-5" style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
								<span style={{ color: 'var(--text-primary)' }}>Copy to...</span>
							</button>
							<button
								onClick={() => {
									setShowActionSheet(false)
									setShowDeleteConfirm(true)
								}}
								className="w-full flex items-center gap-4 px-4 py-3 rounded-xl active:bg-[var(--bg-tertiary)]"
								style={{ backgroundColor: 'color-mix(in srgb, var(--error) 10%, var(--bg-secondary))' }}
							>
								<Trash2 className="w-5 h-5" style={{ color: 'var(--error)' }} strokeWidth={1.5} />
								<span style={{ color: 'var(--error)' }}>Delete</span>
							</button>
						</div>
					</div>
				</>
			)}

			{showFolderPicker && (
				<>
					<div
						className="fixed inset-0 z-50"
						style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
						onClick={() => setShowFolderPicker(null)}
					/>
					<div
						className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t max-h-[80vh] flex flex-col"
						style={{
							backgroundColor: 'var(--bg-primary)',
							borderColor: 'var(--border)',
							paddingBottom: 'env(safe-area-inset-bottom, 0px)',
						}}
					>
						<div className="flex justify-center pt-3 pb-2 shrink-0">
							<div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
						</div>
						<div className="px-5 pb-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
							<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
								{showFolderPicker === 'move' ? 'Move to' : 'Copy to'}
							</h3>
						</div>
						<div className="px-4 py-3 border-b shrink-0 overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
							<div className="flex items-center text-sm">
								<button
									onClick={() => setPickerPath('/')}
									className="px-1 py-0.5 rounded shrink-0"
									style={{ color: pickerPath === '/' ? 'var(--text-primary)' : 'var(--text-muted)' }}
								>
									/
								</button>
								{pickerPathParts.map((part, i) => (
									<div key={i} className="flex items-center shrink-0">
										<button
											onClick={() => setPickerPath(`/${pickerPathParts.slice(0, i + 1).join('/')}`)}
											className="px-1 py-0.5 rounded"
											style={{ color: i === pickerPathParts.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}
										>
											{part}
										</button>
										{i < pickerPathParts.length - 1 && <span style={{ color: 'var(--text-muted)' }}>/</span>}
									</div>
								))}
							</div>
						</div>
						<div className="flex-1 overflow-y-auto p-4 min-h-[200px]">
							{pickerLoading ? (
								<div className="flex items-center justify-center py-8">
									<div
										className="w-6 h-6 border-2 rounded-full animate-spin"
										style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
									/>
								</div>
							) : pickerFolders.length === 0 ? (
								<div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
									No subfolders
								</div>
							) : (
								<div className="space-y-1">
									{pickerFolders.map((folder) => (
										<button
											key={folder.name}
											onClick={() =>
												setPickerPath(pickerPath === '/' ? `/${folder.name}` : `${pickerPath}/${folder.name}`)
											}
											className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl active:bg-[var(--bg-tertiary)]"
											style={{ backgroundColor: 'var(--bg-secondary)' }}
										>
											<Folder className="w-5 h-5 shrink-0" style={{ color: 'var(--warning)' }} fill="currentColor" />
											<span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
												{folder.name}
											</span>
										</button>
									))}
								</div>
							)}
						</div>
						<div className="p-4 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
							<button
								onClick={() => handleMoveOrCopy(pickerPath)}
								disabled={actionLoading}
								className="w-full py-3 rounded-xl text-sm font-medium disabled:opacity-50"
								style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
							>
								{actionLoading ? 'Working...' : `${showFolderPicker === 'move' ? 'Move' : 'Copy'} here`}
							</button>
						</div>
					</div>
				</>
			)}

			{showRenameModal && (
				<>
					<div
						className="fixed inset-0 z-50"
						style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
						onClick={() => setShowRenameModal(false)}
					/>
					<div
						className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 rounded-2xl border p-5"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
							Rename
						</h3>
						<input
							type="text"
							value={renameValue}
							onChange={(e) => setRenameValue(e.target.value)}
							className="w-full px-4 py-3 rounded-xl border text-base"
							style={{
								backgroundColor: 'var(--bg-tertiary)',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
							autoFocus
						/>
						<div className="flex gap-3 mt-5">
							<button
								onClick={() => setShowRenameModal(false)}
								className="flex-1 py-3 rounded-xl text-sm font-medium"
								style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
							>
								Cancel
							</button>
							<button
								onClick={handleRename}
								disabled={!renameValue.trim() || actionLoading}
								className="flex-1 py-3 rounded-xl text-sm font-medium disabled:opacity-50"
								style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
							>
								{actionLoading ? 'Renaming...' : 'Rename'}
							</button>
						</div>
					</div>
				</>
			)}

			{showDeleteConfirm && (
				<>
					<div
						className="fixed inset-0 z-50"
						style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
						onClick={() => setShowDeleteConfirm(false)}
					/>
					<div
						className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 rounded-2xl border p-5"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
							Delete Files
						</h3>
						<p className="text-sm" style={{ color: 'var(--text-muted)' }}>
							Delete {selected.size} item{selected.size > 1 ? 's' : ''}? This cannot be undone.
						</p>
						{selected.size <= 3 && (
							<ul className="mt-3 text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
								{Array.from(selected).map((name) => (
									<li key={name} className="truncate">
										• {name}
									</li>
								))}
							</ul>
						)}
						<div className="flex gap-3 mt-5">
							<button
								onClick={() => setShowDeleteConfirm(false)}
								className="flex-1 py-3 rounded-xl text-sm font-medium"
								style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
							>
								Cancel
							</button>
							<button
								onClick={handleDelete}
								disabled={actionLoading}
								className="flex-1 py-3 rounded-xl text-sm font-medium disabled:opacity-50"
								style={{ backgroundColor: 'var(--error)', color: 'white' }}
							>
								{actionLoading ? 'Deleting...' : 'Delete'}
							</button>
						</div>
					</div>
				</>
			)}
		</div>
	)
}
