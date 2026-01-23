import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import type { Torrent, TorrentState } from '../types/qbittorrent'
import { formatSpeed, formatSize, formatEta, formatDate, formatRelativeTime, formatDuration } from '../utils/format'

type StateType = 'accent' | 'warning' | 'muted' | 'info' | 'error'

function getStateInfo(state: TorrentState): { label: string; type: StateType; isDownloading: boolean } {
	const map: Record<TorrentState, { label: string; type: StateType; isDownloading: boolean }> = {
		downloading: { label: 'Downloading', type: 'accent', isDownloading: true },
		uploading: { label: 'Seeding', type: 'warning', isDownloading: false },
		pausedDL: { label: 'Stopped', type: 'muted', isDownloading: false },
		pausedUP: { label: 'Stopped', type: 'muted', isDownloading: false },
		stoppedDL: { label: 'Stopped', type: 'muted', isDownloading: false },
		stoppedUP: { label: 'Stopped', type: 'muted', isDownloading: false },
		stalledDL: { label: 'Stalled', type: 'warning', isDownloading: false },
		stalledUP: { label: 'Seeding', type: 'warning', isDownloading: false },
		queuedDL: { label: 'Queued', type: 'muted', isDownloading: false },
		queuedUP: { label: 'Queued', type: 'muted', isDownloading: false },
		checkingDL: { label: 'Checking', type: 'info', isDownloading: false },
		checkingUP: { label: 'Checking', type: 'info', isDownloading: false },
		checkingResumeData: { label: 'Checking', type: 'info', isDownloading: false },
		forcedDL: { label: 'Forced', type: 'accent', isDownloading: true },
		forcedUP: { label: 'Forced', type: 'warning', isDownloading: false },
		metaDL: { label: 'Metadata', type: 'info', isDownloading: false },
		allocating: { label: 'Allocating', type: 'info', isDownloading: false },
		moving: { label: 'Moving', type: 'info', isDownloading: false },
		error: { label: 'Error', type: 'error', isDownloading: false },
		missingFiles: { label: 'Missing', type: 'error', isDownloading: false },
		unknown: { label: 'Unknown', type: 'muted', isDownloading: false },
	}
	return map[state] ?? { label: state, type: 'muted', isDownloading: false }
}

function getColor(type: StateType): string {
	const colors: Record<StateType, string> = {
		accent: 'var(--accent)',
		warning: 'var(--warning)',
		error: 'var(--error)',
		muted: 'var(--text-muted)',
		info: '#8b5cf6',
	}
	return colors[type]
}

interface CellContext {
	stateColor: string
	stateLabel: string
	isComplete: boolean
	progress: number
	ratioColor: string
}

function renderCell(columnId: string, torrent: Torrent, ctx: CellContext): ReactNode {
	switch (columnId) {
		case 'progress':
			return ctx.isComplete ? (
				<div className="flex items-center gap-2">
					<div
						className="w-5 h-5 rounded-full flex items-center justify-center"
						style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)' }}
					>
						<Check className="w-3 h-3" style={{ color: 'var(--accent)' }} strokeWidth={3} />
					</div>
					<span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
						Complete
					</span>
				</div>
			) : (
				<div className="group/progress relative flex items-center gap-2">
					<div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
						<div
							className="h-full rounded-full"
							style={{ width: `${ctx.progress}%`, backgroundColor: 'var(--progress)' }}
						/>
					</div>
					<span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
						{ctx.progress}%
					</span>
					{torrent.eta > 0 && torrent.eta < 8640000 && (
						<div className="absolute left-0 -top-8 opacity-0 group-hover/progress:opacity-100 transition-opacity pointer-events-none z-50">
							<div
								className="px-2 py-1 rounded text-xs font-mono whitespace-nowrap"
								style={{
									backgroundColor: 'var(--bg-secondary)',
									border: '1px solid var(--border)',
									color: 'var(--text-primary)',
								}}
							>
								ETA: {formatEta(torrent.eta)}
							</div>
						</div>
					)}
				</div>
			)
		case 'eta':
			return (
				<span className="text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
					{torrent.eta > 0 && torrent.eta < 8640000 ? formatEta(torrent.eta) : '—'}
				</span>
			)
		case 'status':
			return (
				<span
					className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium"
					style={{ color: ctx.stateColor, backgroundColor: `color-mix(in srgb, ${ctx.stateColor} 10%, transparent)` }}
				>
					<span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ctx.stateColor }} />
					{ctx.stateLabel}
				</span>
			)
		case 'size':
			return (
				<span className="text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
					{formatSize(torrent.size)}
				</span>
			)
		case 'downloaded':
			return (
				<span className="text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
					{formatSize(torrent.downloaded)}
				</span>
			)
		case 'uploaded':
			return (
				<span className="text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
					{formatSize(torrent.uploaded)}
				</span>
			)
		case 'dlspeed':
			return (
				<span className="text-xs font-mono font-medium whitespace-nowrap" style={{ color: 'var(--accent)' }}>
					{formatSpeed(torrent.dlspeed, false)}
				</span>
			)
		case 'upspeed':
			return (
				<span className="text-xs font-mono font-medium whitespace-nowrap" style={{ color: 'var(--warning)' }}>
					{formatSpeed(torrent.upspeed, false)}
				</span>
			)
		case 'ratio':
			return (
				<span className="text-xs font-mono font-medium whitespace-nowrap" style={{ color: ctx.ratioColor }}>
					{torrent.ratio.toFixed(2)}
				</span>
			)
		case 'seeding_time':
			return (
				<span className="text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
					{formatDuration(torrent.seeding_time)}
				</span>
			)
		case 'added_on':
			return (
				<span className="text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
					{formatDate(torrent.added_on)}
				</span>
			)
		case 'completion_on':
			return (
				<span className="text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
					{formatDate(torrent.completion_on)}
				</span>
			)
		case 'category':
			return (
				<span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
					{torrent.category || '—'}
				</span>
			)
		case 'tags':
			return torrent.tags ? (
				<div className="flex gap-1">
					{torrent.tags.split(',').map((tag, i) => (
						<span
							key={i}
							className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-white/70 border border-white/10 whitespace-nowrap"
						>
							{tag.trim()}
						</span>
					))}
				</div>
			) : (
				<span className="text-xs text-gray-500">—</span>
			)
		case 'num_seeds':
			return (
				<span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
					{torrent.num_seeds}
				</span>
			)
		case 'num_leechs':
			return (
				<span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
					{torrent.num_leechs}
				</span>
			)
		case 'last_activity':
			return (
				<span className="text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
					{formatRelativeTime(torrent.last_activity)}
				</span>
			)
		case 'save_path':
			return (
				<span
					className="text-xs font-mono truncate max-w-[150px] block"
					title={torrent.save_path}
					style={{ color: 'var(--text-muted)' }}
				>
					{torrent.save_path}
				</span>
			)
		case 'tracker':
			return (
				<span
					className="text-xs font-mono truncate max-w-[150px] block"
					title={torrent.tracker}
					style={{ color: 'var(--text-muted)' }}
				>
					{torrent.tracker}
				</span>
			)
		default:
			return null
	}
}

