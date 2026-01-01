import type { Torrent, TorrentState } from '../types/qbittorrent'
import { formatSpeed, formatSize, formatEta } from '../utils/format'

function getStateInfo(state: TorrentState): { label: string; color: string; bgColor: string; isDownloading: boolean } {
	const map: Record<TorrentState, { label: string; color: string; bgColor: string; isDownloading: boolean }> = {
		downloading: { label: 'Downloading', color: 'text-[#00d4aa]', bgColor: 'bg-[#00d4aa]', isDownloading: true },
		uploading: { label: 'Seeding', color: 'text-[#f7b731]', bgColor: 'bg-[#f7b731]', isDownloading: false },
		pausedDL: { label: 'Stopped', color: 'text-[#8b8b9e]', bgColor: 'bg-[#8b8b9e]', isDownloading: false },
		pausedUP: { label: 'Stopped', color: 'text-[#8b8b9e]', bgColor: 'bg-[#8b8b9e]', isDownloading: false },
		stoppedDL: { label: 'Stopped', color: 'text-[#8b8b9e]', bgColor: 'bg-[#8b8b9e]', isDownloading: false },
		stoppedUP: { label: 'Stopped', color: 'text-[#8b8b9e]', bgColor: 'bg-[#8b8b9e]', isDownloading: false },
		stalledDL: { label: 'Stalled', color: 'text-[#f7b731]', bgColor: 'bg-[#f7b731]', isDownloading: false },
		stalledUP: { label: 'Seeding', color: 'text-[#f7b731]', bgColor: 'bg-[#f7b731]', isDownloading: false },
		queuedDL: { label: 'Queued', color: 'text-[#8b8b9e]', bgColor: 'bg-[#8b8b9e]', isDownloading: false },
		queuedUP: { label: 'Queued', color: 'text-[#8b8b9e]', bgColor: 'bg-[#8b8b9e]', isDownloading: false },
		checkingDL: { label: 'Checking', color: 'text-[#8b5cf6]', bgColor: 'bg-[#8b5cf6]', isDownloading: false },
		checkingUP: { label: 'Checking', color: 'text-[#8b5cf6]', bgColor: 'bg-[#8b5cf6]', isDownloading: false },
		checkingResumeData: { label: 'Checking', color: 'text-[#8b5cf6]', bgColor: 'bg-[#8b5cf6]', isDownloading: false },
		forcedDL: { label: 'Forced', color: 'text-[#00d4aa]', bgColor: 'bg-[#00d4aa]', isDownloading: true },
		forcedUP: { label: 'Forced', color: 'text-[#f7b731]', bgColor: 'bg-[#f7b731]', isDownloading: false },
		metaDL: { label: 'Metadata', color: 'text-[#8b5cf6]', bgColor: 'bg-[#8b5cf6]', isDownloading: false },
		allocating: { label: 'Allocating', color: 'text-[#8b5cf6]', bgColor: 'bg-[#8b5cf6]', isDownloading: false },
		moving: { label: 'Moving', color: 'text-[#8b5cf6]', bgColor: 'bg-[#8b5cf6]', isDownloading: false },
		error: { label: 'Error', color: 'text-[#f43f5e]', bgColor: 'bg-[#f43f5e]', isDownloading: false },
		missingFiles: { label: 'Missing', color: 'text-[#f43f5e]', bgColor: 'bg-[#f43f5e]', isDownloading: false },
		unknown: { label: 'Unknown', color: 'text-[#8b8b9e]', bgColor: 'bg-[#8b8b9e]', isDownloading: false },
	}
	return map[state] ?? { label: state, color: 'text-[#8b8b9e]', bgColor: 'bg-[#8b8b9e]', isDownloading: false }
}

interface Props {
	torrent: Torrent
	selected: boolean
	onSelect: (hash: string, multi: boolean) => void
}

export function TorrentRow({ torrent, selected, onSelect }: Props) {
	const { label, color, bgColor, isDownloading } = getStateInfo(torrent.state)
	const progress = Math.round(torrent.progress * 100)
	const isComplete = progress >= 100

	return (
		<tr
			onClick={(e) => onSelect(torrent.hash, e.ctrlKey || e.metaKey)}
			className={`group cursor-pointer transition-colors duration-150 ${
				selected
					? 'bg-[#00d4aa]/[0.08]'
					: 'hover:bg-white/[0.02]'
			} ${isDownloading ? 'downloading' : ''}`}
		>
			<td className="px-4 py-3 max-w-xs xl:max-w-sm 2xl:max-w-md">
				<div className="flex items-center gap-3">
					<div className={`shrink-0 w-4 h-4 rounded border transition-colors duration-150 flex items-center justify-center ${
						selected
							? 'border-[#6e6e82] bg-white/[0.03]'
							: 'border-[#3a3a44] group-hover:border-[#5a5a6e]'
					}`}>
						{selected && (
							<svg className="w-2.5 h-2.5 text-[#9090a0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						)}
					</div>
					<span className="truncate font-medium text-sm text-[#b8b8c8] group-hover:text-[#d0d0dc]" title={torrent.name}>
						{torrent.name}
					</span>
				</div>
			</td>
			<td className="px-3 py-3">
				<span className="text-xs font-mono text-[#8b8b9e]">{formatSize(torrent.size)}</span>
			</td>
			<td className="px-3 py-3">
				{isComplete ? (
					<div className="flex items-center gap-2">
						<div className="w-5 h-5 rounded-full bg-[#00d4aa]/20 flex items-center justify-center">
							<svg className="w-3 h-3 text-[#00d4aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						</div>
						<span className="text-xs font-medium text-[#00d4aa]">Complete</span>
					</div>
				) : (
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<div className="relative w-20 h-1.5 rounded-full bg-[#1a1a24] overflow-hidden">
								<div
									className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 progress-glow ${bgColor}`}
									style={{ width: `${progress}%` }}
								/>
							</div>
							<span className="text-xs font-mono text-[#8b8b9e]">{progress}%</span>
						</div>
						<span className="text-[10px] font-mono text-[#6e6e82]">{formatEta(torrent.eta)}</span>
					</div>
				)}
			</td>
			<td className="px-3 py-3">
				<span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${color} bg-current/10`}>
					<span className={`w-1.5 h-1.5 rounded-full ${bgColor}`} />
					{label}
				</span>
			</td>
			<td className="px-3 py-3">
				<span className="text-xs font-mono text-[#8b8b9e]">{formatSize(torrent.downloaded)}</span>
			</td>
			<td className="px-3 py-3">
				<span className="text-xs font-mono text-[#8b8b9e]">{formatSize(torrent.uploaded)}</span>
			</td>
			<td className="px-3 py-3">
				<span className="text-xs font-mono font-medium text-[#00d4aa]">
					{formatSpeed(torrent.dlspeed, false)}
				</span>
			</td>
			<td className="px-3 py-3">
				<span className="text-xs font-mono font-medium text-[#f7b731]">
					{formatSpeed(torrent.upspeed, false)}
				</span>
			</td>
			<td className="px-3 py-3">
				<span className="text-xs font-mono text-[#8b8b9e]">
					{torrent.ratio.toFixed(2)}
				</span>
			</td>
		</tr>
	)
}
