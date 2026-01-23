import { useState, useMemo, useRef, useEffect } from 'react'
import {
	ChevronDown,
	ArrowDown,
	ArrowUp,
	Pause,
	AlertCircle,
	RefreshCw,
	Play,
	LayoutGrid,
	List,
	Archive,
} from 'lucide-react'
import { useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/qbittorrent'
import type { Instance } from '../api/instances'
import type { Torrent, TorrentState } from '../types/qbittorrent'
import {
	formatSize,
	formatSpeed,
	formatDuration,
	formatEta,
	formatCompactSpeed,
	formatCompactSize,
	formatRelativeDate,
	normalizeSearch,
} from '../utils/format'

type TorrentWithInstance = Torrent & { instanceId: number; instanceLabel: string }

type StatusFilter = 'all' | 'downloading' | 'seeding' | 'paused'
type SortField = 'dlspeed' | 'upspeed' | 'ratio' | 'seeding_time' | 'added_on' | 'last_activity'

const DOWNLOADING_STATES: TorrentState[] = [
	'downloading',
	'metaDL',
	'forcedDL',
	'stalledDL',
	'allocating',
	'queuedDL',
	'checkingDL',
]
const SEEDING_STATES: TorrentState[] = ['uploading', 'forcedUP', 'stalledUP', 'queuedUP', 'checkingUP']
const PAUSED_STATES: TorrentState[] = ['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP']

function getStateInfo(state: TorrentState): {
	color: string
	label: string
	icon: 'download' | 'upload' | 'pause' | 'error' | 'check'
} {
	if (DOWNLOADING_STATES.includes(state)) {
		if (state === 'stalledDL') return { color: 'var(--warning)', label: 'Stalled', icon: 'download' }
		if (state === 'queuedDL') return { color: 'var(--text-muted)', label: 'Queued', icon: 'download' }
		if (state === 'checkingDL') return { color: 'var(--accent)', label: 'Checking', icon: 'check' }
		return { color: 'var(--accent)', label: 'Downloading', icon: 'download' }
	}
	if (SEEDING_STATES.includes(state)) {
		if (state === 'stalledUP') return { color: '#a6e3a1', label: 'Seeding', icon: 'upload' }
		if (state === 'queuedUP') return { color: 'var(--text-muted)', label: 'Queued', icon: 'upload' }
		if (state === 'checkingUP') return { color: '#a6e3a1', label: 'Checking', icon: 'check' }
		return { color: '#a6e3a1', label: 'Seeding', icon: 'upload' }
	}
	if (PAUSED_STATES.includes(state)) return { color: 'var(--text-muted)', label: 'Paused', icon: 'pause' }
	if (state === 'error' || state === 'missingFiles') return { color: 'var(--error)', label: 'Error', icon: 'error' }
	return { color: 'var(--text-muted)', label: state, icon: 'pause' }
}

function MobileSelect<T extends string>({
	value,
	options,
	onChange,
}: {
	value: T
	options: { value: T; label: string }[]
	onChange: (v: T) => void
}) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		function handleClickOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [open])

	const selected = options.find((o) => o.value === value)

	return (
		<div ref={ref} className="relative flex-1">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium"
				style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
			>
				<span className="truncate">{selected?.label}</span>
				<ChevronDown
					className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
					style={{ color: 'var(--text-muted)' }}
					strokeWidth={2}
				/>
			</button>
			{open && (
				<div
					className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-auto rounded-xl border shadow-xl z-50"
					style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
				>
					{options.map((o) => (
						<button
							key={o.value}
							type="button"
							onClick={() => {
								onChange(o.value)
								setOpen(false)
							}}
							className="w-full px-3 py-2.5 text-left text-sm font-medium transition-colors active:bg-[var(--bg-tertiary)]"
							style={{
								color: value === o.value ? 'var(--accent)' : 'var(--text-primary)',
								backgroundColor:
									value === o.value ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
							}}
						>
							{o.label}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

function StateIcon({ type, color }: { type: 'download' | 'upload' | 'pause' | 'error' | 'check'; color: string }) {
	switch (type) {
		case 'download':
			return <ArrowDown className="w-4 h-4" style={{ color }} strokeWidth={2.5} />
		case 'upload':
			return <ArrowUp className="w-4 h-4" style={{ color }} strokeWidth={2.5} />
		case 'pause':
			return <Pause className="w-4 h-4" style={{ color }} strokeWidth={2.5} />
		case 'error':
			return <AlertCircle className="w-4 h-4" style={{ color }} strokeWidth={2.5} />
		case 'check':
			return <RefreshCw className="w-4 h-4 animate-spin" style={{ color }} strokeWidth={2.5} />
	}
}

interface Props {
	instances: Instance[]
	search?: string
	compact?: boolean
	onToggleCompact?: () => void
	onSelectTorrent: (hash: string, instanceId: number) => void
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
	{ value: 'all', label: 'All' },
	{ value: 'downloading', label: 'Downloading' },
	{ value: 'seeding', label: 'Seeding' },
	{ value: 'paused', label: 'Paused' },
]

const SORT_OPTIONS: { value: SortField; label: string }[] = [
	{ value: 'added_on', label: 'Added' },
	{ value: 'dlspeed', label: 'Down Speed' },
	{ value: 'upspeed', label: 'Up Speed' },
	{ value: 'ratio', label: 'Ratio' },
	{ value: 'seeding_time', label: 'Seed Time' },
	{ value: 'last_activity', label: 'Last Active' },
]

export function MobileTorrentList({ instances, search, compact, onToggleCompact, onSelectTorrent }: Props) {
	const [status, setStatus] = useState<StatusFilter>('all')
	const [sortBy, setSortBy] = useState<SortField>('added_on')
	const [swipedHash, setSwipedHash] = useState<string | null>(null)
	const queryClient = useQueryClient()

	const torrentQueries = useQueries({
		queries: instances.map((instance) => ({
			queryKey: ['torrents', instance.id],
			queryFn: () => api.getTorrents(instance.id),
			refetchInterval: 2000,
		})),
	})

	const isLoading = torrentQueries.some((q) => q.isLoading)

	const torrents: TorrentWithInstance[] = useMemo(() => {
		return torrentQueries.flatMap((q, i) =>
			(q.data || []).map((t) => ({
				...t,
				instanceId: instances[i].id,
				instanceLabel: instances[i].label,
			}))
		)
	}, [torrentQueries, instances])

	const stopMutation = useMutation({
		mutationFn: ({ instanceId, hashes }: { instanceId: number; hashes: string[] }) =>
			api.stopTorrents(instanceId, hashes),
		onSuccess: (_, { instanceId }) => queryClient.invalidateQueries({ queryKey: ['torrents', instanceId] }),
	})

	const startMutation = useMutation({
		mutationFn: ({ instanceId, hashes }: { instanceId: number; hashes: string[] }) =>
			api.startTorrents(instanceId, hashes),
		onSuccess: (_, { instanceId }) => queryClient.invalidateQueries({ queryKey: ['torrents', instanceId] }),
	})

	const filteredTorrents = useMemo(() => {
		let result = torrents
		if (search) {
			const q = normalizeSearch(search)
			result = result.filter((t) => normalizeSearch(t.name).includes(q))
		}
		switch (status) {
			case 'downloading':
				result = result.filter((t) => DOWNLOADING_STATES.includes(t.state))
				break
			case 'seeding':
				result = result.filter((t) => SEEDING_STATES.includes(t.state))
				break
			case 'paused':
				result = result.filter((t) => PAUSED_STATES.includes(t.state))
				break
		}
		return [...result].sort((a, b) => b[sortBy] - a[sortBy])
	}, [torrents, status, sortBy, search])

	function handleToggle(torrent: TorrentWithInstance, e: React.MouseEvent) {
		e.stopPropagation()
		const isPaused = PAUSED_STATES.includes(torrent.state)
		if (isPaused) {
			startMutation.mutate({ instanceId: torrent.instanceId, hashes: [torrent.hash] })
		} else {
			stopMutation.mutate({ instanceId: torrent.instanceId, hashes: [torrent.hash] })
		}
		setSwipedHash(null)
	}

	const showInstanceLabel = instances.length > 1

	return (
		<div className="space-y-3">
			<div className="flex gap-2">
				<MobileSelect value={status} options={STATUS_OPTIONS} onChange={setStatus} />
				<MobileSelect value={sortBy} options={SORT_OPTIONS} onChange={setSortBy} />
				{onToggleCompact && (
					<button
						onClick={onToggleCompact}
						className="p-2.5 rounded-xl shrink-0"
						style={{ backgroundColor: 'var(--bg-tertiary)', color: compact ? 'var(--accent)' : 'var(--text-muted)' }}
					>
						{compact ? (
							<LayoutGrid className="w-5 h-5" strokeWidth={1.5} />
						) : (
							<List className="w-5 h-5" strokeWidth={1.5} />
						)}
					</button>
				)}
			</div>

			{isLoading ? (
				<div className="py-12 text-center">
					<div className="text-sm" style={{ color: 'var(--text-muted)' }}>
						Loading torrents...
					</div>
				</div>
			) : filteredTorrents.length === 0 ? (
				<div
					className="py-12 text-center rounded-2xl border"
					style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
				>
					<Archive
						className="w-12 h-12 mx-auto mb-3"
						style={{ color: 'var(--text-muted)', opacity: 0.5 }}
						strokeWidth={1}
					/>
					<div className="text-sm" style={{ color: 'var(--text-muted)' }}>
						No torrents found
					</div>
				</div>
			) : (
				<div className={compact ? 'space-y-1' : 'space-y-2'}>
					{filteredTorrents.map((torrent) => {
						const stateInfo = getStateInfo(torrent.state)
						const isPaused = PAUSED_STATES.includes(torrent.state)
						const isSwiped = swipedHash === torrent.hash
						const speed =
							torrent.dlspeed > 0
								? formatSpeed(torrent.dlspeed)
								: torrent.upspeed > 0
									? formatSpeed(torrent.upspeed)
									: ''
						const progress = Math.round(torrent.progress * 100)

						if (compact) {
							return (
								<button
									key={torrent.hash}
									onClick={() => onSelectTorrent(torrent.hash, torrent.instanceId)}
									className="w-full text-left px-3 py-2.5 rounded-xl border active:scale-[0.99] transition-transform"
									style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
								>
									<div className="flex items-center gap-2 mb-1">
										<div className="text-xs font-medium truncate flex-1" style={{ color: 'var(--text-primary)' }}>
											{torrent.name}
										</div>
										<span className="text-[10px] tabular-nums shrink-0 font-medium" style={{ color: stateInfo.color }}>
											{progress}%
										</span>
									</div>
									<div className="flex items-center gap-1.5 text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
										<span style={{ color: stateInfo.color }}>{stateInfo.label}</span>
										{showInstanceLabel && (
											<>
												<span style={{ opacity: 0.4 }}>•</span>
												<span>{torrent.instanceLabel}</span>
											</>
										)}
										<span style={{ opacity: 0.4 }}>•</span>
										<span className="tabular-nums">{formatCompactSize(torrent.size)}</span>
										{speed && (
											<>
												<span style={{ opacity: 0.4 }}>•</span>
												<span className="tabular-nums" style={{ color: stateInfo.color }}>
													{speed}
												</span>
											</>
										)}
										{torrent.eta > 0 && torrent.eta < 8640000 && (
											<>
												<span style={{ opacity: 0.4 }}>•</span>
												<span className="tabular-nums">{formatEta(torrent.eta)}</span>
											</>
										)}
									</div>
									<div
										className="h-1 rounded-full overflow-hidden mb-1.5"
										style={{ backgroundColor: 'var(--bg-tertiary)' }}
									>
										<div
											className="h-full rounded-full"
											style={{ width: `${progress}%`, backgroundColor: stateInfo.color }}
										/>
									</div>
									<div
										className="flex items-center gap-3 text-[10px] tabular-nums"
										style={{ color: 'var(--text-muted)' }}
									>
										<span>
											<span style={{ opacity: 0.5 }}>↓</span>
											{formatCompactSize(torrent.downloaded)}
										</span>
										<span>
											<span style={{ opacity: 0.5 }}>↑</span>
											{formatCompactSize(torrent.uploaded)}
										</span>
										<span>
											<span style={{ opacity: 0.5, color: 'var(--accent)' }}>▼</span>
											{formatCompactSpeed(torrent.dlspeed)}/s
										</span>
										<span>
											<span style={{ opacity: 0.5, color: '#a6e3a1' }}>▲</span>
											{formatCompactSpeed(torrent.upspeed)}/s
										</span>
										<span className="ml-auto">
											<span style={{ opacity: 0.5 }}>⏱</span>
											{formatDuration(torrent.seeding_time)}
										</span>
										<span>
											<span style={{ opacity: 0.5 }}>+</span>
											{formatRelativeDate(torrent.added_on)}
										</span>
									</div>
								</button>
							)
						}

						return (
							<div key={torrent.hash} className="relative overflow-hidden rounded-2xl">
								<div
									className="absolute inset-y-0 right-0 flex items-center px-4 transition-transform"
									style={{
										backgroundColor: isPaused ? 'var(--accent)' : 'var(--warning)',
										transform: isSwiped ? 'translateX(0)' : 'translateX(100%)',
									}}
								>
									<button onClick={(e) => handleToggle(torrent, e)} className="p-2">
										{isPaused ? (
											<Play className="w-6 h-6" style={{ color: 'var(--accent-contrast)' }} strokeWidth={2} />
										) : (
											<Pause className="w-6 h-6" style={{ color: '#000' }} strokeWidth={2} />
										)}
									</button>
								</div>

								<button
									onClick={() => onSelectTorrent(torrent.hash, torrent.instanceId)}
									onTouchStart={() => {}}
									onContextMenu={(e) => {
										e.preventDefault()
										setSwipedHash(isSwiped ? null : torrent.hash)
									}}
									className="w-full text-left p-4 rounded-2xl border transition-transform active:scale-[0.98]"
									style={{
										backgroundColor: 'var(--bg-secondary)',
										borderColor: 'var(--border)',
										transform: isSwiped ? 'translateX(-60px)' : 'translateX(0)',
									}}
								>
									<div className="flex items-start gap-3">
										<div
											className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
											style={{ backgroundColor: `color-mix(in srgb, ${stateInfo.color} 15%, transparent)` }}
										>
											<StateIcon type={stateInfo.icon} color={stateInfo.color} />
										</div>
										<div className="flex-1 min-w-0">
											<div
												className="font-medium text-sm leading-snug line-clamp-2"
												style={{ color: 'var(--text-primary)' }}
											>
												{torrent.name}
											</div>
											<div className="flex items-center gap-2 mt-1.5 flex-wrap">
												<span className="text-xs" style={{ color: stateInfo.color }}>
													{stateInfo.label}
												</span>
												{showInstanceLabel && (
													<>
														<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
															•
														</span>
														<span
															className="text-xs px-1.5 py-0.5 rounded"
															style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
														>
															{torrent.instanceLabel}
														</span>
													</>
												)}
												<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
													•
												</span>
												<span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
													{formatSize(torrent.size)}
												</span>
												{speed && (
													<>
														<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
															•
														</span>
														<span className="text-xs tabular-nums" style={{ color: stateInfo.color }}>
															{speed}
														</span>
													</>
												)}
											</div>
											<div
												className="mt-2 h-1.5 rounded-full overflow-hidden"
												style={{ backgroundColor: 'var(--bg-tertiary)' }}
											>
												<div
													className="h-full rounded-full transition-all duration-300"
													style={{
														width: `${progress}%`,
														backgroundColor: stateInfo.color,
													}}
												/>
											</div>
											<div className="flex items-center justify-between mt-1.5">
												<span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
													{progress}%
												</span>
												{torrent.eta > 0 && torrent.eta < 8640000 && (
													<span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
														{formatEta(torrent.eta)}
													</span>
												)}
											</div>

											<div
												className="mt-2.5 pt-2.5 grid grid-cols-3 gap-x-3 gap-y-1.5"
												style={{ borderTop: '1px solid var(--border)' }}
											>
												<div className="flex items-center gap-1.5">
													<span className="text-[10px] opacity-50" style={{ color: 'var(--text-muted)' }}>
														↓
													</span>
													<span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
														{formatCompactSize(torrent.downloaded)}
													</span>
												</div>
												<div className="flex items-center gap-1.5">
													<span className="text-[10px] opacity-50" style={{ color: 'var(--text-muted)' }}>
														↑
													</span>
													<span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
														{formatCompactSize(torrent.uploaded)}
													</span>
												</div>
												<div className="flex items-center gap-1.5">
													<span className="text-[10px] opacity-50" style={{ color: 'var(--accent)' }}>
														▼
													</span>
													<span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
														{formatCompactSpeed(torrent.dlspeed)}/s
													</span>
												</div>
												<div className="flex items-center gap-1.5">
													<span className="text-[10px] opacity-50" style={{ color: '#a6e3a1' }}>
														▲
													</span>
													<span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
														{formatCompactSpeed(torrent.upspeed)}/s
													</span>
												</div>
												<div className="flex items-center gap-1.5">
													<span className="text-[10px] opacity-50" style={{ color: 'var(--text-muted)' }}>
														⏱
													</span>
													<span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
														{formatDuration(torrent.seeding_time)}
													</span>
												</div>
												<div className="flex items-center gap-1.5">
													<span className="text-[10px] opacity-50" style={{ color: 'var(--text-muted)' }}>
														+
													</span>
													<span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
														{formatRelativeDate(torrent.added_on)}
													</span>
												</div>
											</div>
										</div>
									</div>
								</button>
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}
