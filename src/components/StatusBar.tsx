import { useState, useRef, useEffect, useCallback } from 'react'
import {
	ChevronDown,
	ArrowDown,
	ArrowUp,
	Zap,
	ChevronsLeft,
	ChevronsRight,
	ChevronLeft,
	ChevronRight,
} from 'lucide-react'
import { useTransferInfo } from '../hooks/useTransferInfo'
import { useSyncMaindata } from '../hooks/useSyncMaindata'
import { usePagination } from '../hooks/usePagination'
import { useInstance } from '../hooks/useInstance'
import { PER_PAGE_OPTIONS } from '../utils/pagination'
import { formatSpeed, formatSize } from '../utils/format'
import { getSpeedLimitsMode, toggleSpeedLimitsMode } from '../api/qbittorrent'

function formatLimit(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)}M`
	return `${(bytes / 1024).toFixed(0)}K`
}

function PerPageDropdown({ value, onChange }: { value: number; onChange: (v: number) => void }) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	return (
		<div ref={ref} className="relative">
			<button
				onClick={() => setOpen(!open)}
				className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all duration-200"
				style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-tertiary)' }}
			>
				<span>{value}</span>
				<ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
			</button>
			{open && (
				<div
					className="absolute bottom-full left-0 mb-1 min-w-[60px] rounded-lg border shadow-xl z-[100]"
					style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
				>
					{PER_PAGE_OPTIONS.map((n) => (
						<button
							key={n}
							onClick={() => {
								onChange(n)
								setOpen(false)
							}}
							className="w-full px-3 py-1.5 text-xs text-left transition-colors"
							style={{
								color: value === n ? 'var(--accent)' : 'var(--text-muted)',
								backgroundColor: value === n ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
							}}
						>
							{n}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

function useAltSpeedMode(instanceId: number) {
	const [enabled, setEnabled] = useState(false)
	const [toggling, setToggling] = useState(false)

	useEffect(() => {
		let mounted = true
		const checkMode = async () => {
			const mode = await getSpeedLimitsMode(instanceId).catch(() => 0)
			if (mounted) setEnabled(mode === 1)
		}
		checkMode()
		const interval = setInterval(checkMode, 2000)
		return () => {
			mounted = false
			clearInterval(interval)
		}
	}, [instanceId])

	const toggle = useCallback(async () => {
		if (toggling) return
		setToggling(true)
		const ok = await toggleSpeedLimitsMode(instanceId)
			.then(() => true)
			.catch(() => false)
		if (ok) setEnabled((prev) => !prev)
		setToggling(false)
	}, [instanceId, toggling])

	return { enabled, toggling, toggle }
}

export function StatusBar() {
	const instance = useInstance()
	const { data } = useTransferInfo()
	const { data: syncData } = useSyncMaindata()
	const { page, perPage, totalItems, totalPages, setPage, setPerPage } = usePagination()
	const altSpeed = useAltSpeedMode(instance.id)

	const statusConfig = {
		connected: { label: 'Connected', type: 'success' as const },
		firewalled: { label: 'Firewalled', type: 'warning' as const },
		disconnected: { label: 'Disconnected', type: 'error' as const },
	}[data?.connection_status ?? 'disconnected']

	const statusColors = {
		success: 'var(--accent)',
		warning: 'var(--warning)',
		error: 'var(--error)',
	}

	const startItem = totalItems === 0 ? 0 : (page - 1) * perPage + 1
	const endItem = Math.min(page * perPage, totalItems)

	return (
		<div
			className="relative grid grid-cols-3 items-center px-6 py-3 backdrop-blur-md border-t"
			style={{
				backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 80%, transparent)',
				borderColor: 'var(--border)',
			}}
		>
			<div
				className="absolute inset-0"
				style={{
					background:
						'linear-gradient(to right, transparent, color-mix(in srgb, var(--accent) 1%, transparent), transparent)',
				}}
			/>

			<div className="relative flex items-center gap-6">
				<div className="flex items-center gap-2.5">
					<div
						className="w-2 h-2 rounded-full shadow-lg"
						style={{
							backgroundColor: statusColors[statusConfig.type],
							boxShadow: `0 0 10px ${statusColors[statusConfig.type]}50`,
						}}
					/>
					<span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
						{statusConfig.label}
					</span>
				</div>

				<div className="h-4 w-px" style={{ backgroundColor: 'var(--border)' }} />

				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2">
						<ArrowDown className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} strokeWidth={2} />
						<span className="text-xs font-mono font-medium" style={{ color: 'var(--accent)' }}>
							{formatSpeed(data?.dl_info_speed ?? 0)}
						</span>
						{(data?.dl_rate_limit ?? 0) > 0 && (
							<span
								className="px-1.5 py-0.5 rounded text-[10px] font-medium"
								style={{
									backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)',
									color: 'var(--accent)',
								}}
								title={`Download limit: ${formatSpeed(data?.dl_rate_limit ?? 0)}`}
							>
								{formatLimit(data?.dl_rate_limit ?? 0)}
							</span>
						)}
					</div>
					<div className="flex items-center gap-2">
						<ArrowUp className="w-3.5 h-3.5" style={{ color: 'var(--warning)' }} strokeWidth={2} />
						<span className="text-xs font-mono font-medium" style={{ color: 'var(--warning)' }}>
							{formatSpeed(data?.up_info_speed ?? 0)}
						</span>
						{(data?.up_rate_limit ?? 0) > 0 && (
							<span
								className="px-1.5 py-0.5 rounded text-[10px] font-medium"
								style={{
									backgroundColor: 'color-mix(in srgb, var(--warning) 20%, transparent)',
									color: 'var(--warning)',
								}}
								title={`Upload limit: ${formatSpeed(data?.up_rate_limit ?? 0)}`}
							>
								{formatLimit(data?.up_rate_limit ?? 0)}
							</span>
						)}
					</div>
				</div>

				<div className="h-4 w-px" style={{ backgroundColor: 'var(--border)' }} />

				<button
					onClick={altSpeed.toggle}
					disabled={altSpeed.toggling}
					className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all"
					style={{
						backgroundColor: altSpeed.enabled
							? 'color-mix(in srgb, var(--accent) 20%, transparent)'
							: 'var(--bg-tertiary)',
						color: altSpeed.enabled ? 'var(--accent)' : 'var(--text-muted)',
						opacity: altSpeed.toggling ? 0.5 : 1,
					}}
					title={
						altSpeed.enabled
							? 'Alternative speed limits active (click to disable)'
							: 'Click to enable alternative speed limits'
					}
				>
					<Zap className="w-3.5 h-3.5" strokeWidth={2} />
					<span>Alt</span>
				</button>
			</div>

			<div className="relative flex items-center justify-center gap-3">
				<div className="flex items-center gap-1">
					<button
						onClick={() => setPage(1)}
						disabled={page === 1}
						className="p-1 rounded transition-colors disabled:opacity-30"
						style={{ color: 'var(--text-muted)' }}
					>
						<ChevronsLeft className="w-3.5 h-3.5" strokeWidth={2} />
					</button>
					<button
						onClick={() => setPage(page - 1)}
						disabled={page === 1}
						className="p-1 rounded transition-colors disabled:opacity-30"
						style={{ color: 'var(--text-muted)' }}
					>
						<ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
					</button>
				</div>
				<span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
					{startItem}-{endItem} of {totalItems}
				</span>
				<div className="flex items-center gap-1">
					<button
						onClick={() => setPage(page + 1)}
						disabled={page === totalPages}
						className="p-1 rounded transition-colors disabled:opacity-30"
						style={{ color: 'var(--text-muted)' }}
					>
						<ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
					</button>
					<button
						onClick={() => setPage(totalPages)}
						disabled={page === totalPages}
						className="p-1 rounded transition-colors disabled:opacity-30"
						style={{ color: 'var(--text-muted)' }}
					>
						<ChevronsRight className="w-3.5 h-3.5" strokeWidth={2} />
					</button>
				</div>
				<PerPageDropdown value={perPage} onChange={setPerPage} />
			</div>

			<div className="relative flex items-center justify-end gap-4">
				<div
					className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
					style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
				>
					<span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
						Total
					</span>
					<span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>
						{formatSize(syncData?.server_state.alltime_dl ?? 0)}
					</span>
					<span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
						/
					</span>
					<span className="text-xs font-mono" style={{ color: 'var(--warning)' }}>
						{formatSize(syncData?.server_state.alltime_ul ?? 0)}
					</span>
				</div>
				<div
					className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
					style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
				>
					<span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
						DHT
					</span>
					<span className="text-xs font-mono font-medium" style={{ color: 'var(--text-secondary)' }}>
						{data?.dht_nodes ?? 0}
					</span>
				</div>
			</div>
		</div>
	)
}
