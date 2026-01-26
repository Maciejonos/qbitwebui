import type { ReactNode } from 'react'
import { ChevronLeft, ArrowDown, ArrowUp, AlertCircle } from 'lucide-react'
import { formatSize } from '../utils/format'
import { useStats } from '../hooks/useStats'

interface Props {
	onBack: () => void
}

export function MobileStatistics({ onBack }: Props): ReactNode {
	const { periodData, instances, selectedInstance, setSelectedInstance, isLoading, hasAnyData } = useStats()

	return (
		<div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
			<div
				className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b"
				style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}
			>
				<button onClick={onBack} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-muted)' }}>
					<ChevronLeft className="w-6 h-6" />
				</button>
				<h1 className="text-lg font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>
					Statistics
				</h1>
			</div>

			<div className="p-4 space-y-4">
				{instances.length > 1 && (
					<div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
						<button
							onClick={() => setSelectedInstance('all')}
							className="px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors"
							style={{
								backgroundColor: selectedInstance === 'all' ? 'var(--accent)' : 'var(--bg-secondary)',
								color: selectedInstance === 'all' ? 'var(--accent-contrast)' : 'var(--text-secondary)',
							}}
						>
							All
						</button>
						{instances.map((inst) => (
							<button
								key={inst.id}
								onClick={() => setSelectedInstance(String(inst.id))}
								className="px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors"
								style={{
									backgroundColor: selectedInstance === String(inst.id) ? 'var(--accent)' : 'var(--bg-secondary)',
									color: selectedInstance === String(inst.id) ? 'var(--accent-contrast)' : 'var(--text-secondary)',
								}}
							>
								{inst.label}
							</button>
						))}
					</div>
				)}

				{isLoading ? (
					<div className="flex items-center justify-center py-12">
						<div
							className="w-6 h-6 border-2 rounded-full animate-spin"
							style={{
								borderColor: 'color-mix(in srgb, var(--accent) 20%, transparent)',
								borderTopColor: 'var(--accent)',
							}}
						/>
					</div>
				) : (
					<>
						{!hasAnyData && (
							<div
								className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
								style={{
									backgroundColor: 'color-mix(in srgb, var(--warning) 10%, transparent)',
									color: 'var(--warning)',
								}}
							>
								<AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
								<div>
									<div className="font-medium">No data yet</div>
									<div className="text-xs opacity-80 mt-0.5">Stats recorded every 5 min</div>
								</div>
							</div>
						)}

						<div className="space-y-2">
							{periodData!.map((data) => (
								<div
									key={data.period}
									className="px-4 py-3 rounded-xl border"
									style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
								>
									<div className="flex items-center justify-between">
										<div
											className="text-xs font-medium uppercase tracking-wider"
											style={{ color: 'var(--text-muted)' }}
										>
											{data.label}
										</div>
										<div className="flex items-center gap-4">
											<div className="flex items-center gap-1.5">
												<ArrowDown className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
												<span
													className="text-sm font-semibold tabular-nums"
													style={{ color: data.hasData ? 'var(--accent)' : 'var(--text-muted)' }}
												>
													{data.hasData ? formatSize(data.downloaded) : 'N/A'}
												</span>
											</div>
											<div className="flex items-center gap-1.5">
												<ArrowUp className="w-3.5 h-3.5" style={{ color: '#a6e3a1' }} />
												<span
													className="text-sm font-semibold tabular-nums"
													style={{ color: data.hasData ? '#a6e3a1' : 'var(--text-muted)' }}
												>
													{data.hasData ? formatSize(data.uploaded) : 'N/A'}
												</span>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>

						<ul className="text-xs space-y-1 list-disc list-inside" style={{ color: 'var(--text-muted)' }}>
							<li>Stats recorded every 5 minutes</li>
							<li>All time values from qBittorrent</li>
							<li>Other periods show difference from historical snapshots</li>
							<li>Downloads include protocol traffic, not just file data</li>
						</ul>
					</>
				)}
			</div>
		</div>
	)
}
