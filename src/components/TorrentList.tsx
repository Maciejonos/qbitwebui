import { useState, useMemo, useEffect } from 'react'
import type { TorrentFilter } from '../types/qbittorrent'
import { useTorrents, useStopTorrents, useStartTorrents, useDeleteTorrents, useCategories } from '../hooks/useTorrents'
import { TorrentRow } from './TorrentRow'
import { FilterBar, SearchInput, CategoryDropdown, TrackerDropdown } from './FilterBar'
import { AddTorrentModal } from './AddTorrentModal'
import { TorrentDetailsPanel } from './TorrentDetailsPanel'

const DEFAULT_PANEL_HEIGHT = 220

type SortKey = 'name' | 'size' | 'progress' | 'downloaded' | 'uploaded' | 'dlspeed' | 'upspeed' | 'ratio'

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
	return (
		<svg className={`w-3 h-3 transition-colors ${active ? 'text-[#00d4aa]' : 'text-[#6e6e82]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
			{asc ? (
				<path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
			) : (
				<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
			)}
		</svg>
	)
}

function ActionButton({
	onClick,
	disabled,
	icon,
	label,
	color,
}: {
	onClick: () => void
	disabled: boolean
	icon: React.ReactNode
	label: string
	color: string
}) {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			title={label}
			className={`p-2 rounded-lg transition-all duration-200 ${
				disabled
					? 'text-[#3a3a44] cursor-not-allowed'
					: `${color} hover:bg-white/[0.06] active:scale-95`
			}`}
		>
			<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
				{icon}
			</svg>
		</button>
	)
}

export function TorrentList() {
	const [filter, setFilter] = useState<TorrentFilter>('all')
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
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

	const { data: categories = {} } = useCategories()
	const { data: torrents = [], isLoading } = useTorrents({
		filter,
		category: categoryFilter ?? undefined,
	})

	const uniqueTrackers = useMemo(() => {
		const trackers = new Set<string>()
		torrents.forEach((t) => { if (t.tracker) trackers.add(t.tracker) })
		return [...trackers].sort()
	}, [torrents])
	const stopMutation = useStopTorrents()
	const startMutation = useStartTorrents()
	const deleteMutation = useDeleteTorrents()

	const filtered = useMemo(() => {
		let result = torrents
		if (trackerFilter) {
			result = result.filter((t) => t.tracker === trackerFilter)
		}
		if (search) {
			const q = search.toLowerCase()
			result = result.filter((t) => t.name.toLowerCase().includes(q))
		}
		result = [...result].sort((a, b) => {
			const mul = sortAsc ? 1 : -1
			if (sortKey === 'name') return mul * a.name.localeCompare(b.name)
			return mul * (a[sortKey] - b[sortKey])
		})
		return result
	}, [torrents, trackerFilter, search, sortKey, sortAsc])

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

	const hasSelection = selected.size > 0
	const selectedHash = selected.size === 1 ? [...selected][0] : null
	const selectedTorrent = selectedHash ? torrents.find((t) => t.hash === selectedHash) : null

	return (
		<div className="flex flex-col flex-1 overflow-hidden bg-[#07070a]">
			<div className="flex items-center gap-2 px-4 py-2.5 bg-[#0a0a0f] border-b border-white/[0.04]">
				<div className="flex items-center gap-0.5 p-1 rounded-lg bg-[#0e0e14] border border-white/[0.06]">
					<ActionButton
						onClick={() => setAddModal(true)}
						disabled={false}
						label="Add Torrent"
						color="text-[#00d4aa]"
						icon={<path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />}
					/>
					<div className="w-px h-5 bg-white/[0.06] mx-0.5" />
					<ActionButton
						onClick={handleStart}
						disabled={!hasSelection}
						label="Start"
						color="text-[#00d4aa]"
						icon={<path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />}
					/>
					<ActionButton
						onClick={handleStop}
						disabled={!hasSelection}
						label="Stop"
						color="text-[#f7b731]"
						icon={<path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />}
					/>
					<ActionButton
						onClick={() => setDeleteModal(true)}
						disabled={!hasSelection}
						label="Delete"
						color="text-[#f43f5e]"
						icon={<path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />}
					/>
				</div>

				<div className="w-px h-6 bg-white/[0.04]" />

				<div className="flex items-center gap-0.5 p-1 rounded-lg bg-[#0e0e14] border border-white/[0.06]">
					<FilterBar filter={filter} onFilterChange={setFilter} />
				</div>

				<div className="flex items-center gap-0.5 p-1 rounded-lg bg-[#0e0e14] border border-white/[0.06]">
					<CategoryDropdown value={categoryFilter} onChange={setCategoryFilter} categories={categories} />
					<div className="w-px h-5 bg-white/[0.06]" />
					<TrackerDropdown value={trackerFilter} onChange={setTrackerFilter} trackers={uniqueTrackers} />
				</div>

				<div className="flex-1" />

				<SearchInput value={search} onChange={setSearch} />
			</div>

			<div className="flex-1 overflow-auto">
				{isLoading ? (
					<div className="flex flex-col items-center justify-center h-48 gap-3">
						<div className="w-6 h-6 border-2 border-[#00d4aa]/20 border-t-[#00d4aa] rounded-full animate-spin" />
						<span className="text-xs text-[#5a5a6a] uppercase tracking-widest">Loading</span>
					</div>
				) : filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-48 gap-2">
						<svg className="w-10 h-10 text-[#2a2a34]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
						</svg>
						<span className="text-xs text-[#5a5a6a] uppercase tracking-widest">No torrents</span>
					</div>
				) : (
					<table className="w-full table-auto">
						<thead className="sticky top-0 z-10">
							<tr className="bg-[#0a0a0f]/95 backdrop-blur-sm border-b border-white/[0.04]">
								<th className="px-4 py-2.5 text-left">
									<button
										onClick={() => handleSort('name')}
										className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-widest text-[#5a5a6a] hover:text-[#8b8b9e] transition-colors"
									>
										Name
										<SortIcon active={sortKey === 'name'} asc={sortAsc} />
									</button>
								</th>
								<th className="px-3 py-2.5 text-left whitespace-nowrap">
									<button
										onClick={() => handleSort('size')}
										className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-widest text-[#5a5a6a] hover:text-[#8b8b9e] transition-colors"
									>
										Size
										<SortIcon active={sortKey === 'size'} asc={sortAsc} />
									</button>
								</th>
								<th className="px-3 py-2.5 text-left whitespace-nowrap">
									<button
										onClick={() => handleSort('progress')}
										className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-widest text-[#5a5a6a] hover:text-[#8b8b9e] transition-colors"
									>
										Progress
										<SortIcon active={sortKey === 'progress'} asc={sortAsc} />
									</button>
								</th>
								<th className="px-3 py-2.5 text-left whitespace-nowrap">
									<span className="text-[9px] font-medium uppercase tracking-widest text-[#5a5a6a]">Status</span>
								</th>
								<th className="px-3 py-2.5 text-left whitespace-nowrap">
									<button
										onClick={() => handleSort('downloaded')}
										className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-widest text-[#5a5a6a] hover:text-[#8b8b9e] transition-colors"
									>
										Down
										<SortIcon active={sortKey === 'downloaded'} asc={sortAsc} />
									</button>
								</th>
								<th className="px-3 py-2.5 text-left whitespace-nowrap">
									<button
										onClick={() => handleSort('uploaded')}
										className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-widest text-[#5a5a6a] hover:text-[#8b8b9e] transition-colors"
									>
										Up
										<SortIcon active={sortKey === 'uploaded'} asc={sortAsc} />
									</button>
								</th>
								<th className="px-3 py-2.5 text-left whitespace-nowrap">
									<button
										onClick={() => handleSort('dlspeed')}
										className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-widest text-[#5a5a6a] hover:text-[#8b8b9e] transition-colors"
									>
										<span className="w-2 h-2 rounded-full bg-[#00d4aa]/40" />
										Speed
										<SortIcon active={sortKey === 'dlspeed'} asc={sortAsc} />
									</button>
								</th>
								<th className="px-3 py-2.5 text-left whitespace-nowrap">
									<button
										onClick={() => handleSort('upspeed')}
										className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-widest text-[#5a5a6a] hover:text-[#8b8b9e] transition-colors"
									>
										<span className="w-2 h-2 rounded-full bg-[#f7b731]/40" />
										Speed
										<SortIcon active={sortKey === 'upspeed'} asc={sortAsc} />
									</button>
								</th>
								<th className="px-3 py-2.5 text-left whitespace-nowrap">
									<button
										onClick={() => handleSort('ratio')}
										className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-widest text-[#5a5a6a] hover:text-[#8b8b9e] transition-colors"
									>
										Ratio
										<SortIcon active={sortKey === 'ratio'} asc={sortAsc} />
									</button>
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-white/[0.02]">
							{filtered.map((t) => (
								<TorrentRow
									key={t.hash}
									torrent={t}
									selected={selected.has(t.hash)}
									onSelect={handleSelect}
								/>
							))}
						</tbody>
					</table>
				)}
			</div>

			{deleteModal && (
				<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
					<div className="relative w-full max-w-xs mx-4">
						<div className="bg-[#0c0c10] rounded-xl p-5 border border-white/[0.06] shadow-2xl">
							<div className="flex items-center gap-3 mb-4">
								<div className="w-9 h-9 rounded-lg bg-[#f43f5e]/10 flex items-center justify-center">
									<svg className="w-4 h-4 text-[#f43f5e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
									</svg>
								</div>
								<div>
									<h3 className="text-sm font-medium text-[#e8e8ed]">Delete</h3>
									<p className="text-[10px] text-[#6e6e82] uppercase tracking-wider">{selected.size} torrent{selected.size > 1 ? 's' : ''}</p>
								</div>
							</div>

							<div className="space-y-2">
								<button
									onClick={() => handleDelete(false)}
									className="w-full py-2.5 rounded-lg bg-[#f43f5e]/10 hover:bg-[#f43f5e]/20 border border-[#f43f5e]/20 text-[#f43f5e] text-xs font-medium transition-colors"
								>
									Remove from list
								</button>
								<button
									onClick={() => handleDelete(true)}
									className="w-full py-2.5 rounded-lg bg-[#f43f5e] hover:bg-[#e11d48] text-white text-xs font-medium transition-colors"
								>
									Delete with files
								</button>
								<button
									onClick={() => setDeleteModal(false)}
									className="w-full py-2.5 rounded-lg bg-[#13131a] hover:bg-[#1a1a24] border border-white/[0.06] text-[#6e6e82] text-xs font-medium transition-colors"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			<AddTorrentModal open={addModal} onClose={() => setAddModal(false)} />

			<TorrentDetailsPanel
				hash={selectedHash}
				name={selectedTorrent?.name ?? ''}
				expanded={panelExpanded}
				onToggle={() => setPanelExpanded(!panelExpanded)}
				height={panelHeight}
				onHeightChange={setPanelHeight}
			/>
		</div>
	)
}
