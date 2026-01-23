import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
	Settings,
	ArrowRightLeft,
	Users,
	Link,
	Folder,
	Plus,
	X,
	ChevronRight,
	ChevronUp,
	MousePointer,
	FileText,
} from 'lucide-react'
import type { TorrentFile } from '../types/torrentDetails'
import {
	useTorrentProperties,
	useTorrentTrackers,
	useTorrentPeers,
	useTorrentFiles,
	useTorrentWebSeeds,
	useSetFilePriority,
	useAddTrackers,
	useRemoveTrackers,
} from '../hooks/useTorrentDetails'
import { formatSize, formatSpeed, formatDate, formatDuration, formatEta } from '../utils/format'
import type { Tracker, Peer } from '../types/torrentDetails'
import { buildFileTree, flattenVisibleNodes, getInitialExpanded } from '../utils/fileTree'

interface Props {
	hash: string | null
	name: string
	expanded: boolean
	onToggle: () => void
	height: number
	onHeightChange: (h: number) => void
}

type Tab = 'general' | 'trackers' | 'peers' | 'http' | 'content'

const TABS: { id: Tab; label: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
	{ id: 'general', label: 'General', Icon: Settings },
	{ id: 'trackers', label: 'Trackers', Icon: ArrowRightLeft },
	{ id: 'peers', label: 'Peers', Icon: Users },
	{ id: 'http', label: 'HTTP', Icon: Link },
	{ id: 'content', label: 'Files', Icon: Folder },
]

const MIN_HEIGHT = 120
const MAX_HEIGHT_PERCENT = 0.55
const COLLAPSED_HEIGHT = 36

function getTrackerStatus(status: number): { label: string; colorVar: string } {
	const statuses: Record<number, { label: string; colorVar: string }> = {
		0: { label: 'Disabled', colorVar: 'var(--text-muted)' },
		1: { label: 'Not contacted', colorVar: 'var(--text-muted)' },
		2: { label: 'Working', colorVar: 'var(--accent)' },
		3: { label: 'Updating', colorVar: 'var(--warning)' },
		4: { label: 'Error', colorVar: 'var(--error)' },
	}
	return statuses[status] ?? { label: 'Unknown', colorVar: 'var(--text-muted)' }
}

function LoadingSkeleton() {
	return (
		<div className="p-4 space-y-3 animate-pulse">
			<div className="grid grid-cols-4 gap-3">
				{[...Array(8)].map((_, i) => (
					<div
						key={i}
						className="h-10 rounded"
						style={{ backgroundColor: 'color-mix(in srgb, white 3%, transparent)' }}
					/>
				))}
			</div>
		</div>
	)
}

function EmptyState({ message }: { message: string }) {
	return (
		<div
			className="flex items-center justify-center h-full text-xs tracking-wide uppercase"
			style={{ color: 'var(--text-muted)' }}
		>
			{message}
		</div>
	)
}

