import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer } from 'vaul'
import * as api from '../api/qbittorrent'
import type { TorrentState } from '../types/qbittorrent'
import { formatSize, formatSpeed, formatDate, formatDuration } from '../utils/format'

type Tab = 'general' | 'files' | 'trackers' | 'peers' | 'http'

const PAUSED_STATES: TorrentState[] = ['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP']

interface Props {
	torrentHash: string
	instanceId: number
	onClose: () => void
}

export function MobileTorrentDetail({ torrentHash, instanceId, onClose }: Props) {
	const [tab, setTab] = useState<Tab>('general')
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const [deleteFiles, setDeleteFiles] = useState(false)
	const queryClient = useQueryClient()

	// Handle browser back button/gesture to close drawer
	useEffect(() => {
		window.history.pushState({ drawer: 'open' }, '')
		const handlePopState = () => onClose()
		window.addEventListener('popstate', handlePopState)
		return () => window.removeEventListener('popstate', handlePopState)
	}, [onClose])

	const { data: torrents } = useQuery({
		queryKey: ['torrents', instanceId],
		queryFn: () => api.getTorrents(instanceId),
		refetchInterval: 2000,
	})
	const torrent = torrents?.find((t) => t.hash === torrentHash)

	const { data: properties } = useQuery({
		queryKey: ['torrent-properties', instanceId, torrentHash],
		queryFn: () => api.getTorrentProperties(instanceId, torrentHash),
	})
	const { data: trackers } = useQuery({
		queryKey: ['torrent-trackers', instanceId, torrentHash],
		queryFn: () => api.getTorrentTrackers(instanceId, torrentHash),
	})
	const { data: peersData } = useQuery({
		queryKey: ['torrent-peers', instanceId, torrentHash],
		queryFn: () => api.getTorrentPeers(instanceId, torrentHash),
		refetchInterval: 3000,
	})
	const { data: files } = useQuery({
		queryKey: ['torrent-files', instanceId, torrentHash],
		queryFn: () => api.getTorrentFiles(instanceId, torrentHash),
	})
	const { data: webSeeds } = useQuery({
		queryKey: ['torrent-webseeds', instanceId, torrentHash],
		queryFn: () => api.getTorrentWebSeeds(instanceId, torrentHash),
	})

	const stopMutation = useMutation({
		mutationFn: () => api.stopTorrents(instanceId, [torrentHash]),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['torrents', instanceId] }),
	})
	const startMutation = useMutation({
		mutationFn: () => api.startTorrents(instanceId, [torrentHash]),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['torrents', instanceId] }),
	})
	const deleteMutation = useMutation({
		mutationFn: (deleteFiles: boolean) => api.deleteTorrents(instanceId, [torrentHash], deleteFiles),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['torrents', instanceId] }),
	})

	const isPaused = torrent ? PAUSED_STATES.includes(torrent.state) : false
	const peers = peersData?.peers ? Object.values(peersData.peers) : []

	function handleToggle() {
		if (isPaused) {
			startMutation.mutate()
		} else {
			stopMutation.mutate()
		}
	}

	function handleDelete() {
		deleteMutation.mutate(deleteFiles)
		onClose()
	}

	const tabs: { id: Tab; label: string; count?: number }[] = [
		{ id: 'general', label: 'General' },
		{ id: 'files', label: 'Files', count: files?.length },
		{
			id: 'trackers',
			label: 'Trackers',
			count: trackers?.filter((t) => t.url.startsWith('http') || t.url.startsWith('udp')).length,
		},
		{ id: 'peers', label: 'Peers', count: peers.length },
		{ id: 'http', label: 'HTTP', count: webSeeds?.length },
	]

	if (!torrent) {
		return null
	}

	return (
		<Drawer.Root open={true} onOpenChange={(open) => !open && onClose()}>
			<Drawer.Portal>
				<Drawer.Overlay className="fixed inset-0 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} />
				<Drawer.Content
					className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t flex flex-col outline-none h-[90vh]"
					style={{
						backgroundColor: 'var(--bg-primary)',
						borderColor: 'var(--border)',
					}}
				>
					{/* Handle */}
					<div className="flex justify-center pt-3 pb-2">
						<div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
					</div>

					{/* Header */}
					<div className="px-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
						<Drawer.Title
							className="text-base font-semibold leading-snug line-clamp-2"
							style={{ color: 'var(--text-primary)' }}
						>
							{torrent.name}
						</Drawer.Title>
						<div className="flex items-center gap-2 mt-2">
							<div
								className="h-1.5 flex-1 rounded-full overflow-hidden"
								style={{ backgroundColor: 'var(--bg-tertiary)' }}
							>
								<div
									className="h-full rounded-full"
									style={{
										width: `${Math.round(torrent.progress * 100)}%`,
										backgroundColor: 'var(--accent)',
									}}
								/>
							</div>
							<span className="text-xs font-medium tabular-nums" style={{ color: 'var(--text-muted)' }}>
								{Math.round(torrent.progress * 100)}%
							</span>
						</div>
					</div>

					{/* Action buttons */}
					<div className="flex gap-3 p-4 border-b" style={{ borderColor: 'var(--border)' }}>
						<button
							onClick={handleToggle}
							disabled={stopMutation.isPending || startMutation.isPending}
							className="flex-1 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
							style={{
								backgroundColor: isPaused ? 'var(--accent)' : 'var(--bg-tertiary)',
								color: isPaused ? 'var(--accent-contrast)' : 'var(--text-primary)',
							}}
						>
							{isPaused ? (
								<>
									<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
										/>
									</svg>
									Resume
								</>
							) : (
								<>
									<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
									</svg>
									Pause
								</>
							)}
						</button>
						<button
							onClick={() => setShowDeleteConfirm(true)}
							className="py-3 px-5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
							style={{ backgroundColor: 'color-mix(in srgb, var(--error) 15%, transparent)', color: 'var(--error)' }}
						>
							<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
								/>
							</svg>
							Delete
						</button>
					</div>

					{/* Tabs */}
					<div className="mx-4 mt-3">
						<div className="flex p-1.5 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
							{tabs.map((t) => (
								<button
									key={t.id}
									onClick={() => setTab(t.id)}
									className="flex-1 px-1 py-2 rounded-lg text-xs font-medium transition-all text-center whitespace-nowrap"
									style={{
										backgroundColor: tab === t.id ? 'var(--accent)' : 'transparent',
										color: tab === t.id ? 'var(--accent-contrast)' : 'var(--text-muted)',
									}}
								>
									{t.label}
									{t.count ? ` (${t.count})` : ''}
								</button>
							))}
						</div>
					</div>

					{/* Content - scrollable */}
					<div
						className="flex-1 min-h-0 overflow-y-auto px-4 pt-3"
						style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))' }}
					>
						{tab === 'general' && (
							<div className="space-y-3">
								<InfoRow label="Size" value={formatSize(torrent.size)} />
								<InfoRow label="Downloaded" value={formatSize(torrent.downloaded)} />
								<InfoRow label="Uploaded" value={formatSize(torrent.uploaded)} />
								<InfoRow label="Ratio" value={torrent.ratio.toFixed(2)} />
								<div className="h-px my-2" style={{ backgroundColor: 'var(--border)' }} />
								<InfoRow label="Download Speed" value={formatSpeed(torrent.dlspeed)} accent />
								<InfoRow label="Upload Speed" value={formatSpeed(torrent.upspeed)} accent="#a6e3a1" />
								<InfoRow label="Seeds" value={`${torrent.num_seeds}`} />
								<InfoRow label="Peers" value={`${torrent.num_leechs}`} />
								<div className="h-px my-2" style={{ backgroundColor: 'var(--border)' }} />
								<InfoRow label="Added" value={formatDate(torrent.added_on)} />
								<InfoRow label="Completed" value={formatDate(torrent.completion_on)} />
								<InfoRow label="Seeding Time" value={formatDuration(torrent.seeding_time)} />
								<InfoRow label="Last Activity" value={formatDate(torrent.last_activity)} />
								<div className="h-px my-2" style={{ backgroundColor: 'var(--border)' }} />
								<InfoRow label="Category" value={torrent.category || '-'} />
								<InfoRow label="Tags" value={torrent.tags || '-'} />
								<InfoRow label="Save Path" value={torrent.save_path} small />
								{properties?.comment && <InfoRow label="Comment" value={properties.comment} small />}
							</div>
						)}

						{tab === 'files' && (
							<div className="space-y-2">
								{files?.map((file, i) => (
									<div
										key={i}
										className="p-3 rounded-xl border"
										style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
									>
										<div className="text-xs break-all leading-relaxed" style={{ color: 'var(--text-primary)' }}>
											{file.name}
										</div>
										<div className="flex items-center gap-3 mt-2">
											<div
												className="flex-1 h-1 rounded-full overflow-hidden"
												style={{ backgroundColor: 'var(--bg-tertiary)' }}
											>
												<div
													className="h-full rounded-full"
													style={{ width: `${Math.round(file.progress * 100)}%`, backgroundColor: 'var(--accent)' }}
												/>
											</div>
											<span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
												{Math.round(file.progress * 100)}%
											</span>
										</div>
										<div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
											<span>{formatSize(file.size)}</span>
											<span>Priority: {file.priority === 0 ? 'Skip' : file.priority === 1 ? 'Normal' : 'High'}</span>
										</div>
									</div>
								))}
								{(!files || files.length === 0) && (
									<div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
										No files
									</div>
								)}
							</div>
						)}

						{tab === 'trackers' && (
							<div className="space-y-2">
								{trackers
									?.filter((t) => t.url.startsWith('http') || t.url.startsWith('udp'))
									.map((tracker, i) => (
										<div
											key={i}
											className="p-3 rounded-xl border"
											style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
										>
											<div className="text-xs font-mono break-all" style={{ color: 'var(--text-primary)' }}>
												{tracker.url}
											</div>
											<div className="flex items-center gap-3 mt-2 text-xs">
												<span style={{ color: tracker.status === 2 ? '#a6e3a1' : 'var(--text-muted)' }}>
													{tracker.status === 2
														? 'Working'
														: tracker.status === 3
															? 'Updating'
															: tracker.status === 4
																? 'Error'
																: 'Disabled'}
												</span>
												<span style={{ color: 'var(--text-muted)' }}>Seeds: {tracker.num_seeds}</span>
												<span style={{ color: 'var(--text-muted)' }}>Peers: {tracker.num_peers}</span>
											</div>
										</div>
									))}
								{(!trackers ||
									trackers.filter((t) => t.url.startsWith('http') || t.url.startsWith('udp')).length === 0) && (
									<div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
										No trackers
									</div>
								)}
							</div>
						)}

						{tab === 'peers' && (
							<div className="space-y-2">
								{peers.map((peer, i) => (
									<div
										key={i}
										className="p-3 rounded-xl border"
										style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
									>
										<div className="flex items-center justify-between">
											<div className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>
												{peer.ip}:{peer.port}
											</div>
											<div className="text-xs" style={{ color: 'var(--text-muted)' }}>
												{peer.country_code || '??'}
											</div>
										</div>
										<div className="flex items-center gap-3 mt-2 text-xs">
											<span style={{ color: 'var(--accent)' }}>↓ {formatSpeed(peer.dl_speed)}</span>
											<span style={{ color: '#a6e3a1' }}>↑ {formatSpeed(peer.up_speed)}</span>
											<span style={{ color: 'var(--text-muted)' }}>{Math.round(peer.progress * 100)}%</span>
										</div>
										{peer.client && (
											<div className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
												{peer.client}
											</div>
										)}
									</div>
								))}
								{peers.length === 0 && (
									<div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
										No peers connected
									</div>
								)}
							</div>
						)}

						{tab === 'http' && (
							<div className="space-y-2">
								{webSeeds?.map((seed, i) => (
									<div
										key={i}
										className="p-3 rounded-xl border"
										style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
									>
										<div className="text-xs font-mono break-all" style={{ color: 'var(--text-primary)' }}>
											{seed.url}
										</div>
									</div>
								))}
								{(!webSeeds || webSeeds.length === 0) && (
									<div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
										No HTTP sources
									</div>
								)}
							</div>
						)}
					</div>
				</Drawer.Content>
			</Drawer.Portal>

			{/* Delete confirmation modal */}
			{showDeleteConfirm && (
				<>
					<div
						className="fixed inset-0 z-[60]"
						style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
						onClick={() => setShowDeleteConfirm(false)}
					/>
					<div
						className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[60] rounded-2xl border p-5"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
							Delete Torrent
						</h3>
						<p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
							Are you sure you want to delete this torrent?
						</p>
						<label className="flex items-center gap-3 mb-5 cursor-pointer">
							<input
								type="checkbox"
								checked={deleteFiles}
								onChange={(e) => setDeleteFiles(e.target.checked)}
								className="w-5 h-5 rounded"
							/>
							<span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
								Also delete files from disk
							</span>
						</label>
						<div className="flex gap-3">
							<button
								onClick={() => setShowDeleteConfirm(false)}
								className="flex-1 py-3 rounded-xl text-sm font-medium"
								style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
							>
								Cancel
							</button>
							<button
								onClick={handleDelete}
								className="flex-1 py-3 rounded-xl text-sm font-medium"
								style={{ backgroundColor: 'var(--error)', color: 'white' }}
							>
								Delete
							</button>
						</div>
					</div>
				</>
			)}
		</Drawer.Root>
	)
}

function InfoRow({
	label,
	value,
	accent,
	small,
}: {
	label: string
	value: string
	accent?: string | boolean
	small?: boolean
}) {
	return (
		<div className="flex items-start justify-between gap-4">
			<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
				{label}
			</span>
			<span
				className={`text-xs text-right ${small ? 'max-w-[200px] truncate' : ''}`}
				style={{ color: accent ? (typeof accent === 'string' ? accent : 'var(--accent)') : 'var(--text-primary)' }}
			>
				{value}
			</span>
		</div>
	)
}
