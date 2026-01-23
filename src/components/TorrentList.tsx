import { useState, useMemo, useEffect, lazy, Suspense } from 'react'
import {
	ChevronUp,
	ChevronDown,
	Plus,
	Play,
	Square,
	Trash2,
	AlertTriangle,
	Settings,
	Maximize2,
	Archive,
} from 'lucide-react'
import type { TorrentFilter, Torrent } from '../types/qbittorrent'
import {
	useTorrents,
	useStopTorrents,
	useStartTorrents,
	useDeleteTorrents,
	useCategories,
	useTags,
} from '../hooks/useTorrents'
import { TorrentRow } from './TorrentRow'
import {
	FilterBar,
	SearchInput,
	CategoryDropdown,
	TagDropdown,
	TrackerDropdown,
	ColumnSelector,
	ManageButton,
} from './FilterBar'
import { ContextMenu } from './ContextMenu'
import { RatioThresholdPopup } from './RatioThresholdPopup'
import { loadRatioThreshold, saveRatioThreshold } from '../utils/ratioThresholds'
import { normalizeSearch } from '../utils/format'
import { COLUMNS, DEFAULT_VISIBLE_COLUMNS, DEFAULT_COLUMN_ORDER, type SortKey } from './columns'
import { usePagination } from '../hooks/usePagination'

const AddTorrentModal = lazy(() => import('./AddTorrentModal').then((m) => ({ default: m.AddTorrentModal })))
const CategoryTagManager = lazy(() => import('./CategoryTagManager').then((m) => ({ default: m.CategoryTagManager })))
const TorrentDetailsPanel = lazy(() =>
	import('./TorrentDetailsPanel').then((m) => ({ default: m.TorrentDetailsPanel }))
)

const DEFAULT_PANEL_HEIGHT = 220

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
	const Icon = asc ? ChevronUp : ChevronDown
	return (
		<Icon
			className="w-3 h-3 transition-colors"
			style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
			strokeWidth={2}
		/>
	)
}

function ActionButton({
	onClick,
	disabled,
	icon: Icon,
	label,
	colorVar,
}: {
	onClick: () => void
	disabled: boolean
	icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
	label: string
	colorVar: string
}) {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			title={label}
			className="p-2 rounded-lg transition-all duration-200 active:scale-95 disabled:cursor-not-allowed"
			style={{ color: disabled ? 'var(--text-muted)' : colorVar, opacity: disabled ? 0.5 : 1 }}
		>
			<Icon className="w-4 h-4" strokeWidth={2} />
		</button>
	)
}

