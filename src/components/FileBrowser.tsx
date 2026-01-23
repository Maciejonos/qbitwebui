import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, RefreshCw, Folder, File, Download, Check, X } from 'lucide-react'
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
	return new Date(timestamp).toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

interface FolderPickerProps {
	title: string
	onConfirm: (destination: string) => void
	onCancel: () => void
}

function FolderPicker({ title, onConfirm, onCancel }: FolderPickerProps) {
	const [pickerPath, setPickerPath] = useState('/')
	const [folders, setFolders] = useState<FileEntry[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		let cancelled = false
		listFiles(pickerPath)
			.then((files) => {
				if (!cancelled) setFolders(files.filter((f) => f.isDirectory))
			})
			.catch(() => {
				if (!cancelled) setFolders([])
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [pickerPath])

	function navigateTo(newPath: string) {
		setLoading(true)
		setPickerPath(newPath)
	}

	const pathParts = pickerPath.split('/').filter(Boolean)

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
			<div
				className="w-full max-w-md rounded-lg border shadow-xl"
				style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
					<h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
						{title}
					</h3>
					<button onClick={onCancel} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
						<X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} strokeWidth={2} />
					</button>
				</div>
				<div className="p-4 space-y-3">
					<div className="flex items-center gap-1 text-sm overflow-x-auto pb-2" style={{ color: 'var(--text-muted)' }}>
						<button
							onClick={() => navigateTo('/')}
							className="px-1 py-0.5 rounded hover:bg-[var(--bg-tertiary)] shrink-0"
							style={{ color: pickerPath === '/' ? 'var(--text-primary)' : 'var(--text-muted)' }}
						>
							/
						</button>
						{pathParts.map((part, i) => (
							<div key={i} className="flex items-center shrink-0">
								<button
									onClick={() => navigateTo(`/${pathParts.slice(0, i + 1).join('/')}`)}
									className="px-1 py-0.5 rounded hover:bg-[var(--bg-tertiary)]"
									style={{ color: i === pathParts.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}
								>
									{part}
								</button>
								<span>/</span>
							</div>
						))}
					</div>
					<div
						className="h-64 overflow-y-auto rounded-md border"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						{loading ? (
							<div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>
								Loading...
							</div>
						) : folders.length === 0 ? (
							<div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>
								No subfolders
							</div>
						) : (
							<div className="p-2 space-y-1">
								{folders.map((folder) => (
									<button
										key={folder.name}
										onClick={() => navigateTo(pickerPath === '/' ? `/${folder.name}` : `${pickerPath}/${folder.name}`)}
										className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-[var(--bg-tertiary)]"
										style={{ color: 'var(--text-primary)' }}
									>
										<Folder className="w-4 h-4 shrink-0" style={{ color: 'var(--warning)' }} fill="currentColor" />
										{folder.name}
									</button>
								))}
							</div>
						)}
					</div>
				</div>
				<div className="flex justify-end gap-2 p-4 border-t" style={{ borderColor: 'var(--border)' }}>
					<button
						onClick={onCancel}
						className="px-4 py-2 rounded-md text-sm font-medium"
						style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
					>
						Cancel
					</button>
					<button
						onClick={() => onConfirm(pickerPath)}
						className="px-4 py-2 rounded-md text-sm font-medium border"
						style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--accent)', color: 'var(--accent)' }}
					>
						Select "{pickerPath}"
					</button>
				</div>
			</div>
		</div>
	)
}

