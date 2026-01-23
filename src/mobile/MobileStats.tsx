import { useQueries } from '@tanstack/react-query'
import { ArrowDown, ArrowUp } from 'lucide-react'
import * as api from '../api/qbittorrent'
import type { Instance } from '../api/instances'
import { formatSpeed, formatSize } from '../utils/format'

interface Props {
	instances: Instance[]
}

export function MobileStats({ instances }: Props) {
	const torrentQueries = useQueries({
		queries: instances.map((instance) => ({
			queryKey: ['torrents', instance.id],
			queryFn: () => api.getTorrents(instance.id),
			refetchInterval: 2000,
		})),
	})

	const transferQueries = useQueries({
		queries: instances.map((instance) => ({
			queryKey: ['transfer', instance.id],
			queryFn: () => api.getTransferInfo(instance.id),
			refetchInterval: 2000,
		})),
	})

	const syncQueries = useQueries({
		queries: instances.map((instance) => ({
			queryKey: ['syncMaindata', instance.id],
			queryFn: () => api.getSyncMaindata(instance.id),
			refetchInterval: 2000,
		})),
	})

	const torrents = torrentQueries.flatMap((q) => q.data || [])
	const totalDownloadSpeed = transferQueries.reduce((sum, q) => sum + (q.data?.dl_info_speed || 0), 0)
	const totalUploadSpeed = transferQueries.reduce((sum, q) => sum + (q.data?.up_info_speed || 0), 0)
	const allTimeDownload = syncQueries.reduce((sum, q) => sum + (q.data?.server_state.alltime_dl || 0), 0)
	const allTimeUpload = syncQueries.reduce((sum, q) => sum + (q.data?.server_state.alltime_ul || 0), 0)

	const counts = {
		total: torrents.length,
		downloading: torrents.filter((t) =>
			['downloading', 'metaDL', 'forcedDL', 'stalledDL', 'allocating'].includes(t.state)
		).length,
		seeding: torrents.filter((t) => ['uploading', 'forcedUP', 'stalledUP'].includes(t.state)).length,
		paused: torrents.filter((t) => ['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP'].includes(t.state)).length,
	}

	return (
		<div className="space-y-3">
			<div className="grid grid-cols-2 gap-3">
				<div
					className="p-4 rounded-2xl border"
					style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
				>
					<div className="flex items-center gap-3">
						<div
							className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
							style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}
						>
							<ArrowDown className="w-5 h-5" style={{ color: 'var(--accent)' }} strokeWidth={2} />
						</div>
						<div className="min-w-0">
							<div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
								Download
							</div>
							<div
								className="text-base font-semibold tabular-nums truncate"
								style={{ color: 'var(--text-primary)', minHeight: '1.5rem' }}
							>
								{formatSpeed(totalDownloadSpeed)}
							</div>
						</div>
					</div>
				</div>

				<div
					className="p-4 rounded-2xl border"
					style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
				>
					<div className="flex items-center gap-3">
						<div
							className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
							style={{ backgroundColor: 'color-mix(in srgb, #a6e3a1 15%, transparent)' }}
						>
							<ArrowUp className="w-5 h-5" style={{ color: '#a6e3a1' }} strokeWidth={2} />
						</div>
						<div className="min-w-0">
							<div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
								Upload
							</div>
							<div
								className="text-base font-semibold tabular-nums truncate"
								style={{ color: 'var(--text-primary)', minHeight: '1.5rem' }}
							>
								{formatSpeed(totalUploadSpeed)}
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-4 gap-2">
				{[
					{ label: 'Total', value: counts.total, color: 'var(--text-primary)' },
					{ label: 'Leech', value: counts.downloading, color: 'var(--accent)' },
					{ label: 'Seed', value: counts.seeding, color: '#a6e3a1' },
					{ label: 'Paused', value: counts.paused, color: 'var(--text-muted)' },
				].map((item) => (
					<div
						key={item.label}
						className="p-3 rounded-xl border text-center"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<div className="text-xl font-bold tabular-nums" style={{ color: item.color }}>
							{item.value}
						</div>
						<div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>
							{item.label}
						</div>
					</div>
				))}
			</div>

			<div className="grid grid-cols-2 gap-3">
				<div
					className="p-3 rounded-xl border"
					style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
				>
					<div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
						All-Time Down
					</div>
					<div className="text-base font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>
						{formatSize(allTimeDownload)}
					</div>
				</div>
				<div
					className="p-3 rounded-xl border"
					style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
				>
					<div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
						All-Time Up
					</div>
					<div className="text-base font-semibold tabular-nums" style={{ color: '#a6e3a1' }}>
						{formatSize(allTimeUpload)}
					</div>
				</div>
			</div>
		</div>
	)
}
