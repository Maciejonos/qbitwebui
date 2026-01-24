import { useState, useRef, useCallback } from 'react'
import { Save, Trash2, Pencil, Check, X, Eye } from 'lucide-react'
import type { CustomView, CustomViewsStorage } from '../types/views'
import { useClickOutside } from '../hooks/useClickOutside'

interface ViewSelectorProps {
	views: CustomViewsStorage
	isModified: boolean
	onViewSelect: (viewId: string | null) => void
	onSave: () => void
	onSaveAs: (name: string) => void
	onRename: (viewId: string, name: string) => void
	onDelete: (viewId: string) => void
}

export function ViewSelector({
	views,
	isModified,
	onViewSelect,
	onSave,
	onSaveAs,
	onRename,
	onDelete,
}: ViewSelectorProps) {
	const [open, setOpen] = useState(false)
	const [saveAsMode, setSaveAsMode] = useState(false)
	const [newName, setNewName] = useState('')
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editName, setEditName] = useState('')
	const ref = useRef<HTMLDivElement>(null)
	const closeDropdown = useCallback(() => {
		setOpen(false)
		setSaveAsMode(false)
		setEditingId(null)
	}, [])
	useClickOutside(ref, closeDropdown)

	const activeView = views.activeViewId ? views.views.find((v) => v.id === views.activeViewId) : null

	function handleSaveAs() {
		const trimmed = newName.trim()
		if (!trimmed) return
		onSaveAs(trimmed)
		setNewName('')
		setSaveAsMode(false)
		setOpen(false)
	}

	function handleRename(view: CustomView) {
		const trimmed = editName.trim()
		if (!trimmed) return
		onRename(view.id, trimmed)
		setEditingId(null)
	}

	function startEdit(view: CustomView, e: React.MouseEvent) {
		e.stopPropagation()
		setEditingId(view.id)
		setEditName(view.name)
	}

	const displayName = activeView?.name ?? 'View'

	return (
		<div ref={ref} className="relative flex items-center">
			<button
				onClick={() => setOpen(!open)}
				title={activeView?.name ?? 'Default View'}
				className="flex items-center gap-1.5 px-2 py-1 rounded transition-all duration-150"
				style={{
					color: views.activeViewId ? 'var(--accent)' : 'var(--text-muted)',
					backgroundColor: views.activeViewId ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
				}}
			>
				<Eye className="w-3.5 h-3.5" strokeWidth={2} />
				<span className="text-[10px] font-medium max-w-[60px] truncate">
					{displayName}
					{isModified && views.activeViewId ? '*' : ''}
				</span>
			</button>

			{views.activeViewId && isModified && (
				<button
					onClick={onSave}
					className="flex items-center justify-center w-6 h-6 rounded transition-all duration-150 hover:opacity-80"
					style={{ color: 'var(--accent)' }}
					title="Save view"
				>
					<Save className="w-3 h-3" strokeWidth={2} />
				</button>
			)}

			{open && (
				<div
					className="absolute top-full left-0 mt-1 min-w-[200px] max-h-[400px] overflow-auto rounded border shadow-xl z-[100]"
					style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
				>
					<button
						onClick={() => {
							onViewSelect(null)
							setOpen(false)
						}}
						className="w-full flex items-center px-2.5 py-1.5 text-xs text-left transition-colors"
						style={{
							color: !views.activeViewId ? 'var(--accent)' : 'var(--text-muted)',
							backgroundColor: !views.activeViewId
								? 'color-mix(in srgb, var(--accent) 10%, transparent)'
								: 'transparent',
						}}
					>
						Default View
					</button>

					{views.views.length > 0 && <div className="border-t" style={{ borderColor: 'var(--border)' }} />}

					{views.views.map((view) => (
						<div
							key={view.id}
							className="flex items-center group"
							style={{
								backgroundColor:
									views.activeViewId === view.id ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
							}}
						>
							{editingId === view.id ? (
								<div className="flex-1 flex items-center gap-1 px-2 py-1">
									<input
										type="text"
										value={editName}
										onChange={(e) => setEditName(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === 'Enter') handleRename(view)
											if (e.key === 'Escape') setEditingId(null)
										}}
										className="flex-1 px-2 py-1 rounded text-xs border"
										style={{
											backgroundColor: 'var(--bg-secondary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
										autoFocus
									/>
									<button
										onClick={() => handleRename(view)}
										className="p-1 rounded transition-colors hover:opacity-80"
										style={{ color: 'var(--accent)' }}
									>
										<Check className="w-3 h-3" strokeWidth={2} />
									</button>
									<button
										onClick={() => setEditingId(null)}
										className="p-1 rounded transition-colors hover:opacity-80"
										style={{ color: 'var(--text-muted)' }}
									>
										<X className="w-3 h-3" strokeWidth={2} />
									</button>
								</div>
							) : (
								<>
									<button
										onClick={() => {
											onViewSelect(view.id)
											setOpen(false)
										}}
										className="flex-1 px-2.5 py-1.5 text-xs text-left transition-colors truncate"
										style={{
											color: views.activeViewId === view.id ? 'var(--accent)' : 'var(--text-muted)',
										}}
									>
										{view.name}
									</button>
									<button
										onClick={(e) => startEdit(view, e)}
										className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
										style={{ color: 'var(--text-muted)' }}
										title="Rename"
									>
										<Pencil className="w-3 h-3" strokeWidth={2} />
									</button>
									<button
										onClick={(e) => {
											e.stopPropagation()
											onDelete(view.id)
										}}
										className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
										style={{ color: 'var(--error)' }}
										title="Delete"
									>
										<Trash2 className="w-3 h-3" strokeWidth={2} />
									</button>
								</>
							)}
						</div>
					))}

					<div className="border-t" style={{ borderColor: 'var(--border)' }} />

					{saveAsMode ? (
						<div className="flex items-center gap-1 px-2 py-1.5">
							<input
								type="text"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') handleSaveAs()
									if (e.key === 'Escape') setSaveAsMode(false)
								}}
								placeholder="View name..."
								className="flex-1 px-2 py-1 rounded text-xs border"
								style={{
									backgroundColor: 'var(--bg-secondary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
								autoFocus
							/>
							<button
								onClick={handleSaveAs}
								disabled={!newName.trim()}
								className="p-1 rounded transition-colors hover:opacity-80 disabled:opacity-40"
								style={{ color: 'var(--accent)' }}
							>
								<Check className="w-3 h-3" strokeWidth={2} />
							</button>
							<button
								onClick={() => setSaveAsMode(false)}
								className="p-1 rounded transition-colors hover:opacity-80"
								style={{ color: 'var(--text-muted)' }}
							>
								<X className="w-3 h-3" strokeWidth={2} />
							</button>
						</div>
					) : (
						<button
							onClick={() => setSaveAsMode(true)}
							className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors hover:opacity-80"
							style={{ color: 'var(--accent)' }}
						>
							<Save className="w-3 h-3" strokeWidth={2} />
							Save current as...
						</button>
					)}
				</div>
			)}
		</div>
	)
}
