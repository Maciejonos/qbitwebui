import { useState, useEffect } from 'react'
import { type Instance } from '../api/instances'
import { getIntegrations, type Integration } from '../api/integrations'
import {
	getCrossSeedConfig,
	updateCrossSeedConfig,
	triggerScan,
	getInstanceStatus,
	clearCache,
	clearHistory,
	getCacheStats,
	type CrossSeedConfig,
	type SchedulerStatus,
	type CacheStats,
} from '../api/crossSeed'
import { formatSize } from '../utils/format'
import { Toggle, Select } from './ui'

interface Props {
	instances: Instance[]
}

export function CrossSeedManager({ instances }: Props) {
	const [selectedInstance, setSelectedInstance] = useState<number | null>(instances[0]?.id ?? null)
	const [config, setConfig] = useState<CrossSeedConfig | null>(null)
	const [status, setStatus] = useState<SchedulerStatus | null>(null)
	const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
	const [integrations, setIntegrations] = useState<Integration[]>([])
	const [loading, setLoading] = useState(false)
	const [scanning, setScanning] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState('')
	const [saving, setSaving] = useState(false)

	useEffect(() => {
		getIntegrations().then(setIntegrations).catch(() => {})
	}, [])

	useEffect(() => {
		if (!selectedInstance) return
		setLoading(true)
		setError('')
		Promise.all([
			getCrossSeedConfig(selectedInstance),
			getInstanceStatus(selectedInstance),
			getCacheStats(selectedInstance),
		])
			.then(([cfg, st, cs]) => {
				setConfig(cfg)
				setStatus(st)
				setCacheStats(cs)
			})
			.catch((e) => setError(e.message))
			.finally(() => setLoading(false))
	}, [selectedInstance])

	useEffect(() => {
		if (!selectedInstance || !status?.running) return
		const interval = setInterval(() => {
			getInstanceStatus(selectedInstance).then(setStatus).catch(() => {})
		}, 2000)
		return () => clearInterval(interval)
	}, [selectedInstance, status?.running])

	async function handleSave() {
		if (!selectedInstance || !config) return
		setSaving(true)
		setError('')
		setSuccess('')
		try {
			await updateCrossSeedConfig(selectedInstance, {
				enabled: config.enabled,
				interval_hours: config.interval_hours,
				dry_run: config.dry_run,
				category_suffix: config.category_suffix,
				tag: config.tag,
				skip_recheck: config.skip_recheck,
				integration_id: config.integration_id,
			})
			setSuccess('Configuration saved')
			setTimeout(() => setSuccess(''), 3000)
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to save')
		} finally {
			setSaving(false)
		}
	}

	async function handleScan(force: boolean) {
		if (!selectedInstance) return
		setScanning(true)
		setError('')
		setSuccess('')
		try {
			const result = await triggerScan(selectedInstance, force)
			setSuccess(
				`Scan complete: ${result.torrentsScanned} scanned, ${result.matchesFound} matches, ${result.torrentsAdded} added`
			)
			getInstanceStatus(selectedInstance).then(setStatus).catch(() => {})
			getCacheStats(selectedInstance).then(setCacheStats).catch(() => {})
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Scan failed')
		} finally {
			setScanning(false)
		}
	}

	async function handleClearCache() {
		if (!selectedInstance) return
		try {
			const result = await clearCache(selectedInstance)
			setSuccess(`Cleared ${result.cacheCleared} cache files and ${result.outputCleared} output files`)
			getCacheStats(selectedInstance).then(setCacheStats).catch(() => {})
			setTimeout(() => setSuccess(''), 3000)
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to clear cache')
		}
	}

	async function handleClearHistory() {
		if (!selectedInstance) return
		try {
			const result = await clearHistory(selectedInstance)
			setSuccess(`Cleared ${result.deleted} search history entries`)
			setTimeout(() => setSuccess(''), 3000)
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to clear history')
		}
	}

	function formatTimestamp(ts: number | null): string {
		if (!ts) return 'Never'
		return new Date(ts * 1000).toLocaleString()
	}

	function formatNextRun(ts: number | null): string {
		if (!ts) return 'Not scheduled'
		const now = Math.floor(Date.now() / 1000)
		const diff = ts - now
		if (diff <= 0) return 'Imminent'
		const hours = Math.floor(diff / 3600)
		const mins = Math.floor((diff % 3600) / 60)
		if (hours > 0) return `in ${hours}h ${mins}m`
		return `in ${mins}m`
	}

	const prowlarrIntegrations = integrations.filter((i) => i.type === 'prowlarr')

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
						Cross-Seed
					</h1>
					<p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
						Find matching torrents across trackers
					</p>
				</div>
				{instances.length > 1 && (
					<Select
						value={String(selectedInstance ?? '')}
						onChange={(v) => setSelectedInstance(Number(v))}
						options={instances.map((i) => ({ value: String(i.id), label: i.label }))}
					/>
				)}
			</div>

			{error && (
				<div
					className="mb-6 px-4 py-3 rounded-lg text-sm"
					style={{ backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)', color: 'var(--error)' }}
				>
					{error}
				</div>
			)}

			{success && (
				<div
					className="mb-6 px-4 py-3 rounded-lg text-sm"
					style={{ backgroundColor: 'color-mix(in srgb, #a6e3a1 10%, transparent)', color: '#a6e3a1' }}
				>
					{success}
				</div>
			)}

			{instances.length === 0 ? (
				<div
					className="text-center py-12 rounded-xl border"
					style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
				>
					<p className="text-sm" style={{ color: 'var(--text-muted)' }}>
						No instances configured
					</p>
				</div>
			) : loading ? (
				<div
					className="p-6 rounded-xl border flex items-center gap-3"
					style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
				>
					<div
						className="w-5 h-5 border-2 rounded-full animate-spin"
						style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
					/>
					<span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
						Loading configuration...
					</span>
				</div>
			) : config ? (
				<div className="space-y-6">
					{prowlarrIntegrations.length === 0 && (
						<div
							className="px-4 py-3 rounded-lg text-sm"
							style={{ backgroundColor: 'color-mix(in srgb, var(--warning) 10%, transparent)', color: 'var(--warning)' }}
						>
							No Prowlarr integration configured. Add one in Tools → Prowlarr to enable cross-seeding.
						</div>
					)}

					<div
						className="p-6 rounded-xl border"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
							Status
						</h2>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<div>
								<div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
									Scheduler
								</div>
								<div
									className="text-sm font-medium"
									style={{ color: status?.enabled ? '#a6e3a1' : 'var(--text-muted)' }}
								>
									{status?.enabled ? 'Enabled' : 'Disabled'}
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
									Next Run
								</div>
								<div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
									{status?.enabled ? formatNextRun(status?.nextRun ?? null) : 'Disabled'}
								</div>
							</div>
							<div>
								<div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
									Cache
								</div>
								<div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
									{cacheStats ? `${cacheStats.cache.count} files (${formatSize(cacheStats.cache.totalSize)})` : '0 files'}
								</div>
							</div>
						</div>

						{status?.running && (
							<div className="mt-4 flex items-center gap-3">
								<div
									className="w-4 h-4 border-2 rounded-full animate-spin"
									style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
								/>
								<span className="text-sm" style={{ color: 'var(--accent)' }}>
									Scan in progress...
								</span>
							</div>
						)}

						{status?.lastResult && !status.running && (
							<div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
								<div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
									Last Result
								</div>
								<div className="flex gap-4 text-sm">
									<span style={{ color: 'var(--text-secondary)' }}>
										Scanned: <strong style={{ color: 'var(--text-primary)' }}>{status.lastResult.torrentsScanned}</strong>
									</span>
									<span style={{ color: 'var(--text-secondary)' }}>
										Matches: <strong style={{ color: 'var(--accent)' }}>{status.lastResult.matchesFound}</strong>
									</span>
									<span style={{ color: 'var(--text-secondary)' }}>
										Added: <strong style={{ color: '#a6e3a1' }}>{status.lastResult.torrentsAdded}</strong>
									</span>
								</div>
							</div>
						)}
					</div>

					<div
						className="p-6 rounded-xl border"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
							Configuration
						</h2>
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<div>
									<div className="text-sm" style={{ color: 'var(--text-primary)' }}>
										Enable Scheduler
									</div>
									<div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
										Automatically scan for cross-seeds periodically
									</div>
								</div>
								<Toggle checked={config.enabled} onChange={(v) => setConfig({ ...config, enabled: v })} />
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label
										className="block text-xs font-medium mb-2 uppercase tracking-wider"
										style={{ color: 'var(--text-muted)' }}
									>
										Prowlarr Integration
									</label>
									<Select
										value={config.integration_id ? String(config.integration_id) : ''}
										onChange={(v) => setConfig({ ...config, integration_id: v ? Number(v) : null })}
										options={[
											{ value: '', label: 'None' },
											...prowlarrIntegrations.map((i) => ({ value: String(i.id), label: i.label })),
										]}
									/>
								</div>
								<div>
									<label
										className="block text-xs font-medium mb-2 uppercase tracking-wider"
										style={{ color: 'var(--text-muted)' }}
									>
										Scan Interval (hours)
									</label>
									<input
										type="number"
										min="1"
										max="168"
										value={config.interval_hours}
										onChange={(e) => setConfig({ ...config, interval_hours: parseInt(e.target.value) || 24 })}
										className="w-full px-4 py-2.5 rounded-lg border text-sm"
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
									<label
										className="block text-xs font-medium mb-2 uppercase tracking-wider"
										style={{ color: 'var(--text-muted)' }}
									>
										Category Suffix
									</label>
									<input
										type="text"
										value={config.category_suffix}
										onChange={(e) => setConfig({ ...config, category_suffix: e.target.value })}
										className="w-full px-4 py-2.5 rounded-lg border text-sm"
										style={{
											backgroundColor: 'var(--bg-tertiary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
										placeholder="_cross-seed"
									/>
								</div>
								<div>
									<label
										className="block text-xs font-medium mb-2 uppercase tracking-wider"
										style={{ color: 'var(--text-muted)' }}
									>
										Tag
									</label>
									<input
										type="text"
										value={config.tag}
										onChange={(e) => setConfig({ ...config, tag: e.target.value })}
										className="w-full px-4 py-2.5 rounded-lg border text-sm"
										style={{
											backgroundColor: 'var(--bg-tertiary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
										placeholder="cross-seed"
									/>
								</div>
							</div>

							<div className="flex items-center justify-between">
								<div>
									<div className="text-sm" style={{ color: 'var(--text-primary)' }}>
										Dry Run
									</div>
									<div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
										Save torrents to output folder instead of adding to client
									</div>
								</div>
								<Toggle checked={config.dry_run} onChange={(v) => setConfig({ ...config, dry_run: v })} />
							</div>

							<div className="flex items-center justify-between">
								<div>
									<div className="text-sm" style={{ color: 'var(--text-primary)' }}>
										Skip Recheck
									</div>
									<div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
										Skip rechecking when adding torrents
									</div>
								</div>
								<Toggle checked={config.skip_recheck} onChange={(v) => setConfig({ ...config, skip_recheck: v })} />
							</div>

							<div className="flex gap-3 pt-4">
								<button
									onClick={handleSave}
									disabled={saving}
									className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
									style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
								>
									{saving ? 'Saving...' : 'Save Configuration'}
								</button>
							</div>
						</div>
					</div>

					<div
						className="p-6 rounded-xl border"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
							Actions
						</h2>
						<div className="flex flex-wrap gap-3">
							<button
								onClick={() => handleScan(false)}
								disabled={scanning || status?.running || !config.integration_id}
								className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
								style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
							>
								{scanning || status?.running ? 'Scanning...' : 'Run Scan'}
							</button>
							<button
								onClick={() => handleScan(true)}
								disabled={scanning || status?.running || !config.integration_id}
								className="px-4 py-2 rounded-lg text-sm border disabled:opacity-50"
								style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
							>
								Force Full Scan
							</button>
							<button
								onClick={handleClearCache}
								className="px-4 py-2 rounded-lg text-sm border"
								style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
							>
								Clear Cache
							</button>
							<button
								onClick={handleClearHistory}
								className="px-4 py-2 rounded-lg text-sm border"
								style={{ borderColor: 'var(--border)', color: 'var(--warning)' }}
							>
								Clear History
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	)
}
