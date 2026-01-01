import { useState, useEffect, useCallback, useRef } from 'react'
import { useTorrentProperties, useTorrentTrackers, useTorrentPeers, useTorrentFiles, useTorrentWebSeeds } from '../hooks/useTorrentDetails'
import { formatSize, formatSpeed, formatDate, formatDuration, formatEta } from '../utils/format'
import type { Tracker, Peer, TorrentFile } from '../types/torrentDetails'

interface Props {
	hash: string | null
	name: string
	expanded: boolean
	onToggle: () => void
	height: number
	onHeightChange: (h: number) => void
}

type Tab = 'general' | 'trackers' | 'peers' | 'http' | 'content'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
	{ id: 'general', label: 'General', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /> },
	{ id: 'trackers', label: 'Trackers', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /> },
	{ id: 'peers', label: 'Peers', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /> },
	{ id: 'http', label: 'HTTP', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /> },
	{ id: 'content', label: 'Files', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /> },
]

const MIN_HEIGHT = 120
const MAX_HEIGHT_PERCENT = 0.55
const COLLAPSED_HEIGHT = 36

function getTrackerStatus(status: number): { label: string; color: string; bg: string } {
	const statuses: Record<number, { label: string; color: string; bg: string }> = {
		0: { label: 'Disabled', color: 'text-[#6e6e82]', bg: 'bg-[#6e6e82]/10' },
		1: { label: 'Not contacted', color: 'text-[#8b8b9e]', bg: 'bg-[#8b8b9e]/10' },
		2: { label: 'Working', color: 'text-[#00d4aa]', bg: 'bg-[#00d4aa]/10' },
		3: { label: 'Updating', color: 'text-[#f7b731]', bg: 'bg-[#f7b731]/10' },
		4: { label: 'Error', color: 'text-[#f43f5e]', bg: 'bg-[#f43f5e]/10' },
	}
	return statuses[status] ?? { label: 'Unknown', color: 'text-[#8b8b9e]', bg: 'bg-[#8b8b9e]/10' }
}

function LoadingSkeleton() {
	return (
		<div className="p-4 space-y-3 animate-pulse">
			<div className="grid grid-cols-4 gap-3">
				{[...Array(8)].map((_, i) => (
					<div key={i} className="h-10 rounded bg-white/[0.03]" />
				))}
			</div>
		</div>
	)
}

function EmptyState({ message }: { message: string }) {
	return (
		<div className="flex items-center justify-center h-full text-[#4a4a5a] text-xs tracking-wide uppercase">
			{message}
		</div>
	)
}

