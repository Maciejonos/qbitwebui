import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft } from 'lucide-react'
import { type Instance } from '../api/instances'
import { formatSize, formatCountdown } from '../utils/format'
import { Toggle, Select, MultiSelect } from '../components/ui'
import { useCrossSeed, LOG_LEVEL_COLORS } from '../hooks/useCrossSeed'

interface Props {
	instances: Instance[]
	onBack: () => void
}

export function MobileCrossSeedManager({ instances, onBack }: Props): ReactNode {
	const [showLogs, setShowLogs] = useState(false)
	const {
		selectedInstance,
		setSelectedInstance,
		config,
		setConfig,
		status,
		cacheStats,
		availableIndexers,
		logs,
		loading,
		error,
		success,
		saving,
		autoScroll,
		setAutoScroll,
		logsContainerRef,
		prowlarrIntegrations,
		isRunning,
		handleSave,
		handleScan,
		handleStop,
		handleClearCache,
	} = useCrossSeed(instances)

	return (
		<div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
			<header
				className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b"
				style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}
			>
				<button onClick={onBack} className="p-2 -ml-2 rounded-lg active:bg-[var(--bg-tertiary)]">
					<ChevronLeft className="w-5 h-5" style={{ color: 'var(--text-primary)' }} strokeWidth={2} />
				</button>
				<h1 className="text-lg font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>
					Cross-Seed
				</h1>
				<a
					href="https://github.com/Maciejonos/qbitwebui/issues"
					target="_blank"
					rel="noopener noreferrer"
					className="px-2 py-1 rounded-lg border text-xs"
					style={{ borderColor: 'var(--error)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
				>
					<span style={{ color: 'var(--error)' }}>Experimental</span>
				</a>
			</header>

			<div className="flex-1 p-4 space-y-4">
				{instances.length > 1 && (
					<Select
						value={String(selectedInstance ?? '')}
						onChange={(v) => setSelectedInstance(Number(v))}
						options={instances.map((i) => ({ value: String(i.id), label: i.label }))}
					/>
				)}

				{error && (
					<div
						className="px-4 py-3 rounded-xl text-sm"
						style={{ backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)', color: 'var(--error)' }}
					>
						{error}
					</div>
				)}

				{success && (
					<div
						className="px-4 py-3 rounded-xl text-sm"
						style={{ backgroundColor: 'color-mix(in srgb, #a6e3a1 10%, transparent)', color: '#a6e3a1' }}
					>
						{success}
					</div>
				)}

				{loading ? (
					<div className="flex items-center justify-center p-8">
						<div
							className="w-6 h-6 border-2 rounded-full animate-spin"
							style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
						/>
					</div>
				) : config ? (
					<>
						{prowlarrIntegrations.length === 0 && (
							<div
								className="px-4 py-3 rounded-xl text-sm"
								style={{
									backgroundColor: 'color-mix(in srgb, var(--warning) 10%, transparent)',
									color: 'var(--warning)',
								}}
							>
								No Prowlarr integration configured
							</div>
						)}

						<div
							className="p-4 rounded-xl border"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
						>
							<div className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
								Status
							</div>
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<div className="mb-1" style={{ color: 'var(--text-muted)' }}>
										Scheduler
									</div>
									<div className="font-medium" style={{ color: status?.enabled ? '#a6e3a1' : 'var(--text-muted)' }}>
										{status?.enabled ? 'On' : 'Off'}
									</div>
								</div>
								<div>
									<div className="mb-1" style={{ color: 'var(--text-muted)' }}>
										Status
									</div>
									<div
										className="font-medium flex items-center gap-2"
										style={{ color: isRunning ? 'var(--accent)' : 'var(--text-secondary)' }}
									>
										{isRunning && (
											<span
												className="w-2 h-2 rounded-full animate-pulse"
												style={{ backgroundColor: 'var(--accent)' }}
											/>
										)}
										{isRunning ? 'Running' : 'Idle'}
									</div>
								</div>
								<div>
									<div className="mb-1" style={{ color: 'var(--text-muted)' }}>
										Next
									</div>
									<div style={{ color: 'var(--text-secondary)' }}>
										{status?.enabled ? formatCountdown(status?.nextRun ?? null) : '—'}
									</div>
								</div>
								<div>
									<div className="mb-1" style={{ color: 'var(--text-muted)' }}>
										Cache
									</div>
									<div style={{ color: 'var(--text-secondary)' }}>
										{cacheStats ? `${cacheStats.cache.count} (${formatSize(cacheStats.cache.totalSize)})` : '0'}
									</div>
								</div>
							</div>
						</div>

						<div
							className="p-4 rounded-xl border space-y-4"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
						>
							<div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
								Configuration
							</div>

							<div className="flex items-center justify-between">
								<span className="text-sm" style={{ color: 'var(--text-primary)' }}>
									Enabled
								</span>
								<Toggle checked={config.enabled} onChange={(v) => setConfig({ ...config, enabled: v })} />
							</div>

							<div>
								<label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
									Prowlarr
								</label>
								<Select
									value={config.integration_id ? String(config.integration_id) : ''}
									onChange={(v) => setConfig({ ...config, integration_id: v ? Number(v) : null, indexer_ids: [] })}
									options={[
										{ value: '', label: 'None' },
										...prowlarrIntegrations.map((i) => ({ value: String(i.id), label: i.label })),
									]}
								/>
							</div>

							{availableIndexers.length > 0 && (
								<div>
									<label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
										Indexers ({config.indexer_ids.length}/{availableIndexers.length})
									</label>
									<MultiSelect
										options={availableIndexers.map((idx) => ({ value: idx.id, label: idx.name }))}
										selected={config.indexer_ids}
										onChange={(ids) => setConfig({ ...config, indexer_ids: ids })}
										placeholder="Select indexers..."
									/>
								</div>
							)}

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
										Interval (hours)
									</label>
									<input
										type="number"
										min="1"
										max="168"
										value={config.interval_hours}
										onChange={(e) => setConfig({ ...config, interval_hours: parseInt(e.target.value) || 24 })}
										className="w-full px-3 py-2.5 rounded-lg border text-sm"
										style={{
											backgroundColor: 'var(--bg-tertiary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
									/>
								</div>
								<div>
									<label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
										Delay (30-3600s)
									</label>
									<input
										type="number"
										min="30"
										max="3600"
										value={config.delay_seconds}
										onChange={(e) =>
											setConfig({ ...config, delay_seconds: Math.max(30, parseInt(e.target.value) || 30) })
										}
										className="w-full px-3 py-2.5 rounded-lg border text-sm"
										style={{
											backgroundColor: 'var(--bg-tertiary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
									/>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
										Category Suffix
									</label>
									<input
										type="text"
										value={config.category_suffix}
										onChange={(e) => setConfig({ ...config, category_suffix: e.target.value })}
										className="w-full px-3 py-2.5 rounded-lg border text-sm"
										style={{
											backgroundColor: 'var(--bg-tertiary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
									/>
								</div>
								<div>
									<label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
										Tag
									</label>
									<input
										type="text"
										value={config.tag}
										onChange={(e) => setConfig({ ...config, tag: e.target.value })}
										className="w-full px-3 py-2.5 rounded-lg border text-sm"
										style={{
											backgroundColor: 'var(--bg-tertiary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
									/>
								</div>
							</div>

							<div>
								<label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
									Match Mode
								</label>
								<Select
									value={config.match_mode}
									onChange={(v) => setConfig({ ...config, match_mode: v as 'strict' | 'flexible' })}
									options={[
										{ value: 'strict', label: 'Strict (names must match)' },
										{ value: 'flexible', label: 'Flexible (sizes only)' },
									]}
									minWidth="100%"
								/>
							</div>

							{config.match_mode === 'flexible' && (
								<div>
									<label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
										Link Directory
									</label>
									<input
										type="text"
										value={config.link_dir || ''}
										onChange={(e) => setConfig({ ...config, link_dir: e.target.value || null })}
										placeholder="/path/to/links"
										className="w-full px-4 py-3 rounded-xl text-sm"
										style={{
											backgroundColor: 'var(--bg-tertiary)',
											color: 'var(--text-primary)',
										}}
									/>
									<p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
										Hardlinks created when file names differ
									</p>
								</div>
							)}

							<div>
								<label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
									Blocklist (one per line)
								</label>
								<textarea
									value={config.blocklist.join('\n')}
									onChange={(e) =>
										setConfig({
											...config,
											blocklist: e.target.value
												.split('\n')
												.map((s) => s.trim())
												.filter(Boolean),
										})
									}
									placeholder="name:YIFY&#10;nameRegex:.*-RARBG$&#10;category:movies"
									rows={4}
									className="w-full px-4 py-3 rounded-xl text-sm font-mono"
									style={{
										backgroundColor: 'var(--bg-tertiary)',
										color: 'var(--text-primary)',
										resize: 'vertical',
									}}
								/>
								<p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
									Format: type:value
								</p>
							</div>

							<div className="flex items-center justify-between">
								<span className="text-sm" style={{ color: 'var(--text-primary)' }}>
									Include Single Episodes
								</span>
								<Toggle
									checked={config.include_single_episodes}
									onChange={(v) => setConfig({ ...config, include_single_episodes: v })}
								/>
							</div>

							<div className="flex items-center justify-between">
								<span className="text-sm" style={{ color: 'var(--text-primary)' }}>
									Dry Run
								</span>
								<Toggle checked={config.dry_run} onChange={(v) => setConfig({ ...config, dry_run: v })} />
							</div>

							<div className="flex items-center justify-between">
								<span className="text-sm" style={{ color: 'var(--text-primary)' }}>
									Skip Recheck
								</span>
								<Toggle checked={config.skip_recheck} onChange={(v) => setConfig({ ...config, skip_recheck: v })} />
							</div>

							<button
								onClick={handleSave}
								disabled={saving}
								className="w-full py-3 rounded-xl text-sm font-medium disabled:opacity-50"
								style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
							>
								{saving ? 'Saving...' : 'Save Configuration'}
							</button>
						</div>

						<div
							className="p-4 rounded-xl border space-y-4"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
						>
							<div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
								Actions
							</div>
							<div className="grid grid-cols-2 gap-3">
								<button
									onClick={() => handleScan(false)}
									disabled={isRunning || !config.integration_id}
									className="py-3 rounded-xl text-sm font-medium disabled:opacity-50"
									style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
								>
									Scan
								</button>
								<button
									onClick={() => handleScan(true)}
									disabled={isRunning || !config.integration_id}
									className="py-3 rounded-xl text-sm border disabled:opacity-50"
									style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
								>
									Force Scan
								</button>
								<button
									onClick={handleStop}
									disabled={!isRunning}
									className="py-3 rounded-xl text-sm border disabled:opacity-50"
									style={{
										borderColor: isRunning ? 'var(--error)' : 'var(--border)',
										color: isRunning ? 'var(--error)' : 'var(--text-muted)',
									}}
								>
									Stop
								</button>
								<button
									onClick={handleClearCache}
									className="py-3 rounded-xl text-sm border"
									style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
								>
									Clear Torrents
								</button>
							</div>
						</div>

						<div
							className="p-4 rounded-xl border overflow-hidden"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
						>
							<button onClick={() => setShowLogs(!showLogs)} className="w-full flex items-center justify-between">
								<div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
									Logs ({logs.length} entries)
								</div>
								<ChevronDown
									className={`w-4 h-4 transition-transform ${showLogs ? 'rotate-180' : ''}`}
									style={{ color: 'var(--text-muted)' }}
									strokeWidth={2}
								/>
							</button>
							{showLogs && (
								<div className="mt-4 space-y-3">
									<div className="flex items-center justify-end">
										<label className="flex items-center gap-2 cursor-pointer">
											<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
												Auto-scroll
											</span>
											<Toggle checked={autoScroll} onChange={setAutoScroll} />
										</label>
									</div>
									<div
										ref={logsContainerRef}
										className="overflow-auto rounded-lg p-3 font-mono text-xs leading-relaxed max-h-[70vh]"
										style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
									>
										{logs.length === 0 ? (
											<div className="text-center py-6" style={{ color: 'var(--text-muted)' }}>
												No logs
											</div>
										) : (
											logs.map((log, i) => (
												<div key={i} className="py-0.5 whitespace-pre-wrap break-all">
													<span style={{ color: 'var(--text-muted)' }}>{log.timestamp.slice(11, 19)}</span>{' '}
													<span style={{ color: LOG_LEVEL_COLORS[log.level] || 'var(--text-muted)' }}>
														[{log.level}]
													</span>{' '}
													<span>{log.message}</span>
												</div>
											))
										)}
									</div>
								</div>
							)}
						</div>
					</>
				) : null}
			</div>
		</div>
	)
}