function InfoItem({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
	return (
		<div
			className="flex flex-col gap-0.5 px-3 py-2 rounded border"
			style={{ backgroundColor: 'color-mix(in srgb, white 2.5%, transparent)', borderColor: 'var(--border)' }}
		>
			<span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
				{label}
			</span>
			<span className="text-xs font-mono" style={{ color: accent ? 'var(--accent)' : 'var(--text-primary)' }}>
				{value}
			</span>
		</div>
	)
}

function GeneralTab({ hash }: { hash: string }) {
	const { data: p, isLoading } = useTorrentProperties(hash)
	if (isLoading) return <LoadingSkeleton />
	if (!p) return <EmptyState message="Failed to load" />
	return (
		<div className="p-3 overflow-auto h-full">
			<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
				<InfoItem label="Downloaded" value={formatSize(p.total_downloaded)} accent />
				<InfoItem label="Uploaded" value={formatSize(p.total_uploaded)} />
				<InfoItem label="Ratio" value={p.share_ratio.toFixed(2)} />
				<InfoItem label="ETA" value={formatEta(p.eta)} />
				<InfoItem label="DL Speed" value={formatSpeed(p.dl_speed)} accent />
				<InfoItem label="UP Speed" value={formatSpeed(p.up_speed)} />
				<InfoItem label="Seeds" value={`${p.seeds}/${p.seeds_total}`} accent />
				<InfoItem label="Peers" value={`${p.peers}/${p.peers_total}`} />
				<InfoItem label="Connections" value={`${p.nb_connections}/${p.nb_connections_limit}`} />
				<InfoItem label="Wasted" value={formatSize(p.total_wasted)} />
				<InfoItem label="Added" value={formatDate(p.addition_date)} />
				<InfoItem label="Completed" value={formatDate(p.completion_date)} />
				<InfoItem label="Size" value={formatSize(p.total_size)} />
				<InfoItem label="Pieces" value={`${p.pieces_have}/${p.pieces_num}`} />
				<InfoItem label="Piece Size" value={formatSize(p.piece_size)} />
				<InfoItem label="Seeding" value={formatDuration(p.seeding_time)} />
			</div>
			<div
				className="mt-3 px-3 py-2 rounded border"
				style={{ backgroundColor: 'color-mix(in srgb, white 2.5%, transparent)', borderColor: 'var(--border)' }}
			>
				<span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
					Save Path
				</span>
				<div className="text-xs font-mono mt-0.5 break-all" style={{ color: 'var(--text-primary)' }}>
					{p.save_path}
				</div>
			</div>
		</div>
	)
}

function TrackersTab({ hash }: { hash: string }) {
	const [adding, setAdding] = useState(false)
	const [newUrl, setNewUrl] = useState('')
	const { data: trackers, isLoading } = useTorrentTrackers(hash)
	const addMutation = useAddTrackers()
	const removeMutation = useRemoveTrackers()

	function handleAdd() {
		if (newUrl.trim()) {
			addMutation.mutate({ hash, urls: newUrl.trim().split('\n').filter(Boolean) })
			setNewUrl('')
			setAdding(false)
		}
	}

	function handleRemove(url: string) {
		removeMutation.mutate({ hash, urls: [url] })
	}

	if (isLoading) return <LoadingSkeleton />
	const filtered = trackers?.filter((t: Tracker) => !t.url.startsWith('** [')) ?? []

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
				{adding ? (
					<div className="flex-1 flex items-center gap-2">
						<input
							type="text"
							value={newUrl}
							onChange={(e) => setNewUrl(e.target.value)}
							placeholder="Tracker URL (one per line)"
							className="flex-1 px-2 py-1 rounded text-xs border"
							style={{
								backgroundColor: 'var(--bg-secondary)',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
							autoFocus
							onKeyDown={(e) => {
								if (e.key === 'Enter') handleAdd()
								if (e.key === 'Escape') setAdding(false)
							}}
						/>
						<button
							onClick={handleAdd}
							className="px-2 py-1 rounded text-[10px] font-medium"
							style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
						>
							Add
						</button>
						<button
							onClick={() => setAdding(false)}
							className="px-2 py-1 rounded text-[10px] font-medium"
							style={{ color: 'var(--text-muted)' }}
						>
							Cancel
						</button>
					</div>
				) : (
					<button
						onClick={() => setAdding(true)}
						className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium"
						style={{ color: 'var(--accent)' }}
					>
						<Plus className="w-3 h-3" strokeWidth={2} />
						Add Tracker
					</button>
				)}
			</div>
			{filtered.length === 0 ? (
				<EmptyState message="No trackers" />
			) : (
				<div className="overflow-auto flex-1">
					<table className="w-full text-xs">
						<thead
							className="sticky top-0 backdrop-blur-sm"
							style={{ backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 95%, transparent)' }}
						>
							<tr className="text-left border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
								<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest">Tier</th>
								<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest">URL</th>
								<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest">Status</th>
								<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest text-right">Seeds</th>
								<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest text-right">Peers</th>
								<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest"></th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((t: Tracker, i: number) => {
								const status = getTrackerStatus(t.status)
								return (
									<tr key={i} className="border-t transition-colors group" style={{ borderColor: 'var(--border)' }}>
										<td className="px-3 py-1.5 font-mono" style={{ color: 'var(--text-muted)' }}>
											{t.tier}
										</td>
										<td
											className="px-3 py-1.5 font-mono truncate max-w-[200px]"
											style={{ color: 'var(--text-primary)' }}
											title={t.url}
										>
											{t.url}
										</td>
										<td className="px-3 py-1.5">
											<span
												className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
												style={{
													color: status.colorVar,
													backgroundColor: `color-mix(in srgb, ${status.colorVar} 10%, transparent)`,
												}}
											>
												<span className="w-1 h-1 rounded-full" style={{ backgroundColor: status.colorVar }} />
												{status.label}
											</span>
										</td>
										<td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--accent)' }}>
											{t.num_seeds}
										</td>
										<td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
											{t.num_peers}
										</td>
										<td className="px-3 py-1.5 text-right">
											<button
												onClick={() => handleRemove(t.url)}
												className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
												style={{ color: 'var(--error)' }}
												title="Remove tracker"
											>
												<X className="w-3 h-3" strokeWidth={2} />
											</button>
										</td>
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}

function PeersTab({ hash }: { hash: string }) {
	const { data, isLoading } = useTorrentPeers(hash)
	if (isLoading) return <LoadingSkeleton />
	const peers = Object.values(data?.peers || {}) as Peer[]
	if (peers.length === 0) return <EmptyState message="No peers" />
	return (
		<div className="overflow-auto h-full">
			<table className="w-full text-xs">
				<thead
					className="sticky top-0 backdrop-blur-sm"
					style={{ backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 95%, transparent)' }}
				>
					<tr className="text-left border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest">IP</th>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest">Client</th>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest">Flags</th>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest text-right">Progress</th>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest text-right">DL</th>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest text-right">UP</th>
					</tr>
				</thead>
				<tbody>
					{peers.map((p: Peer, i: number) => (
						<tr key={i} className="border-t transition-colors" style={{ borderColor: 'var(--border)' }}>
							<td className="px-3 py-1.5 font-mono">
								<span style={{ color: 'var(--text-primary)' }}>{p.ip}</span>
								<span style={{ color: 'var(--text-muted)' }}>:{p.port}</span>
							</td>
							<td
								className="px-3 py-1.5 truncate max-w-[100px]"
								style={{ color: 'var(--text-muted)' }}
								title={p.client}
							>
								{p.client}
							</td>
							<td className="px-3 py-1.5 font-mono" style={{ color: 'var(--text-muted)' }}>
								{p.flags || '—'}
							</td>
							<td className="px-3 py-1.5 text-right">
								<div className="flex items-center justify-end gap-1.5">
									<div
										className="w-10 h-1 rounded-full overflow-hidden"
										style={{ backgroundColor: 'var(--bg-tertiary)' }}
									>
										<div
											className="h-full rounded-full"
											style={{ width: `${p.progress * 100}%`, backgroundColor: 'var(--accent)' }}
										/>
									</div>
									<span className="font-mono w-7 text-right" style={{ color: 'var(--text-muted)' }}>
										{(p.progress * 100).toFixed(0)}%
									</span>
								</div>
							</td>
							<td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--accent)' }}>
								{formatSpeed(p.dl_speed, false)}
							</td>
							<td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--warning)' }}>
								{formatSpeed(p.up_speed, false)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

function HttpSourcesTab({ hash }: { hash: string }) {
	const { data: seeds, isLoading } = useTorrentWebSeeds(hash)
	if (isLoading) return <LoadingSkeleton />
	if (!seeds || seeds.length === 0) return <EmptyState message="No HTTP sources" />
	return (
		<div className="p-3 space-y-1.5 overflow-auto h-full">
			{seeds.map((s, i) => (
				<div
					key={i}
					className="flex items-center gap-2 px-3 py-2 rounded border"
					style={{ backgroundColor: 'color-mix(in srgb, white 2.5%, transparent)', borderColor: 'var(--border)' }}
				>
					<Link className="w-3 h-3 shrink-0" style={{ color: 'var(--accent)' }} strokeWidth={2} />
					<span className="text-xs font-mono break-all" style={{ color: 'var(--text-primary)' }}>
						{s.url}
					</span>
				</div>
			))}
		</div>
	)
}

const PRIORITY_OPTIONS = [
	{ value: 0, label: 'Skip', color: 'var(--text-muted)' },
	{ value: 1, label: 'Normal', color: 'var(--text-primary)' },
	{ value: 6, label: 'High', color: 'var(--warning)' },
	{ value: 7, label: 'Max', color: 'var(--accent)' },
]

function ContentTabInner({ hash, files }: { hash: string; files: TorrentFile[] }) {
	const setPriorityMutation = useSetFilePriority()
	const tree = useMemo(() => buildFileTree(files), [files])
	const [expanded, setExpanded] = useState<Set<string>>(() => getInitialExpanded(tree))
	const flatNodes = useMemo(() => flattenVisibleNodes(tree, expanded), [tree, expanded])

	function toggleExpanded(path: string) {
		setExpanded((prev) => {
			const next = new Set(prev)
			if (next.has(path)) next.delete(path)
			else next.add(path)
			return next
		})
	}

	function handlePriorityChange(fileIndices: number[], priority: number) {
		setPriorityMutation.mutate({ hash, ids: fileIndices, priority })
	}

	return (
		<div className="overflow-auto h-full">
			<table className="w-full text-xs">
				<thead
					className="sticky top-0 backdrop-blur-sm"
					style={{ backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 95%, transparent)' }}
				>
					<tr className="text-left border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest">Name</th>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest text-right w-20">Size</th>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest text-right w-24">Progress</th>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest text-right w-20">Priority</th>
					</tr>
				</thead>
				<tbody>
					{flatNodes.map(({ node, depth }) => {
						const progress = node.progress * 100
						const done = progress >= 100
						const isSkipped = node.priority === 'skip'
						const isMixed = node.priority === 'mixed'
						const prioColor =
							node.priority === 'skip'
								? 'var(--error)'
								: node.priority === 'high' || node.priority === 'max'
									? 'var(--warning)'
									: node.priority === 'mixed'
										? 'var(--text-muted)'
										: 'var(--text-primary)'

						return (
							<tr
								key={node.path}
								className={`border-t transition-colors ${node.isFolder ? 'cursor-pointer hover:bg-white/[0.02]' : ''}`}
								style={{ borderColor: 'var(--border)' }}
								onClick={node.isFolder ? () => toggleExpanded(node.path) : undefined}
							>
								<td className="px-3 py-1.5">
									<div className="flex items-center gap-1.5" style={{ paddingLeft: `${depth * 16}px` }}>
										{node.isFolder ? (
											<ChevronRight
												className="w-3 h-3 shrink-0 transition-transform"
												style={{
													color: 'var(--text-muted)',
													transform: expanded.has(node.path) ? 'rotate(90deg)' : 'rotate(0deg)',
												}}
												strokeWidth={2}
											/>
										) : (
											<span className="w-3" />
										)}
										{node.isFolder ? (
											<Folder className="w-3.5 h-3.5 shrink-0" style={{ color: '#f59e0b' }} strokeWidth={1.5} />
										) : (
											<FileText
												className="w-3 h-3 shrink-0"
												style={{ color: isSkipped ? 'var(--error)' : done ? 'var(--accent)' : 'var(--text-muted)' }}
												strokeWidth={2}
											/>
										)}
										<span
											className="truncate"
											style={{
												color: isSkipped ? 'var(--text-muted)' : 'var(--text-primary)',
												textDecoration: isSkipped ? 'line-through' : 'none',
												fontWeight: node.isFolder ? 500 : 400,
											}}
											title={node.name}
										>
											{node.name}
										</span>
										{node.isFolder && (
											<span className="text-[9px] ml-1" style={{ color: 'var(--text-muted)' }}>
												({node.fileIndices.length})
											</span>
										)}
									</div>
								</td>
								<td className="px-3 py-1.5 text-right font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
									{formatSize(node.size)}
								</td>
								<td className="px-3 py-1.5 text-right">
									<div className="flex items-center justify-end gap-1.5">
										<div
											className="w-14 h-1 rounded-full overflow-hidden"
											style={{ backgroundColor: 'var(--bg-tertiary)' }}
										>
											<div
												className="h-full rounded-full"
												style={{ width: `${progress}%`, backgroundColor: done ? 'var(--accent)' : 'var(--text-muted)' }}
											/>
										</div>
										<span
											className="font-mono w-9 text-right"
											style={{ color: done ? 'var(--accent)' : 'var(--text-muted)' }}
										>
											{progress.toFixed(0)}%
										</span>
									</div>
								</td>
								<td className="px-3 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
									<select
										value={
											isMixed
												? ''
												: node.priority === 'skip'
													? 0
													: node.priority === 'high'
														? 6
														: node.priority === 'max'
															? 7
															: 1
										}
										onChange={(e) => handlePriorityChange(node.fileIndices, parseInt(e.target.value))}
										className="px-2 py-1 rounded text-[10px] font-medium border cursor-pointer"
										style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)', color: prioColor }}
									>
										{isMixed && (
											<option value="" disabled>
												Mixed
											</option>
										)}
										{PRIORITY_OPTIONS.map((p) => (
											<option
												key={p.value}
												value={p.value}
												style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
											>
												{p.label}
											</option>
										))}
									</select>
								</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}

function ContentTab({ hash }: { hash: string }) {
	const { data: files, isLoading } = useTorrentFiles(hash)
	if (isLoading) return <LoadingSkeleton />
	if (!files || files.length === 0) return <EmptyState message="No files" />
	return <ContentTabInner key={hash} hash={hash} files={files} />
}

export function TorrentDetailsPanel({ hash, name, expanded, onToggle, height, onHeightChange }: Props) {
	const [tab, setTab] = useState<Tab>('general')
	const [dragging, setDragging] = useState(false)
	const dragStartY = useRef(0)
	const dragStartHeight = useRef(0)

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (!expanded) return
			e.preventDefault()
			setDragging(true)
			dragStartY.current = e.clientY
			dragStartHeight.current = height
		},
		[height, expanded]
	)

	useEffect(() => {
		if (!dragging) return
		const handleMouseMove = (e: MouseEvent) => {
			const delta = dragStartY.current - e.clientY
			const maxHeight = window.innerHeight * MAX_HEIGHT_PERCENT
			const newHeight = Math.min(maxHeight, Math.max(MIN_HEIGHT, dragStartHeight.current + delta))
			onHeightChange(newHeight)
		}
		const handleMouseUp = () => {
			setDragging(false)
			localStorage.setItem('detailsPanelHeight', height.toString())
		}
		document.addEventListener('mousemove', handleMouseMove)
		document.addEventListener('mouseup', handleMouseUp)
		return () => {
			document.removeEventListener('mousemove', handleMouseMove)
			document.removeEventListener('mouseup', handleMouseUp)
		}
	}, [dragging, height, onHeightChange])

	const panelHeight = expanded ? height : COLLAPSED_HEIGHT

	return (
		<div
			className="flex flex-col transition-[height] duration-300 ease-out"
			style={{ height: panelHeight, backgroundColor: 'var(--bg-secondary)' }}
		>
			<div
				onMouseDown={expanded ? handleMouseDown : undefined}
				className={`h-[3px] shrink-0 ${expanded ? `cursor-ns-resize ${dragging ? 'opacity-100' : 'opacity-70 hover:opacity-100'}` : ''} transition-opacity`}
				style={{
					background:
						'linear-gradient(to right, color-mix(in srgb, var(--accent) 60%, transparent), color-mix(in srgb, var(--accent) 30%, transparent), color-mix(in srgb, var(--accent) 60%, transparent))',
				}}
			/>
			<div
				className="flex items-center gap-2 px-3 shrink-0 cursor-pointer select-none border-b"
				style={{ height: COLLAPSED_HEIGHT - 3, backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
				onClick={onToggle}
			>
				<button
					className="p-1 rounded transition-colors"
					style={{ color: 'var(--text-muted)' }}
					onClick={(e) => {
						e.stopPropagation()
						onToggle()
					}}
				>
					<ChevronUp
						className={`w-4 h-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
						strokeWidth={2}
					/>
				</button>

				<div className="w-px h-4" style={{ backgroundColor: 'var(--border)' }} />

				<span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: 'var(--text-muted)' }}>
					Details
				</span>

				{hash && name && (
					<>
						<div className="w-px h-4" style={{ backgroundColor: 'var(--border)' }} />
						<span className="text-xs truncate max-w-[300px]" style={{ color: 'var(--text-muted)' }} title={name}>
							{name}
						</span>
					</>
				)}

				<div className="flex-1" />

				{expanded && hash && (
					<div className="flex items-center gap-0.5">
						{TABS.map((t) => (
							<button
								key={t.id}
								onClick={(e) => {
									e.stopPropagation()
									setTab(t.id)
								}}
								className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wide transition-all border"
								style={{
									backgroundColor: tab === t.id ? 'color-mix(in srgb, white 8%, transparent)' : 'transparent',
									color: tab === t.id ? 'var(--text-secondary)' : 'var(--text-muted)',
									borderColor: tab === t.id ? 'color-mix(in srgb, white 10%, transparent)' : 'transparent',
								}}
							>
								<t.Icon className="w-3 h-3" strokeWidth={2} />
								<span className="hidden lg:inline">{t.label}</span>
							</button>
						))}
					</div>
				)}
			</div>

			{expanded && (
				<div className="flex-1 overflow-hidden border-t" style={{ borderColor: 'var(--border)' }}>
					{hash ? (
						<>
							{tab === 'general' && <GeneralTab hash={hash} />}
							{tab === 'trackers' && <TrackersTab hash={hash} />}
							{tab === 'peers' && <PeersTab hash={hash} />}
							{tab === 'http' && <HttpSourcesTab hash={hash} />}
							{tab === 'content' && <ContentTab hash={hash} />}
						</>
					) : (
						<div className="flex items-center justify-center h-full">
							<div className="text-center">
								<MousePointer className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--border)' }} strokeWidth={1} />
								<p className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
									Select a torrent
								</p>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}