interface Props {
	torrent: Torrent
	selected: boolean
	onSelect: (hash: string, multi: boolean) => void
	onContextMenu: (e: React.MouseEvent) => void
	ratioThreshold: number
	visibleColumns: Set<string>
	columnOrder: string[]
	columnWidths: Record<string, number>
	hasCustomWidths: boolean
}

export function TorrentRow({
	torrent,
	selected,
	onSelect,
	onContextMenu,
	ratioThreshold,
	visibleColumns,
	columnOrder,
	columnWidths,
	hasCustomWidths,
}: Props) {
	const { label, type, isDownloading } = getStateInfo(torrent.state)
	const progress = Math.round(torrent.progress * 100)
	const isComplete = progress >= 100
	const stateColor = getColor(type)
	const ratioRounded = Math.round(torrent.ratio * 100) / 100
	const ratioColor = ratioRounded >= ratioThreshold ? '#a6e3a1' : '#f38ba8'

	const cellContext = { stateColor, stateLabel: label, isComplete, progress, ratioColor }

	return (
		<tr
			onClick={(e) => onSelect(torrent.hash, e.ctrlKey || e.metaKey)}
			onContextMenu={onContextMenu}
			className={`group cursor-pointer transition-colors duration-150 ${isDownloading ? 'downloading' : ''}`}
			style={{
				backgroundColor: selected ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
			}}
		>
			<td
				className="px-4 py-3 max-w-xs xl:max-w-sm 2xl:max-w-md"
				style={columnWidths.name ? { width: columnWidths.name, maxWidth: columnWidths.name } : undefined}
			>
				<div className="flex items-center gap-3">
					<div
						className="shrink-0 w-4 h-4 rounded border transition-colors duration-150 flex items-center justify-center"
						style={{
							borderColor: selected ? 'var(--text-muted)' : 'var(--border)',
							backgroundColor: selected ? 'color-mix(in srgb, white 3%, transparent)' : 'transparent',
						}}
					>
						{selected && <Check className="w-2.5 h-2.5" style={{ color: 'var(--text-muted)' }} strokeWidth={3} />}
					</div>
					<span
						className="truncate font-medium text-sm"
						style={{ color: 'var(--text-secondary)' }}
						title={`${torrent.name}\nLast active: ${formatRelativeTime(torrent.last_activity)}`}
					>
						{torrent.name}
					</span>
				</div>
			</td>
			{columnOrder
				.filter((id) => visibleColumns.has(id))
				.map((id) => (
					<td
						key={id}
						className="px-3 py-3"
						style={columnWidths[id] ? { width: columnWidths[id], maxWidth: columnWidths[id] } : undefined}
					>
						{renderCell(id, torrent, cellContext)}
					</td>
				))}
			{hasCustomWidths && <td className="w-8" />}
		</tr>
	)
}
