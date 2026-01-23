import { type Instance } from '../api/instances'
import { formatSize, formatCountdown } from '../utils/format'
import { Toggle, Select, MultiSelect } from './ui'
import { useCrossSeed, formatTimestamp, LOG_LEVEL_COLORS } from '../hooks/useCrossSeed'

interface Props {
	instances: Instance[]
}

export function CrossSeedManager({ instances }: Props) {
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

	if (instances.length === 0) {
		return (
			<div
				className="text-center py-12 rounded-lg border"
				style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
			>
				<p className="text-sm" style={{ color: 'var(--text-muted)' }}>
					No instances configured
				</p>
			</div>
		)
	}

	if (loading) {
		return (
			<div
				className="p-6 rounded-lg border flex items-center gap-3"
				style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
			>
				<div
					className="w-5 h-5 border-2 rounded-full animate-spin"
					style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
				/>
				<span className="text-sm" style={{ color: 'var(--text-muted)' }}>
					Loading...
				</span>
			</div>
		)
	}

	if (!config) return null

	return (
		<div className="flex flex-col h-full relative">
			<a
				href="https://github.com/Maciejonos/qbitwebui/issues"
				target="_blank"
				rel="noopener noreferrer"
				className="absolute top-0 right-0 px-3 py-2 rounded-lg border text-xs"
				style={{ borderColor: 'var(--error)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
			>
				<span style={{ color: 'var(--error)' }}>Experimental</span> · Report issues
			</a>
			<div
				className="shrink-0 flex items-center justify-between pb-4 border-b mb-4"
				style={{ borderColor: 'var(--border)' }}
			>
				<div className="flex items-center gap-4">
					<h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
						Cross-Seed
					</h1>
					{instances.length > 1 && (
						<Select
							value={String(selectedInstance ?? '')}
							onChange={(v) => setSelectedInstance(Number(v))}
							options={instances.map((i) => ({ value: String(i.id), label: i.label }))}
							minWidth="140px"
						/>
					)}
				</div>
				<div className="flex items-center gap-3">
					{(error || success) && (
						<span
							className="text-xs px-3 py-1 rounded"
							style={{
								backgroundColor: error
									? 'color-mix(in srgb, var(--error) 15%, transparent)'
									: 'color-mix(in srgb, #a6e3a1 15%, transparent)',
								color: error ? 'var(--error)' : '#a6e3a1',
							}}
						>
							{error || success}
						</span>
					)}
					{prowlarrIntegrations.length === 0 && (
						<span
							className="text-xs px-3 py-1 rounded"
							style={{
								backgroundColor: 'color-mix(in srgb, var(--warning) 15%, transparent)',
								color: 'var(--warning)',
							}}
						>
							No Prowlarr
						</span>
					)}
				</div>
			</div>

			<div
				className="shrink-0 grid grid-cols-5 gap-4 p-4 rounded-lg border mb-4"
				style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
			>
				<div>
					<div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
						Scheduler
					</div>
					<div className="text-sm font-medium" style={{ color: status?.enabled ? '#a6e3a1' : 'var(--text-muted)' }}>
						{status?.enabled ? 'On' : 'Off'}
					</div>
				</div>
				<div>
					<div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
						Status
					</div>
					<div
						className="text-sm font-medium flex items-center gap-2"
						style={{ color: isRunning ? 'var(--accent)' : 'var(--text-secondary)' }}
					>
						{isRunning && (
							<span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
						)}
						{isRunning ? 'Running' : 'Idle'}
					</div>
				</div>
				<div>
					<div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
						Last Run
					</div>
					<div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
						{formatTimestamp(status?.lastRun ?? null)}
					</div>
				</div>
				<div>
					<div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
						Next
					</div>
					<div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
						{status?.enabled ? formatCountdown(status?.nextRun ?? null) : '—'}
					</div>
				</div>
				<div>
					<div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
						Cache
					</div>
					<div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
						{cacheStats ? `${cacheStats.cache.count} (${formatSize(cacheStats.cache.totalSize)})` : '0'}
					</div>
				</div>
			</div>

			<div className="flex-1 grid grid-cols-2 grid-rows-[1fr] gap-4 min-h-0 overflow-hidden">
				<div className="flex flex-col gap-4 min-h-0 overflow-auto">
					<div
						className="shrink-0 p-4 rounded-lg border"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<div className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
							Configuration
						</div>
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<span className="text-sm" style={{ color: 'var(--text-primary)' }}>
									Enabled
								</span>
								<Toggle checked={config.enabled} onChange={(v) => setConfig({ ...config, enabled: v })} />
							</div>
							<div>
								<label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
									Prowlarr
								</label>
								<Select
									value={config.integration_id ? String(config.integration_id) : ''}
									onChange={(v) => setConfig({ ...config, integration_id: v ? Number(v) : null, indexer_ids: [] })}
									options={[
										{ value: '', label: 'None' },
										...prowlarrIntegrations.map((i) => ({ value: String(i.id), label: i.label })),
									]}
									minWidth="100%"
								/>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
										Interval (hours)
									</label>
									<input
										type="number"
										min="1"
										max="168"
										value={config.interval_hours}
										onChange={(e) => setConfig({ ...config, interval_hours: parseInt(e.target.value) || 24 })}
										className="w-full px-3 py-2 rounded-lg border text-sm"
										style={{
											backgroundColor: 'var(--bg-tertiary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
									/>
								</div>
								<div>
									<label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
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
										className="w-full px-3 py-2 rounded-lg border text-sm"
										style={{
											backgroundColor: 'var(--bg-tertiary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
									/>
								</div>
							</div>
							{availableIndexers.length > 0 && (
								<div>
									<label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
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
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
										Category Suffix
									</label>
									<input
										type="text"
										value={config.category_suffix}
										onChange={(e) => setConfig({ ...config, category_suffix: e.target.value })}
										className="w-full px-3 py-2 rounded-lg border text-sm"
										style={{
											backgroundColor: 'var(--bg-tertiary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
									/>
								</div>
								<div>
									<label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
										Tag
									</label>
									<input
										type="text"
										value={config.tag}
										onChange={(e) => setConfig({ ...config, tag: e.target.value })}
										className="w-full px-3 py-2 rounded-lg border text-sm"
										style={{
											backgroundColor: 'var(--bg-tertiary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
									/>
								</div>
							</div>
							<div>
								<label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
									Match Mode
								</label>
								<Select
									value={config.match_mode}
									onChange={(v) => setConfig({ ...config, match_mode: v as 'strict' | 'flexible' })}
									options={[
										{ value: 'strict', label: 'Strict (names must match)' },
										{ value: 'flexible', label: 'Flexible (sizes only, requires link_dir)' },
									]}
									minWidth="100%"
								/>
							</div>
							{config.match_mode === 'flexible' && (
								<div>
									<label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
										Link Directory (for flexible mode)
									</label>
									<input
										type="text"
										value={config.link_dir || ''}
										onChange={(e) => setConfig({ ...config, link_dir: e.target.value || null })}
										placeholder="/path/to/links"
										className="w-full px-3 py-2 rounded-lg border text-sm"
										style={{
											backgroundColor: 'var(--bg-tertiary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
									/>
									<p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
										Hardlinks will be created here when file names differ
									</p>
								</div>
							)}
							<div>
								<label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
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
									placeholder="name:YIFY&#10;nameRegex:.*-RARBG$&#10;category:movies&#10;tag:private&#10;sizeBelow:100MB"
									rows={4}
									className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
									style={{
										backgroundColor: 'var(--bg-tertiary)',
										borderColor: 'var(--border)',
										color: 'var(--text-primary)',
										resize: 'vertical',
									}}
								/>
								<p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
									Format: type:value (name, nameRegex, folder, folderRegex, category, tag, tracker, infoHash, sizeBelow,
									sizeAbove)
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
							<div className="flex items-center justify-end pt-2">
								<button
									onClick={handleSave}
									disabled={saving}
									className="px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
									style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
								>
									{saving ? 'Saving...' : 'Save Configuration'}
								</button>
							</div>
						</div>
					</div>

					<div
						className="shrink-0 p-4 rounded-lg border"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<div className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
							Actions
						</div>
						<div className="grid grid-cols-2 gap-3">
							<button
								onClick={() => handleScan(false)}
								disabled={isRunning || !config.integration_id}
								className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
								style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
							>
								Scan
							</button>
							<button
								onClick={() => handleScan(true)}
								disabled={isRunning || !config.integration_id}
								className="px-3 py-2 rounded-lg text-sm border disabled:opacity-50"
								style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
							>
								Force Scan
							</button>
							<button
								onClick={handleStop}
								disabled={!isRunning}
								className="px-3 py-2 rounded-lg text-sm border disabled:opacity-50"
								style={{
									borderColor: isRunning ? 'var(--error)' : 'var(--border)',
									color: isRunning ? 'var(--error)' : 'var(--text-muted)',
								}}
							>
								Stop
							</button>
							<button
								onClick={handleClearCache}
								className="px-3 py-2 rounded-lg text-sm border"
								style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
							>
								Clear Torrents
							</button>
						</div>
					</div>
				</div>

				<div
					className="flex flex-col p-4 rounded-lg border h-full min-h-0 overflow-hidden"
					style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
				>
					<div className="shrink-0 flex items-center justify-between mb-4">
						<div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
							Logs
						</div>
						<div className="flex items-center gap-4">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								{logs.length} entries
							</span>
							<label className="flex items-center gap-2 cursor-pointer">
								<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
									Auto-scroll
								</span>
								<Toggle checked={autoScroll} onChange={setAutoScroll} />
							</label>
						</div>
					</div>
					<div
						ref={logsContainerRef}
						className="h-0 grow overflow-y-auto rounded-lg p-3 font-mono text-xs leading-relaxed"
						style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
					>
						{logs.length === 0 ? (
							<div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
								No logs
							</div>
						) : (
							logs.map((log, i) => (
								<div key={i} className="py-0.5 whitespace-pre-wrap break-all">
									<span style={{ color: 'var(--text-muted)' }}>{log.timestamp.slice(11, 19)}</span>{' '}
									<span style={{ color: LOG_LEVEL_COLORS[log.level] || 'var(--text-muted)' }}>[{log.level}]</span>{' '}
									<span>{log.message}</span>
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