export function FileBrowser() {
	const [path, setPath] = useState('/')
	const [files, setFiles] = useState<FileEntry[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [writable, setWritable] = useState(false)
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [folderPickerMode, setFolderPickerMode] = useState<'move' | 'copy' | null>(null)
	const [renameTarget, setRenameTarget] = useState<string | null>(null)
	const [renameValue, setRenameValue] = useState('')
	const [deleteConfirm, setDeleteConfirm] = useState(false)
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
			setError(e instanceof Error ? e.message : 'Failed to load files')
			setFiles([])
		} finally {
			setLoading(false)
		}
	}, [path])

	useEffect(() => {
		loadFiles()
		setSelected(new Set())
	}, [loadFiles])

	function handleNavigate(name: string) {
		setPath(path === '/' ? `/${name}` : `${path}/${name}`)
	}

	function handleBack() {
		const parts = path.split('/').filter(Boolean)
		parts.pop()
		setPath(parts.length ? `/${parts.join('/')}` : '/')
	}

	function handleBreadcrumb(index: number) {
		const parts = path.split('/').filter(Boolean)
		setPath(index === -1 ? '/' : `/${parts.slice(0, index + 1).join('/')}`)
	}

	function getFullPath(name: string) {
		return path === '/' ? `/${name}` : `${path}/${name}`
	}

	function toggleSelect(name: string) {
		const next = new Set(selected)
		if (next.has(name)) next.delete(name)
		else next.add(name)
		setSelected(next)
	}

	function toggleSelectAll() {
		if (selected.size === files.length) setSelected(new Set())
		else setSelected(new Set(files.map((f) => f.name)))
	}

	async function handleDelete() {
		setError('')
		setActionLoading(true)
		try {
			await deleteFiles(Array.from(selected).map(getFullPath))
			setSelected(new Set())
			setDeleteConfirm(false)
			await loadFiles()
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Delete failed')
		} finally {
			setActionLoading(false)
		}
	}

	async function handleMoveOrCopy(destination: string) {
		const mode = folderPickerMode
		setError('')
		setActionLoading(true)
		try {
			const paths = Array.from(selected).map(getFullPath)
			if (mode === 'move') await moveFiles(paths, destination)
			else await copyFiles(paths, destination)
			setSelected(new Set())
			setFolderPickerMode(null)
			await loadFiles()
		} catch (e) {
			setError(e instanceof Error ? e.message : `${mode} failed`)
		} finally {
			setActionLoading(false)
		}
	}

	async function handleRename() {
		if (!renameTarget || !renameValue.trim()) return
		setError('')
		setActionLoading(true)
		try {
			await renameFile(getFullPath(renameTarget), renameValue.trim())
			setRenameTarget(null)
			setRenameValue('')
			await loadFiles()
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Rename failed')
		} finally {
			setActionLoading(false)
		}
	}

	function openRename() {
		const name = Array.from(selected)[0]
		setRenameTarget(name)
		setRenameValue(name)
	}

	const pathParts = path.split('/').filter(Boolean)

	return (
		<div className="space-y-4">
			<div
				className="flex items-center gap-2 p-3 rounded-lg border"
				style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
			>
				<button
					onClick={handleBack}
					disabled={path === '/'}
					className="p-1.5 rounded-md transition-colors disabled:opacity-30"
					style={{ backgroundColor: 'var(--bg-tertiary)' }}
				>
					<ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} strokeWidth={2} />
				</button>
				<div className="flex items-center text-sm overflow-x-auto">
					<button
						onClick={() => handleBreadcrumb(-1)}
						className="px-1 py-1 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"
						style={{ color: path === '/' ? 'var(--text-primary)' : 'var(--text-muted)' }}
					>
						/
					</button>
					{pathParts.map((part, i) => (
						<div key={i} className="flex items-center shrink-0">
							<button
								onClick={() => handleBreadcrumb(i)}
								className="px-1 py-1 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
								style={{ color: i === pathParts.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}
							>
								{part}
							</button>
							<span style={{ color: 'var(--text-muted)' }}>/</span>
						</div>
					))}
				</div>
				<button
					onClick={loadFiles}
					className="ml-auto p-1.5 rounded-md transition-colors"
					style={{ backgroundColor: 'var(--bg-tertiary)' }}
					title="Refresh"
				>
					<RefreshCw
						className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
						style={{ color: 'var(--text-secondary)' }}
						strokeWidth={2}
					/>
				</button>
			</div>

			{writable && selected.size > 0 && (
				<div
					className="flex items-center gap-2 p-3 rounded-lg border"
					style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
				>
					<span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
						{selected.size} selected
					</span>
					<div className="ml-auto flex items-center gap-2">
						{selected.size === 1 && (
							<button
								onClick={openRename}
								disabled={actionLoading}
								className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 border"
								style={{
									backgroundColor: 'var(--bg-primary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							>
								Rename
							</button>
						)}
						<button
							onClick={() => setFolderPickerMode('move')}
							disabled={actionLoading}
							className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 border"
							style={{
								backgroundColor: 'var(--bg-primary)',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
						>
							Move
						</button>
						<button
							onClick={() => setFolderPickerMode('copy')}
							disabled={actionLoading}
							className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 border"
							style={{
								backgroundColor: 'var(--bg-primary)',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
						>
							Copy
						</button>
						<button
							onClick={() => setDeleteConfirm(true)}
							disabled={actionLoading}
							className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
							style={{ backgroundColor: 'color-mix(in srgb, var(--error) 15%, transparent)', color: 'var(--error)' }}
						>
							Delete
						</button>
					</div>
				</div>
			)}

			{error && (
				<div
					className="p-4 rounded-lg text-sm"
					style={{ backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)', color: 'var(--error)' }}
				>
					{error}
				</div>
			)}

			<div
				className="rounded-lg border overflow-hidden"
				style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
			>
				<table className="w-full">
					<thead>
						<tr className="border-b" style={{ borderColor: 'var(--border)' }}>
							{writable && (
								<th className="w-10 px-3 py-3">
									<div
										onClick={toggleSelectAll}
										className="w-4 h-4 rounded flex items-center justify-center cursor-pointer border"
										style={{
											backgroundColor:
												files.length > 0 && selected.size === files.length ? 'var(--accent)' : 'transparent',
											borderColor:
												files.length > 0 && selected.size === files.length ? 'var(--accent)' : 'var(--text-muted)',
										}}
									>
										{files.length > 0 && selected.size === files.length && (
											<Check className="w-3 h-3 text-white" strokeWidth={3} />
										)}
									</div>
								</th>
							)}
							<th
								className="text-left px-4 py-3 text-[10px] font-medium uppercase tracking-wider"
								style={{ color: 'var(--text-muted)' }}
							>
								Name
							</th>
							<th
								className="text-right px-4 py-3 text-[10px] font-medium uppercase tracking-wider w-28"
								style={{ color: 'var(--text-muted)' }}
							>
								Size
							</th>
							<th
								className="text-right px-4 py-3 text-[10px] font-medium uppercase tracking-wider w-44"
								style={{ color: 'var(--text-muted)' }}
							>
								Modified
							</th>
							<th className="w-16"></th>
						</tr>
					</thead>
					<tbody>
						{loading && files.length === 0 ? (
							<tr>
								<td
									colSpan={writable ? 5 : 4}
									className="px-4 py-8 text-center text-sm"
									style={{ color: 'var(--text-muted)' }}
								>
									Loading...
								</td>
							</tr>
						) : files.length === 0 ? (
							<tr>
								<td
									colSpan={writable ? 5 : 4}
									className="px-4 py-8 text-center text-sm"
									style={{ color: 'var(--text-muted)' }}
								>
									Empty directory
								</td>
							</tr>
						) : (
							files.map((file) => (
								<tr
									key={file.name}
									className="border-b last:border-b-0 hover:bg-[var(--bg-tertiary)] transition-colors"
									style={{ borderColor: 'var(--border)' }}
								>
									{writable && (
										<td className="px-3 py-2.5">
											<div
												onClick={() => toggleSelect(file.name)}
												className="w-4 h-4 rounded flex items-center justify-center cursor-pointer border"
												style={{
													backgroundColor: selected.has(file.name) ? 'var(--accent)' : 'transparent',
													borderColor: selected.has(file.name) ? 'var(--accent)' : 'var(--text-muted)',
												}}
											>
												{selected.has(file.name) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
											</div>
										</td>
									)}
									<td className="px-4 py-2.5">
										{file.isDirectory ? (
											<button
												onClick={() => handleNavigate(file.name)}
												className="flex items-center gap-2 text-sm hover:underline"
												style={{ color: 'var(--text-primary)' }}
											>
												<Folder className="w-4 h-4 shrink-0" style={{ color: 'var(--warning)' }} fill="currentColor" />
												<span className="truncate">{file.name}</span>
											</button>
										) : (
											<div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
												<File className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} fill="currentColor" />
												<span className="truncate">{file.name}</span>
											</div>
										)}
									</td>
									<td className="px-4 py-2.5 text-right text-sm tabular-nums" style={{ color: 'var(--text-muted)' }}>
										{file.isDirectory ? '—' : formatSize(file.size)}
									</td>
									<td className="px-4 py-2.5 text-right text-sm tabular-nums" style={{ color: 'var(--text-muted)' }}>
										{formatDate(file.modified)}
									</td>
									<td className="px-4 py-2.5 text-right">
										<a
											href={getDownloadUrl(path === '/' ? `/${file.name}` : `${path}/${file.name}`)}
											className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
											style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
											title={file.isDirectory ? 'Download as .tar' : 'Download'}
										>
											<Download className="w-3.5 h-3.5" strokeWidth={2} />
										</a>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{folderPickerMode && (
				<FolderPicker
					title={folderPickerMode === 'move' ? 'Move to...' : 'Copy to...'}
					onConfirm={handleMoveOrCopy}
					onCancel={() => setFolderPickerMode(null)}
				/>
			)}

			{renameTarget && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
					onClick={() => setRenameTarget(null)}
				>
					<div
						className="w-full max-w-sm rounded-lg border shadow-xl"
						style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
							<h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
								Rename
							</h3>
						</div>
						<div className="p-4">
							<input
								type="text"
								value={renameValue}
								onChange={(e) => setRenameValue(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && handleRename()}
								className="w-full px-3 py-2 rounded-md border text-sm"
								style={{
									backgroundColor: 'var(--bg-secondary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
								autoFocus
							/>
						</div>
						<div className="flex justify-end gap-2 p-4 border-t" style={{ borderColor: 'var(--border)' }}>
							<button
								onClick={() => setRenameTarget(null)}
								className="px-4 py-2 rounded-md text-sm font-medium"
								style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
							>
								Cancel
							</button>
							<button
								onClick={handleRename}
								disabled={!renameValue.trim() || renameValue === renameTarget || actionLoading}
								className="px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
								style={{ backgroundColor: 'var(--accent)', color: 'white' }}
							>
								Rename
							</button>
						</div>
					</div>
				</div>
			)}

			{deleteConfirm && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
					onClick={() => setDeleteConfirm(false)}
				>
					<div
						className="w-full max-w-sm rounded-lg border shadow-xl"
						style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
							<h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
								Confirm Delete
							</h3>
						</div>
						<div className="p-4">
							<p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
								Delete {selected.size} item{selected.size > 1 ? 's' : ''}? This cannot be undone.
							</p>
							{selected.size <= 5 && (
								<ul className="mt-3 text-sm space-y-1" style={{ color: 'var(--text-muted)' }}>
									{Array.from(selected).map((name) => (
										<li key={name} className="truncate">
											• {name}
										</li>
									))}
								</ul>
							)}
						</div>
						<div className="flex justify-end gap-2 p-4 border-t" style={{ borderColor: 'var(--border)' }}>
							<button
								onClick={() => setDeleteConfirm(false)}
								className="px-4 py-2 rounded-md text-sm font-medium"
								style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
							>
								Cancel
							</button>
							<button
								onClick={handleDelete}
								disabled={actionLoading}
								className="px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
								style={{ backgroundColor: 'var(--error)', color: 'white' }}
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
