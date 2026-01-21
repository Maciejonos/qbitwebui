import { useState, useEffect, type ReactNode } from 'react'
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
import { Toggle, Select } from '../components/ui'

interface Props {
	instances: Instance[]
	onBack: () => void
}

export function MobileCrossSeedManager({ instances, onBack }: Props): ReactNode {
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
			setSuccess(`${result.matchesFound} matches, ${result.torrentsAdded} added`)
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
			setSuccess(`Cleared ${result.cacheCleared + result.outputCleared} files`)
			getCacheStats(selectedInstance).then(setCacheStats).catch(() => {})
			setTimeout(() => setSuccess(''), 3000)
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed')
		}
	}

	async function handleClearHistory() {
		if (!selectedInstance) return
		try {
			const result = await clearHistory(selectedInstance)
			setSuccess(`Cleared ${result.deleted} entries`)
			setTimeout(() => setSuccess(''), 3000)
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed')
		}
	}

	function formatNextRun(ts: number | null): string {
		if (!ts) return 'Not scheduled'
		const now = Math.floor(Date.now() / 1000)
		const diff = ts - now
		if (diff <= 0) return 'Imminent'
		const hours = Math.floor(diff / 3600)
		const mins = Math.floor((diff % 3600) / 60)
		if (hours > 0) return `${hours}h ${mins}m`
		return `${mins}m`
	}

	const prowlarrIntegrations = integrations.filter((i) => i.type === 'prowlarr')

	return (
		<div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
			<header
				className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b"
				style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}
			>
				<button onClick={onBack} className="p-2 -ml-2 rounded-lg active:bg-[var(--bg-tertiary)]">
					<svg
						className="w-5 h-5"
						style={{ color: 'var(--text-primary)' }}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
					</svg>
				</button>
				<h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
					Cross-Seed
				</h1>
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
								style={{ backgroundColor: 'color-mix(in srgb, var(--warning) 10%, transparent)', color: 'var(--warning)' }}
							>
								No Prowlarr integration configured
							</div>
						)}

						<div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
							<div className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
								Status
							</div>
							<div className="grid grid-cols-2 gap-3 text-sm">
								<div>
									<div style={{ color: 'var(--text-muted)' }}>Scheduler</div>
									<div style={{ color: status?.enabled ? '#a6e3a1' : 'var(--text-secondary)' }}>
										{status?.enabled ? 'Enabled' : 'Disabled'}
									</div>
								</div>
								<div>
									<div style={{ color: 'var(--text-muted)' }}>Next Run</div>
									<div style={{ color: 'var(--text-secondary)' }}>
										{status?.enabled ? formatNextRun(status?.nextRun ?? null) : '-'}
									</div>
								</div>
								<div>
									<div style={{ color: 'var(--text-muted)' }}>Cache</div>
									<div style={{ color: 'var(--text-secondary)' }}>
										{cacheStats ? `${cacheStats.cache.count} (${formatSize(cacheStats.cache.totalSize)})` : '0'}
									</div>
								</div>
								<div>
									<div style={{ color: 'var(--text-muted)' }}>Running</div>
									<div style={{ color: status?.running ? 'var(--accent)' : 'var(--text-secondary)' }}>
										{status?.running ? 'Yes' : 'No'}
									</div>
								</div>
							</div>
						</div>

						<div className="p-4 rounded-xl border space-y-4" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
							<div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
								Configuration
							</div>

							<div className="flex items-center justify-between">
								<span className="text-sm" style={{ color: 'var(--text-primary)' }}>Enable Scheduler</span>
								<Toggle checked={config.enabled} onChange={(v) => setConfig({ ...config, enabled: v })} />
							</div>

							<div>
								<label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Prowlarr</label>
								<Select
									value={config.integration_id ? String(config.integration_id) : ''}
									onChange={(v) => setConfig({ ...config, integration_id: v ? Number(v) : null })}
									options={[
										{ value: '', label: 'None' },
										...prowlarrIntegrations.map((i) => ({ value: String(i.id), label: i.label })),
									]}
								/>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Interval (hours)</label>
									<input
										type="number"
										min="1"
										max="168"
										value={config.interval_hours}
										onChange={(e) => setConfig({ ...config, interval_hours: parseInt(e.target.value) || 24 })}
										className="w-full px-3 py-2 rounded-lg border text-sm"
										style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
									/>
								</div>
								<div>
									<label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Tag</label>
									<input
										type="text"
										value={config.tag}
										onChange={(e) => setConfig({ ...config, tag: e.target.value })}
										className="w-full px-3 py-2 rounded-lg border text-sm"
										style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
									/>
								</div>
							</div>

							<div className="flex items-center justify-between">
								<span className="text-sm" style={{ color: 'var(--text-primary)' }}>Dry Run</span>
								<Toggle checked={config.dry_run} onChange={(v) => setConfig({ ...config, dry_run: v })} />
							</div>

							<div className="flex items-center justify-between">
								<span className="text-sm" style={{ color: 'var(--text-primary)' }}>Skip Recheck</span>
								<Toggle checked={config.skip_recheck} onChange={(v) => setConfig({ ...config, skip_recheck: v })} />
							</div>

							<button
								onClick={handleSave}
								disabled={saving}
								className="w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
								style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
							>
								{saving ? 'Saving...' : 'Save'}
							</button>
						</div>

						<div className="p-4 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
							<div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
								Actions
							</div>
							<div className="grid grid-cols-2 gap-3">
								<button
									onClick={() => handleScan(false)}
									disabled={scanning || status?.running || !config.integration_id}
									className="py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
									style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
								>
									{scanning || status?.running ? 'Scanning...' : 'Scan'}
								</button>
								<button
									onClick={() => handleScan(true)}
									disabled={scanning || status?.running || !config.integration_id}
									className="py-2.5 rounded-xl text-sm border disabled:opacity-50"
									style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
								>
									Force Scan
								</button>
								<button
									onClick={handleClearCache}
									className="py-2.5 rounded-xl text-sm border"
									style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
								>
									Clear Cache
								</button>
								<button
									onClick={handleClearHistory}
									className="py-2.5 rounded-xl text-sm border"
									style={{ borderColor: 'var(--border)', color: 'var(--warning)' }}
								>
									Clear History
								</button>
							</div>
						</div>
					</>
				) : null}
			</div>
		</div>
	)
}