export function TorrentList() {
	const [filter, setFilter] = useState<TorrentFilter>('all')
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
	const [tagFilter, setTagFilter] = useState<string | null>(null)
	const [trackerFilter, setTrackerFilter] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [sortKey, setSortKey] = useState<SortKey>('name')
	const [sortAsc, setSortAsc] = useState(true)
	const [deleteModal, setDeleteModal] = useState(false)
	const [addModal, setAddModal] = useState(false)
	const [panelExpanded, setPanelExpanded] = useState(true)
	const [panelHeight, setPanelHeight] = useState(() => {
		const stored = localStorage.getItem('detailsPanelHeight')
		return stored ? parseInt(stored, 10) : DEFAULT_PANEL_HEIGHT
	})
	const [contextMenu, setContextMenu] = useState<{ x: number; y: number; torrents: Torrent[] } | null>(null)
	const [ratioThreshold, setRatioThreshold] = useState(loadRatioThreshold)
	const [ratioPopupAnchor, setRatioPopupAnchor] = useState<HTMLElement | null>(null)
	const [managerModal, setManagerModal] = useState(false)

	const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
		const stored = localStorage.getItem('visibleColumns')
		if (stored) return new Set(JSON.parse(stored))
		return new Set(DEFAULT_VISIBLE_COLUMNS)
	})

	const [columnOrder, setColumnOrder] = useState<string[]>(() => {
		const stored = localStorage.getItem('columnOrder')
		if (stored) return JSON.parse(stored)
		return DEFAULT_COLUMN_ORDER
	})

	const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
		const stored = localStorage.getItem('columnWidths')
		if (stored) return JSON.parse(stored)
		return {}
	})

	const [resizing, setResizing] = useState<{ id: string; startX: number; startWidth: number } | null>(null)

	function handleColumnChange(next: Set<string>) {
		setVisibleColumns(next)
		localStorage.setItem('visibleColumns', JSON.stringify([...next]))
	}

	function handleColumnReorder(next: string[]) {
		setColumnOrder(next)
		localStorage.setItem('columnOrder', JSON.stringify(next))
	}

	function handleColumnsReset() {
		setVisibleColumns(new Set(DEFAULT_VISIBLE_COLUMNS))
		setColumnOrder(DEFAULT_COLUMN_ORDER)
		localStorage.setItem('visibleColumns', JSON.stringify([...DEFAULT_VISIBLE_COLUMNS]))
		localStorage.setItem('columnOrder', JSON.stringify(DEFAULT_COLUMN_ORDER))
	}

	function handleResetWidths() {
		setColumnWidths({})
		localStorage.removeItem('columnWidths')
	}

	function handleResizeStart(e: React.MouseEvent, columnId: string) {
		e.preventDefault()
		const th = (e.target as HTMLElement).closest('th')
		const startWidth = columnWidths[columnId] || th?.offsetWidth || 100
		setResizing({ id: columnId, startX: e.clientX, startWidth })
	}

	function handleResizeMove(e: React.MouseEvent) {
		if (!resizing) return
		const delta = e.clientX - resizing.startX
		const newWidth = Math.max(60, resizing.startWidth + delta)
		setColumnWidths((prev) => ({ ...prev, [resizing.id]: newWidth }))
	}

	function handleResizeEnd() {
		if (resizing) {
			localStorage.setItem('columnWidths', JSON.stringify(columnWidths))
		}
		setResizing(null)
	}

	const orderedColumns = columnOrder
		.map((id) => COLUMNS.find((c) => c.id === id))
		.filter((c): c is (typeof COLUMNS)[number] => c !== undefined)

	const { data: categories = {} } = useCategories()
	const { data: tags = [] } = useTags()
	const { data: torrents = [], isLoading } = useTorrents({
		filter,
		category: categoryFilter ?? undefined,
	})

	const uniqueTrackers = useMemo(() => {
		const trackers = new Set<string>()
		torrents.forEach((t) => {
			if (t.tracker) trackers.add(t.tracker)
		})
		return [...trackers].sort()
	}, [torrents])
	const stopMutation = useStopTorrents()
	const startMutation = useStartTorrents()
	const deleteMutation = useDeleteTorrents()

	const { page, perPage, setTotalItems, setPage } = usePagination()

	const filtered = useMemo(() => {
		let result = torrents
		if (tagFilter) {
			result = result.filter((t) =>
				t.tags
					.split(',')
					.map((tag) => tag.trim())
					.includes(tagFilter)
			)
		}
		if (trackerFilter) {
			result = result.filter((t) => t.tracker === trackerFilter)
		}
		if (search) {
			const q = normalizeSearch(search)
			result = result.filter((t) => normalizeSearch(t.name).includes(q))
		}
		result = [...result].sort((a, b) => {
			const mul = sortAsc ? 1 : -1
			const valA = a[sortKey]
			const valB = b[sortKey]

			if (typeof valA === 'string' && typeof valB === 'string') {
				return mul * valA.localeCompare(valB)
			}
			if (typeof valA === 'number' && typeof valB === 'number') {
				return mul * (valA - valB)
			}
			return 0
		})
		return result
	}, [torrents, tagFilter, trackerFilter, search, sortKey, sortAsc])

	useEffect(() => {
		setTotalItems(filtered.length)
	}, [filtered.length, setTotalItems])

	useEffect(() => {
		const maxPage = Math.max(1, Math.ceil(filtered.length / perPage))
		if (page > maxPage) setPage(maxPage)
	}, [filtered.length, perPage, page, setPage])

	const paginatedTorrents = useMemo(() => {
		const start = (page - 1) * perPage
		return filtered.slice(start, start + perPage)
	}, [filtered, page, perPage])

	function handleSelect(hash: string, multi: boolean) {
		setSelected((prev) => {
			if (multi) {
				const next = new Set(prev)
				if (next.has(hash)) next.delete(hash)
				else next.add(hash)
				return next
			}
			if (prev.has(hash) && prev.size === 1) return new Set()
			return new Set([hash])
		})
	}

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				setSelected(new Set())
				return
			}
			if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
				e.preventDefault()
				setSelected(new Set(filtered.map((t) => t.hash)))
				return
			}
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				if (filtered.length === 0) return
				e.preventDefault()
				const currentHash = selected.size === 1 ? [...selected][0] : null
				const currentIndex = currentHash ? filtered.findIndex((t) => t.hash === currentHash) : -1
				let nextIndex: number
				if (e.key === 'ArrowDown') {
					nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, filtered.length - 1)
				} else {
					nextIndex = currentIndex < 0 ? filtered.length - 1 : Math.max(currentIndex - 1, 0)
				}
				setSelected(new Set([filtered[nextIndex].hash]))
			}
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [filtered, selected])

	function handleSort(key: SortKey) {
		if (sortKey === key) setSortAsc(!sortAsc)
		else {
			setSortKey(key)
			setSortAsc(true)
		}
	}

	function handleStop() {
		if (selected.size) stopMutation.mutate([...selected])
	}

	function handleStart() {
		if (selected.size) startMutation.mutate([...selected])
	}

	function handleDelete(deleteFiles: boolean) {
		if (selected.size) {
			deleteMutation.mutate({ hashes: [...selected], deleteFiles })
			setSelected(new Set())
		}
		setDeleteModal(false)
	}

	function handleContextMenu(e: React.MouseEvent, torrent: Torrent) {
		e.preventDefault()
		const contextTorrents = selected.has(torrent.hash) ? torrents.filter((t) => selected.has(t.hash)) : [torrent]
		if (!selected.has(torrent.hash)) {
			setSelected(new Set([torrent.hash]))
		}
		setContextMenu({ x: e.clientX, y: e.clientY, torrents: contextTorrents })
	}

	const hasSelection = selected.size > 0
	const selectedHash = selected.size === 1 ? [...selected][0] : null
	const selectedTorrent = selectedHash ? torrents.find((t) => t.hash === selectedHash) : null

	return (
		<div className="flex flex-col flex-1 overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
			<div
				className="flex items-center gap-2 px-4 py-2.5 border-b"
				style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
			>
				<div
					className="flex items-center gap-0.5 p-1 rounded-lg border"
					style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
				>
					<ActionButton
						onClick={() => setAddModal(true)}
						disabled={false}
						label="Add Torrent"
						colorVar="var(--accent)"
						icon={Plus}
					/>
					<div className="w-px h-5 mx-0.5" style={{ backgroundColor: 'var(--border)' }} />
					<ActionButton
						onClick={handleStart}
						disabled={!hasSelection}
						label="Start"
						colorVar="var(--accent)"
						icon={Play}
					/>
					<ActionButton
						onClick={handleStop}
						disabled={!hasSelection}
						label="Stop"
						colorVar="var(--warning)"
						icon={Square}
					/>
					<ActionButton
						onClick={() => setDeleteModal(true)}
						disabled={!hasSelection}
						label="Delete"
						colorVar="var(--error)"
						icon={Trash2}
					/>
				</div>

				<div className="w-px h-6" style={{ backgroundColor: 'var(--border)' }} />

				<div
					className="flex items-center gap-0.5 p-1 rounded-lg border"
					style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
				>
					<FilterBar filter={filter} onFilterChange={setFilter} />
				</div>

				<div
					className="flex items-center gap-0.5 p-1 rounded-lg border"
					style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
				>
					<CategoryDropdown value={categoryFilter} onChange={setCategoryFilter} categories={categories} />
					<div className="w-px h-5" style={{ backgroundColor: 'var(--border)' }} />
					<TagDropdown value={tagFilter} onChange={setTagFilter} tags={tags} />
					<div className="w-px h-5" style={{ backgroundColor: 'var(--border)' }} />
					<TrackerDropdown value={trackerFilter} onChange={setTrackerFilter} trackers={uniqueTrackers} />
					<div className="w-px h-5" style={{ backgroundColor: 'var(--border)' }} />
					<ManageButton onClick={() => setManagerModal(true)} />
					<div className="w-px h-5" style={{ backgroundColor: 'var(--border)' }} />
					<ColumnSelector
						columns={COLUMNS}
						visible={visibleColumns}
						onChange={handleColumnChange}
						columnOrder={columnOrder}
						onReorder={handleColumnReorder}
						onReset={handleColumnsReset}
					/>
				</div>

				<div className="flex-1" />

				<SearchInput value={search} onChange={setSearch} />
			</div>

			<div
				className="flex-1 overflow-auto"
				onMouseMove={handleResizeMove}
				onMouseUp={handleResizeEnd}
				onMouseLeave={handleResizeEnd}
				style={{ cursor: resizing ? 'col-resize' : undefined }}
			>
				{isLoading ? (
					<div className="flex flex-col items-center justify-center h-48 gap-3">
						<div
							className="w-6 h-6 border-2 rounded-full animate-spin"
							style={{
								borderColor: 'color-mix(in srgb, var(--accent) 20%, transparent)',
								borderTopColor: 'var(--accent)',
							}}
						/>
						<span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
							Loading
						</span>
					</div>
				) : filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-48 gap-2">
						<Archive className="w-10 h-10" style={{ color: 'var(--border)' }} strokeWidth={1} />
						<span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
							No torrents
						</span>
					</div>
				) : (
					<table className="w-full table-auto">
						<thead className="sticky top-0 z-10">
							<tr
								className="backdrop-blur-sm border-b"
								style={{
									backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 95%, transparent)',
									borderColor: 'var(--border)',
								}}
							>
								<th
									className="px-4 py-2.5 text-left relative"
									style={columnWidths.name ? { width: columnWidths.name } : undefined}
								>
									<button
										onClick={() => handleSort('name')}
										className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-widest transition-colors"
										style={{ color: 'var(--text-muted)' }}
									>
										Name
										<SortIcon active={sortKey === 'name'} asc={sortAsc} />
									</button>
									<div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'name')} />
								</th>
								{orderedColumns
									.filter((col) => visibleColumns.has(col.id))
									.map((col) => (
										<th
											key={col.id}
											className="px-3 py-2.5 text-left whitespace-nowrap relative"
											style={columnWidths[col.id] ? { width: columnWidths[col.id] } : undefined}
										>
											{col.id === 'ratio' ? (
												<div className="flex items-center gap-1">
													<button
														onClick={() => handleSort('ratio')}
														className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-widest transition-colors"
														style={{ color: 'var(--text-muted)' }}
													>
														Ratio
														<SortIcon active={sortKey === 'ratio'} asc={sortAsc} />
													</button>
													<button
														onClick={(e) => setRatioPopupAnchor(e.currentTarget)}
														className="p-0.5 rounded opacity-50 hover:opacity-100 transition-opacity"
														title="Configure ratio colors"
													>
														<Settings className="w-3 h-3" style={{ color: 'var(--text-muted)' }} strokeWidth={2} />
													</button>
												</div>
											) : col.sortKey ? (
												<button
													onClick={() => handleSort(col.sortKey!)}
													className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-widest transition-colors"
													style={{ color: 'var(--text-muted)' }}
												>
													{col.id === 'dlspeed' && (
														<span
															className="w-2 h-2 rounded-full"
															style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 40%, transparent)' }}
														/>
													)}
													{col.id === 'upspeed' && (
														<span
															className="w-2 h-2 rounded-full"
															style={{ backgroundColor: 'color-mix(in srgb, var(--warning) 40%, transparent)' }}
														/>
													)}
													{col.id === 'dlspeed' || col.id === 'upspeed' ? 'Speed' : col.label}
													<SortIcon active={sortKey === col.sortKey} asc={sortAsc} />
												</button>
											) : (
												<span
													className="text-[9px] font-medium uppercase tracking-widest"
													style={{ color: 'var(--text-muted)' }}
												>
													{col.label}
												</span>
											)}
											<div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, col.id)} />
										</th>
									))}
								{Object.keys(columnWidths).length > 0 && (
									<th className="px-2 py-2.5 w-8">
										<button
											onClick={handleResetWidths}
											className="p-1 rounded opacity-50 hover:opacity-100 transition-opacity"
											title="Reset column widths"
										>
											<Maximize2 className="w-3 h-3" style={{ color: 'var(--text-muted)' }} strokeWidth={2} />
										</button>
									</th>
								)}
							</tr>
						</thead>
						<tbody>
							{paginatedTorrents.map((t) => (
								<TorrentRow
									key={t.hash}
									torrent={t}
									selected={selected.has(t.hash)}
									onSelect={handleSelect}
									onContextMenu={(e) => handleContextMenu(e, t)}
									ratioThreshold={ratioThreshold}
									visibleColumns={visibleColumns}
									columnOrder={columnOrder}
									columnWidths={columnWidths}
									hasCustomWidths={Object.keys(columnWidths).length > 0}
								/>
							))}
						</tbody>
					</table>
				)}
			</div>

			{deleteModal && (
				<div
					className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50"
					style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
				>
					<div className="relative w-full max-w-xs mx-4">
						<div
							className="rounded-xl p-5 border shadow-2xl"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
						>
							<div className="flex items-center gap-3 mb-4">
								<div
									className="w-9 h-9 rounded-lg flex items-center justify-center"
									style={{ backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)' }}
								>
									<AlertTriangle className="w-4 h-4" style={{ color: 'var(--error)' }} strokeWidth={2} />
								</div>
								<div>
									<h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
										Delete
									</h3>
									<p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
										{selected.size} torrent{selected.size > 1 ? 's' : ''}
									</p>
								</div>
							</div>

							<div className="space-y-2">
								<button
									onClick={() => handleDelete(false)}
									className="w-full py-2.5 rounded-lg border text-xs font-medium transition-colors"
									style={{
										backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)',
										borderColor: 'color-mix(in srgb, var(--error) 20%, transparent)',
										color: 'var(--error)',
									}}
								>
									Remove from list
								</button>
								<button
									onClick={() => handleDelete(true)}
									className="w-full py-2.5 rounded-lg text-xs font-medium transition-colors text-white"
									style={{ backgroundColor: 'var(--error)' }}
								>
									Delete with files
								</button>
								<button
									onClick={() => setDeleteModal(false)}
									className="w-full py-2.5 rounded-lg border text-xs font-medium transition-colors"
									style={{
										backgroundColor: 'var(--bg-tertiary)',
										borderColor: 'var(--border)',
										color: 'var(--text-muted)',
									}}
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{addModal && (
				<Suspense fallback={null}>
					<AddTorrentModal open={addModal} onClose={() => setAddModal(false)} />
				</Suspense>
			)}
			{managerModal && (
				<Suspense fallback={null}>
					<CategoryTagManager open={managerModal} onClose={() => setManagerModal(false)} />
				</Suspense>
			)}

			<Suspense fallback={null}>
				<TorrentDetailsPanel
					hash={selectedHash}
					name={selectedTorrent?.name ?? ''}
					expanded={panelExpanded}
					onToggle={() => setPanelExpanded(!panelExpanded)}
					height={panelHeight}
					onHeightChange={setPanelHeight}
				/>
			</Suspense>

			{contextMenu && (
				<ContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					torrents={contextMenu.torrents}
					onClose={() => setContextMenu(null)}
				/>
			)}

			{ratioPopupAnchor && (
				<RatioThresholdPopup
					anchor={ratioPopupAnchor}
					threshold={ratioThreshold}
					onSave={(t) => {
						saveRatioThreshold(t)
						setRatioThreshold(t)
					}}
					onClose={() => setRatioPopupAnchor(null)}
				/>
			)}
		</div>
	)
}
