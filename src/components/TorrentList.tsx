import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react'
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
import type { CustomView, CustomViewsStorage } from '../types/views'
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
import { ViewSelector } from './ViewSelector'
import { ContextMenu } from './ContextMenu'
import { RatioThresholdPopup } from './RatioThresholdPopup'
import { DateSettingsPopup } from './DateSettingsPopup'
import { loadRatioThreshold, saveRatioThreshold } from '../utils/ratioThresholds'
import { loadHideAddedTime, saveHideAddedTime } from '../utils/dateSettings'
import { loadCustomViews, saveCustomViews, createView, viewsAreEqual } from '../utils/customViews'
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
			className="flex items-center justify-center w-7 h-7 rounded transition-all duration-150 active:scale-95 disabled:cursor-not-allowed"
			style={{ color: disabled ? 'var(--text-muted)' : colorVar, opacity: disabled ? 0.5 : 1 }}
		>
			<Icon className="w-3.5 h-3.5" strokeWidth={2} />
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
	const [lastSelected, setLastSelected] = useState<string | null>(null)
	const [sortKey, setSortKey] = useState<SortKey>(() => {
		const stored = localStorage.getItem('sortKey')
		if (stored && COLUMNS.some((c) => c.sortKey === stored || stored === 'name')) return stored as SortKey
		return 'name'
	})
	const [sortAsc, setSortAsc] = useState(() => {
		const stored = localStorage.getItem('sortAsc')
		return stored !== null ? stored === 'true' : true
	})
	const [deleteModal, setDeleteModal] = useState(false)
	const [addModal, setAddModal] = useState(false)
	const [panelExpanded, setPanelExpanded] = useState(false)
	const [panelHeight, setPanelHeight] = useState(() => {
		const stored = localStorage.getItem('detailsPanelHeight')
		return stored ? parseInt(stored, 10) : DEFAULT_PANEL_HEIGHT
	})
	const [contextMenu, setContextMenu] = useState<{ x: number; y: number; torrents: Torrent[] } | null>(null)
	const [ratioThreshold, setRatioThreshold] = useState(loadRatioThreshold)
	const [ratioPopupAnchor, setRatioPopupAnchor] = useState<HTMLElement | null>(null)
	const [hideAddedTime, setHideAddedTime] = useState(loadHideAddedTime)
	const [datePopupAnchor, setDatePopupAnchor] = useState<HTMLElement | null>(null)
	const [managerModal, setManagerModal] = useState(false)
	const [customViews, setCustomViews] = useState<CustomViewsStorage>(loadCustomViews)

	const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
		const stored = localStorage.getItem('visibleColumns')
		if (stored) return new Set(JSON.parse(stored))
		return new Set(DEFAULT_VISIBLE_COLUMNS)
	})

	const [columnOrder, setColumnOrder] = useState<string[]>(() => {
		const stored = localStorage.getItem('columnOrder')
		if (stored) {
			const parsed = JSON.parse(stored)
			if (Array.isArray(parsed)) {
				const known = new Set(COLUMNS.map((c) => c.id))
				const cleaned = parsed.filter((id) => known.has(id))
				const missing = DEFAULT_COLUMN_ORDER.filter((id) => !cleaned.includes(id))
				const merged = [...cleaned, ...missing]
				if (missing.length > 0 || cleaned.length !== parsed.length) {
					localStorage.setItem('columnOrder', JSON.stringify(merged))
				}
				return merged
			}
		}
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

	const getCurrentViewState = useCallback(
		() => ({
			sortKey,
			sortAsc,
			visibleColumns,
			columnOrder,
			columnWidths,
			filter,
			categoryFilter,
			tagFilter,
			trackerFilter,
			search,
		}),
		[
			sortKey,
			sortAsc,
			visibleColumns,
			columnOrder,
			columnWidths,
			filter,
			categoryFilter,
			tagFilter,
			trackerFilter,
			search,
		]
	)

	const isViewModified = useMemo(() => {
		const activeView = customViews.activeViewId
			? customViews.views.find((v) => v.id === customViews.activeViewId)
			: null
		if (!activeView) return false
		return !viewsAreEqual(activeView, getCurrentViewState())
	}, [customViews, getCurrentViewState])

	function applyView(view: CustomView | null) {
		if (!view) {
			setSortKey('name')
			setSortAsc(true)
			setVisibleColumns(new Set(DEFAULT_VISIBLE_COLUMNS))
			setColumnOrder(DEFAULT_COLUMN_ORDER)
			setColumnWidths({})
			setFilter('all')
			setCategoryFilter(null)
			setTagFilter(null)
			setTrackerFilter(null)
			setSearch('')
			localStorage.setItem('sortKey', 'name')
			localStorage.setItem('sortAsc', 'true')
			localStorage.setItem('visibleColumns', JSON.stringify([...DEFAULT_VISIBLE_COLUMNS]))
			localStorage.setItem('columnOrder', JSON.stringify(DEFAULT_COLUMN_ORDER))
			localStorage.removeItem('columnWidths')
			return
		}
		setSortKey(view.sortKey)
		setSortAsc(view.sortAsc)
		setVisibleColumns(new Set(view.visibleColumns))
		setColumnOrder(view.columnOrder)
		setColumnWidths(view.columnWidths)
		setFilter(view.filter)
		setCategoryFilter(view.categoryFilter)
		setTagFilter(view.tagFilter)
		setTrackerFilter(view.trackerFilter)
		setSearch(view.search)
	}

	function handleViewSelect(viewId: string | null) {
		const view = viewId ? customViews.views.find((v) => v.id === viewId) : null
		applyView(view ?? null)
		const updated = { ...customViews, activeViewId: viewId }
		setCustomViews(updated)
		saveCustomViews(updated)
	}

	function handleSaveView() {
		if (!customViews.activeViewId) return
		const updated = {
			...customViews,
			views: customViews.views.map((v) =>
				v.id === customViews.activeViewId
					? { ...createView(v.name, getCurrentViewState()), id: v.id, createdAt: v.createdAt }
					: v
			),
		}
		setCustomViews(updated)
		saveCustomViews(updated)
	}

	function handleSaveViewAs(name: string) {
		const newView = createView(name, getCurrentViewState())
		const updated = {
			views: [...customViews.views, newView],
			activeViewId: newView.id,
		}
		setCustomViews(updated)
		saveCustomViews(updated)
	}

	function handleRenameView(viewId: string, name: string) {
		const updated = {
			...customViews,
			views: customViews.views.map((v) => (v.id === viewId ? { ...v, name, updatedAt: Date.now() } : v)),
		}
		setCustomViews(updated)
		saveCustomViews(updated)
	}

	function handleDeleteView(viewId: string) {
		const updated = {
			views: customViews.views.filter((v) => v.id !== viewId),
			activeViewId: customViews.activeViewId === viewId ? null : customViews.activeViewId,
		}
		if (customViews.activeViewId === viewId) {
			applyView(null)
		}
		setCustomViews(updated)
		saveCustomViews(updated)
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
		const maxPage = Math.max(1, Math.ceil(filtered.length / perPage))
		if (page > maxPage) setPage(maxPage)
	}, [filtered.length, perPage, page, setPage, setTotalItems])

	const paginatedTorrents = useMemo(() => {
		const start = (page - 1) * perPage
		return filtered.slice(start, start + perPage)
	}, [filtered, page, perPage])

	function handleSelect(hash: string, multi: boolean, range: boolean) {
		if (range && lastSelected && filtered.some((t) => t.hash === lastSelected)) {
			const idx1 = filtered.findIndex((t) => t.hash === lastSelected)
			const idx2 = filtered.findIndex((t) => t.hash === hash)
			if (idx1 !== -1 && idx2 !== -1) {
				const start = Math.min(idx1, idx2)
				const end = Math.max(idx1, idx2)
				const rangeHashes = filtered.slice(start, end + 1).map((t) => t.hash)
				setSelected((prev) => {
					const next = new Set(prev)
					rangeHashes.forEach((h) => next.add(h))
					return next
				})
			}
		} else {
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
			setLastSelected(hash)
		}
	}

	function handleSelectAll() {
		if (selected.size === filtered.length && filtered.length > 0) {
			setSelected(new Set())
		} else {
			setSelected(new Set(filtered.map((t) => t.hash)))
		}
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
		if (sortKey === key) {
			const newAsc = !sortAsc
			setSortAsc(newAsc)
			localStorage.setItem('sortAsc', String(newAsc))
		} else {
			setSortKey(key)
			setSortAsc(true)
			localStorage.setItem('sortKey', key)
			localStorage.setItem('sortAsc', 'true')
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
				className="flex items-center gap-1 px-2 py-1.5 border-b"
				style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
			>
				<div className="flex items-center">
					<ActionButton
						onClick={() => setAddModal(true)}
						disabled={false}
						label="Add Torrent"
						colorVar="var(--accent)"
						icon={Plus}
					/>
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

				<div className="w-px h-5" style={{ backgroundColor: 'var(--border)' }} />

				<div className="flex items-center">
					<FilterBar filter={filter} onFilterChange={setFilter} />
				</div>

				<div className="w-px h-5" style={{ backgroundColor: 'var(--border)' }} />

				<div className="flex items-center">
					<CategoryDropdown value={categoryFilter} onChange={setCategoryFilter} categories={categories} />
					<TagDropdown value={tagFilter} onChange={setTagFilter} tags={tags} />
					<TrackerDropdown value={trackerFilter} onChange={setTrackerFilter} trackers={uniqueTrackers} />
				</div>

				<div className="w-px h-5" style={{ backgroundColor: 'var(--border)' }} />

				<div className="flex items-center">
					<ViewSelector
						views={customViews}
						isModified={isViewModified}
						onViewSelect={handleViewSelect}
						onSave={handleSaveView}
						onSaveAs={handleSaveViewAs}
						onRename={handleRenameView}
						onDelete={handleDeleteView}
					/>
					<ManageButton onClick={() => setManagerModal(true)} />
					<ColumnSelector
						columns={COLUMNS}
						visible={visibleColumns}
						onChange={handleColumnChange}
						columnOrder={columnOrder}
						onReorder={handleColumnReorder}
						onReset={handleColumnsReset}
					/>
				</div>

				<div className="flex-1 min-w-0" />

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
									className="px-4 py-1.5 text-left relative"
									style={columnWidths.name ? { width: columnWidths.name } : undefined}
								>
									<div className="flex items-center gap-3">
										<button
											onClick={handleSelectAll}
											className="flex items-center justify-center w-4 h-4 rounded border transition-colors"
											style={{
												borderColor: 'var(--border)',
												backgroundColor:
													selected.size > 0 ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
											}}
										>
											{selected.size === filtered.length && filtered.length > 0 && (
												<Square className="w-2.5 h-2.5 fill-current" style={{ color: 'var(--accent)' }} />
											)}
											{selected.size > 0 &&
												selected.size < filtered.length &&
												// Indeterminate state icon (minus/dash)
												(
													<div
														className="w-2 h-0.5 rounded-full"
														style={{ backgroundColor: 'var(--accent)' }}
													/>
												)}
										</button>
										<button
											onClick={() => handleSort('name')}
											className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-widest transition-colors"
											style={{ color: 'var(--text-muted)' }}
										>
											Name
											<SortIcon active={sortKey === 'name'} asc={sortAsc} />
										</button>
									</div>
									<div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'name')} />
								</th>
								{orderedColumns
									.filter((col) => visibleColumns.has(col.id))
									.map((col) => (
										<th
											key={col.id}
											className="px-3 py-1.5 text-left whitespace-nowrap relative"
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
											) : col.id === 'added_on' ? (
												<div className="flex items-center gap-1">
													<button
														onClick={() => handleSort('added_on')}
														className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-widest transition-colors"
														style={{ color: 'var(--text-muted)' }}
													>
														{col.label}
														<SortIcon active={sortKey === 'added_on'} asc={sortAsc} />
													</button>
													<button
														onClick={(e) => setDatePopupAnchor(e.currentTarget)}
														className="p-0.5 rounded opacity-50 hover:opacity-100 transition-opacity"
														title="Date display settings"
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
									<th className="px-2 py-1.5 w-8">
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
									hideAddedTime={hideAddedTime}
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
					category={selectedTorrent?.category ?? ''}
					tags={selectedTorrent?.tags ?? ''}
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

			{datePopupAnchor && (
				<DateSettingsPopup
					anchor={datePopupAnchor}
					hideTime={hideAddedTime}
					onSave={(hide) => {
						saveHideAddedTime(hide)
						setHideAddedTime(hide)
					}}
					onClose={() => setDatePopupAnchor(null)}
				/>
			)}
		</div>
	)
}
