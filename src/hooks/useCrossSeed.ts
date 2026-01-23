import { useState, useEffect, useRef } from 'react'
import { type Instance } from '../api/instances'
import { getIntegrations, type Integration } from '../api/integrations'
import {
	getCrossSeedConfig,
	updateCrossSeedConfig,
	triggerScan,
	getInstanceStatus,
	clearCache,
	getCacheStats,
	stopScan,
	getLogs,
	getIndexers,
	type CrossSeedConfig,
	type SchedulerStatus,
	type CacheStats,
	type LogEntry,
	type TorznabIndexer,
} from '../api/crossSeed'

export function useCrossSeed(instances: Instance[]) {
	const [selectedInstance, setSelectedInstance] = useState<number | null>(instances[0]?.id ?? null)
	const [config, setConfig] = useState<CrossSeedConfig | null>(null)
	const [status, setStatus] = useState<SchedulerStatus | null>(null)
	const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
	const [integrations, setIntegrations] = useState<Integration[]>([])
	const [availableIndexers, setAvailableIndexers] = useState<TorznabIndexer[]>([])
	const [logs, setLogs] = useState<LogEntry[]>([])
	const [loading, setLoading] = useState(false)
	const [scanning, setScanning] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState('')
	const [saving, setSaving] = useState(false)
	const [autoScroll, setAutoScroll] = useState(true)
	const logsContainerRef = useRef<HTMLDivElement>(null)
	const lastLogCountRef = useRef(0)

	useEffect(() => {
		getIntegrations()
			.then(setIntegrations)
			.catch(() => {})
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
		if (!selectedInstance || !config?.integration_id) {
			setAvailableIndexers([])
			return
		}
		getIndexers(selectedInstance, config.integration_id)
			.then((indexers) => {
				setAvailableIndexers(indexers)
				const validIds = new Set(indexers.map((i) => i.id))
				setConfig((c) => {
					if (!c) return c
					const cleanedIds = c.indexer_ids.filter((id) => validIds.has(id))
					if (cleanedIds.length !== c.indexer_ids.length) {
						return { ...c, indexer_ids: cleanedIds }
					}
					return c
				})
			})
			.catch(() => setAvailableIndexers([]))
	}, [selectedInstance, config?.integration_id])

	useEffect(() => {
		getLogs(200)
			.then(setLogs)
			.catch(() => {})
		const interval = setInterval(() => {
			getLogs(200)
				.then(setLogs)
				.catch(() => {})
		}, 2000)
		return () => clearInterval(interval)
	}, [])

	useEffect(() => {
		if (!selectedInstance) return
		const interval = setInterval(() => {
			getInstanceStatus(selectedInstance)
				.then(setStatus)
				.catch(() => {})
		}, 2000)
		return () => clearInterval(interval)
	}, [selectedInstance])

	useEffect(() => {
		const container = logsContainerRef.current
		if (!container || !autoScroll) return
		if (logs.length > lastLogCountRef.current) {
			container.scrollTop = container.scrollHeight
		}
		lastLogCountRef.current = logs.length
	}, [logs, autoScroll])

	async function handleSave() {
		if (!selectedInstance || !config) return
		setSaving(true)
		setError('')
		setSuccess('')
		try {
			const result = await updateCrossSeedConfig(selectedInstance, {
				enabled: config.enabled,
				interval_hours: config.interval_hours,
				delay_seconds: config.delay_seconds,
				dry_run: config.dry_run,
				category_suffix: config.category_suffix,
				tag: config.tag,
				skip_recheck: config.skip_recheck,
				integration_id: config.integration_id,
				indexer_ids: config.indexer_ids,
				match_mode: config.match_mode,
				link_dir: config.link_dir,
				blocklist: config.blocklist,
				include_single_episodes: config.include_single_episodes,
			})
			if (result.linkDirValid === false) {
				setError('Link directory not writable')
			} else {
				setSuccess('Saved')
				setTimeout(() => setSuccess(''), 2000)
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed')
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
			setSuccess(`Done: ${result.matchesFound} matches, ${result.torrentsAdded} added`)
			getInstanceStatus(selectedInstance)
				.then(setStatus)
				.catch(() => {})
			getCacheStats(selectedInstance)
				.then(setCacheStats)
				.catch(() => {})
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed')
		} finally {
			setScanning(false)
		}
	}

	async function handleStop() {
		if (!selectedInstance) return
		try {
			await stopScan(selectedInstance)
			setSuccess('Stopped')
			setTimeout(() => setSuccess(''), 2000)
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed')
		}
	}

	async function handleClearCache() {
		if (!selectedInstance) return
		try {
			const result = await clearCache(selectedInstance)
			setSuccess(`Cleared ${result.cacheCleared + result.outputCleared} files`)
			getCacheStats(selectedInstance)
				.then(setCacheStats)
				.catch(() => {})
			setTimeout(() => setSuccess(''), 2000)
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed')
		}
	}

	const prowlarrIntegrations = integrations.filter((i) => i.type === 'prowlarr')
	const isRunning = scanning || status?.running

	return {
		selectedInstance,
		setSelectedInstance,
		config,
		setConfig,
		status,
		cacheStats,
		availableIndexers,
		logs,
		loading,
		scanning,
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
	}
}

export function formatTimestamp(ts: number | null): string {
	if (!ts) return '—'
	return new Date(ts * 1000).toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

export const LOG_LEVEL_COLORS: Record<string, string> = {
	ERROR: 'var(--error)',
	WARN: 'var(--warning)',
}