function InfoItem({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
	return (
		<div className="flex flex-col gap-0.5 px-3 py-2 rounded bg-white/[0.025] border border-white/[0.05]">
			<span className="text-[9px] uppercase tracking-widest text-[#8a8a9e]">{label}</span>
			<span className={`text-xs font-mono ${accent ? 'text-[#00d4aa]' : 'text-[#e8e8f0]'}`}>{value}</span>
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
			<div className="mt-3 px-3 py-2 rounded bg-white/[0.025] border border-white/[0.05]">
				<span className="text-[9px] uppercase tracking-widest text-[#8a8a9e]">Save Path</span>
				<div className="text-xs font-mono text-[#e8e8f0] mt-0.5 break-all">{p.save_path}</div>
			</div>
		</div>
	)
}

function TrackersTab({ hash }: { hash: string }) {
	const { data: trackers, isLoading } = useTorrentTrackers(hash)
	if (isLoading) return <LoadingSkeleton />
	const filtered = trackers?.filter((t: Tracker) => !t.url.startsWith('** [')) ?? []
	if (filtered.length === 0) return <EmptyState message="No trackers" />
	return (
		<div className="overflow-auto h-full">
			<table className="w-full text-xs">
				<thead className="sticky top-0 bg-[#0c0c12]/95 backdrop-blur-sm">
					<tr className="text-[#8a8a9e] text-left border-b border-white/[0.06]">
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest">Tier</th>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest">URL</th>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest">Status</th>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest text-right">Seeds</th>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest text-right">Peers</th>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest">Message</th>
					</tr>
				</thead>
				<tbody>
					{filtered.map((t: Tracker, i: number) => {
						const status = getTrackerStatus(t.status)
						return (
							<tr key={i} className="border-t border-white/[0.03] hover:bg-white/[0.02] transition-colors">
								<td className="px-3 py-1.5 text-[#9090a4] font-mono">{t.tier}</td>
								<td className="px-3 py-1.5 text-[#e0e0ea] font-mono truncate max-w-[200px]" title={t.url}>{t.url}</td>
								<td className="px-3 py-1.5">
									<span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${status.color} ${status.bg}`}>
										<span className={`w-1 h-1 rounded-full ${status.color.replace('text-', 'bg-')}`} />
										{status.label}
									</span>
								</td>
								<td className="px-3 py-1.5 text-[#00d4aa] text-right font-mono">{t.num_seeds}</td>
								<td className="px-3 py-1.5 text-[#9090a4] text-right font-mono">{t.num_peers}</td>
								<td className="px-3 py-1.5 text-[#7a7a8e] truncate max-w-[120px]" title={t.msg}>{t.msg || '—'}</td>
							</tr>
						)
					})}
				</tbody>
			</table>
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
				<thead className="sticky top-0 bg-[#0c0c12]/95 backdrop-blur-sm">
					<tr className="text-[#8a8a9e] text-left border-b border-white/[0.06]">
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
						<tr key={i} className="border-t border-white/[0.03] hover:bg-white/[0.02] transition-colors">
							<td className="px-3 py-1.5 font-mono">
								<span className="text-[#e0e0ea]">{p.ip}</span>
								<span className="text-[#7a7a8e]">:{p.port}</span>
							</td>
							<td className="px-3 py-1.5 text-[#9090a4] truncate max-w-[100px]" title={p.client}>{p.client}</td>
							<td className="px-3 py-1.5 text-[#7a7a8e] font-mono">{p.flags || '—'}</td>
							<td className="px-3 py-1.5 text-right">
								<div className="flex items-center justify-end gap-1.5">
									<div className="w-10 h-1 rounded-full bg-[#1a1a24] overflow-hidden">
										<div className="h-full bg-[#00d4aa] rounded-full" style={{ width: `${p.progress * 100}%` }} />
									</div>
									<span className="text-[#9090a4] font-mono w-7 text-right">{(p.progress * 100).toFixed(0)}%</span>
								</div>
							</td>
							<td className="px-3 py-1.5 text-[#00d4aa] text-right font-mono">{formatSpeed(p.dl_speed, false)}</td>
							<td className="px-3 py-1.5 text-[#f7b731] text-right font-mono">{formatSpeed(p.up_speed, false)}</td>
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
				<div key={i} className="flex items-center gap-2 px-3 py-2 rounded bg-white/[0.025] border border-white/[0.05]">
					<svg className="w-3 h-3 text-[#00d4aa] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
					</svg>
					<span className="text-xs font-mono text-[#e0e0ea] break-all">{s.url}</span>
				</div>
			))}
		</div>
	)
}

function ContentTab({ hash }: { hash: string }) {
	const { data: files, isLoading } = useTorrentFiles(hash)
	if (isLoading) return <LoadingSkeleton />
	if (!files || files.length === 0) return <EmptyState message="No files" />
	return (
		<div className="overflow-auto h-full">
			<table className="w-full text-xs">
				<thead className="sticky top-0 bg-[#0c0c12]/95 backdrop-blur-sm">
					<tr className="text-[#8a8a9e] text-left border-b border-white/[0.06]">
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest">Name</th>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest text-right">Size</th>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest text-right">Progress</th>
						<th className="px-3 py-2 font-medium text-[9px] uppercase tracking-widest text-right">Pri</th>
					</tr>
				</thead>
				<tbody>
					{files.map((f: TorrentFile, i: number) => {
						const progress = f.progress * 100
						const done = progress >= 100
						return (
							<tr key={i} className="border-t border-white/[0.03] hover:bg-white/[0.02] transition-colors">
								<td className="px-3 py-1.5">
									<div className="flex items-center gap-2">
										{done ? (
											<svg className="w-3 h-3 text-[#00d4aa] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
												<path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
											</svg>
										) : (
											<svg className="w-3 h-3 text-[#7a7a8e] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
												<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
											</svg>
										)}
										<span className="text-[#e0e0ea] truncate max-w-[280px]" title={f.name}>{f.name}</span>
									</div>
								</td>
								<td className="px-3 py-1.5 text-[#9090a4] text-right font-mono">{formatSize(f.size)}</td>
								<td className="px-3 py-1.5 text-right">
									<div className="flex items-center justify-end gap-1.5">
										<div className="w-14 h-1 rounded-full bg-[#1a1a24] overflow-hidden">
											<div className={`h-full rounded-full ${done ? 'bg-[#00d4aa]' : 'bg-[#7a7a8e]'}`} style={{ width: `${progress}%` }} />
										</div>
										<span className={`font-mono w-9 text-right ${done ? 'text-[#00d4aa]' : 'text-[#9090a4]'}`}>{progress.toFixed(0)}%</span>
									</div>
								</td>
								<td className="px-3 py-1.5 text-[#7a7a8e] text-right font-mono">{f.priority}</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}

export function TorrentDetailsPanel({ hash, name, expanded, onToggle, height, onHeightChange }: Props) {
	const [tab, setTab] = useState<Tab>('general')
	const [dragging, setDragging] = useState(false)
	const dragStartY = useRef(0)
	const dragStartHeight = useRef(0)

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		if (!expanded) return
		e.preventDefault()
		setDragging(true)
		dragStartY.current = e.clientY
		dragStartHeight.current = height
	}, [height, expanded])

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
			className="flex flex-col bg-[#0c0c12] transition-[height] duration-300 ease-out"
			style={{ height: panelHeight }}
		>
			<div
				onMouseDown={expanded ? handleMouseDown : undefined}
				className={`h-[3px] shrink-0 bg-gradient-to-r from-[#00d4aa]/60 via-[#00d4aa]/30 to-[#00d4aa]/60 ${
					expanded ? `cursor-ns-resize ${dragging ? 'opacity-100' : 'opacity-70 hover:opacity-100'}` : ''
				} transition-opacity`}
			/>
			<div
				className="flex items-center gap-2 px-3 shrink-0 bg-[#0e0e14] cursor-pointer select-none border-b border-white/[0.04]"
				style={{ height: COLLAPSED_HEIGHT - 3 }}
				onClick={onToggle}
			>
				<button
					className="p-1 rounded hover:bg-white/[0.05] text-[#6e6e82] hover:text-[#00d4aa] transition-colors"
					onClick={(e) => { e.stopPropagation(); onToggle() }}
				>
					<svg
						className={`w-4 h-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
					</svg>
				</button>

				<div className="w-px h-4 bg-white/[0.06]" />

				<span className="text-[10px] uppercase tracking-widest text-[#7a7a8e] font-medium">Details</span>

				{hash && name && (
					<>
						<div className="w-px h-4 bg-white/[0.06]" />
						<span className="text-xs text-[#8b8b9e] truncate max-w-[300px]" title={name}>{name}</span>
					</>
				)}

				<div className="flex-1" />

				{expanded && hash && (
					<div className="flex items-center gap-0.5">
						{TABS.map((t) => (
							<button
								key={t.id}
								onClick={(e) => { e.stopPropagation(); setTab(t.id) }}
								className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wide transition-all ${
									tab === t.id
										? 'bg-white/[0.08] text-[#c8c8d4] border border-white/[0.1]'
										: 'text-[#6e6e82] hover:text-[#a0a0b0] hover:bg-white/[0.03] border border-transparent'
								}`}
							>
								<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
									{t.icon}
								</svg>
								<span className="hidden lg:inline">{t.label}</span>
							</button>
						))}
					</div>
				)}
			</div>

			{expanded && (
				<div className="flex-1 overflow-hidden border-t border-white/[0.03]">
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
								<svg className="w-8 h-8 mx-auto mb-2 text-[#2a2a34]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59" />
								</svg>
								<p className="text-xs text-[#4a4a5a] uppercase tracking-widest">Select a torrent</p>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}
