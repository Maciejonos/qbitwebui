import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronDown, Search, X, Check, Plus, Trash2, ArrowUpDown, Filter } from 'lucide-react'
import {
	getIntegrations,
	createIntegration,
	deleteIntegration,
	testIntegrationConnection,
	getIndexers,
	getProwlarrCategories,
	search,
	grabRelease,
	type Integration,
	type Indexer,
	type ProwlarrCategory,
	type SearchResult,
} from '../api/integrations'
import { type Instance } from '../api/instances'
import { getCategories, type Category } from '../api/qbittorrent'
import { formatSize } from '../utils/format'
import { extractTags, sortResults, filterResults, type SortKey } from '../utils/search'

function formatAge(dateStr: string): string {
	const date = new Date(dateStr)
	const now = new Date()
	const diff = now.getTime() - date.getTime()
	const days = Math.floor(diff / (1000 * 60 * 60 * 24))
	if (days === 0) return 'Today'
	if (days === 1) return '1d'
	if (days < 30) return `${days}d`
	if (days < 365) return `${Math.floor(days / 30)}mo`
	return `${Math.floor(days / 365)}y`
}

interface Props {
	instances: Instance[]
	onBack: () => void
}

export function MobileSearchPanel({ instances, onBack }: Props) {
	const [integrations, setIntegrations] = useState<Integration[]>([])
	const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)
	const [indexers, setIndexers] = useState<Indexer[]>([])
	const [prowlarrCategories, setProwlarrCategories] = useState<ProwlarrCategory[]>([])
	const [selectedIndexer, setSelectedIndexer] = useState<string>('-2')
	const [selectedCategory, setSelectedCategory] = useState<string>('')
	const [showProwlarrCategoryPicker, setShowProwlarrCategoryPicker] = useState(false)
	const [query, setQuery] = useState('')
	const [results, setResults] = useState<SearchResult[]>([])
	const [searching, setSearching] = useState(false)
	const [error, setError] = useState('')
	const [showAddForm, setShowAddForm] = useState(false)
	const [formData, setFormData] = useState({ label: '', url: '', api_key: '' })
	const [submitting, setSubmitting] = useState(false)
	const [testing, setTesting] = useState(false)
	const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
	const [grabbing, setGrabbing] = useState<string | null>(null)
	const [grabResult, setGrabResult] = useState<{ guid: string; success: boolean; message?: string } | null>(null)
	const [grabInstance, setGrabInstance] = useState<number | null>(null)
	const [grabCategories, setGrabCategories] = useState<Record<string, Category>>({})
	const [grabCategory, setGrabCategory] = useState('')
	const [grabSavepath, setGrabSavepath] = useState('')
	const [loadingCategories, setLoadingCategories] = useState(false)
	const [showIndexerPicker, setShowIndexerPicker] = useState(false)
	const [showIntegrationPicker, setShowIntegrationPicker] = useState(false)
	const [showGrabSheet, setShowGrabSheet] = useState<SearchResult | null>(null)
	const [deleteConfirm, setDeleteConfirm] = useState<Integration | null>(null)
	const [sortKey, setSortKey] = useState<SortKey>('seeders')
	const [sortAsc, setSortAsc] = useState(false)
	const [filter, setFilter] = useState('')
	const [showSortPicker, setShowSortPicker] = useState(false)
	const [showFilterPicker, setShowFilterPicker] = useState(false)
	const [showCategoryPicker, setShowCategoryPicker] = useState(false)
	const searchInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		getIntegrations()
			.then((data) => {
				setIntegrations(data)
				if (data.length > 0) setSelectedIntegration((prev) => prev ?? data[0])
			})
			.catch(() => {})
	}, [])

	useEffect(() => {
		if (selectedIntegration) {
			getIndexers(selectedIntegration.id)
				.then(setIndexers)
				.catch(() => setIndexers([]))
			getProwlarrCategories(selectedIntegration.id)
				.then(setProwlarrCategories)
				.catch(() => setProwlarrCategories([]))
		}
	}, [selectedIntegration])

	useEffect(() => {
		if (grabInstance) {
			setLoadingCategories(true)
			getCategories(grabInstance)
				.then(setGrabCategories)
				.catch(() => setGrabCategories({}))
				.finally(() => setLoadingCategories(false))
		} else {
			setGrabCategories({})
		}
	}, [grabInstance])

	useEffect(() => {
		if (showGrabSheet) {
			setGrabCategory('')
			setGrabSavepath('')
			if (instances.length === 1) {
				setGrabInstance(instances[0].id)
			} else {
				setGrabInstance(null)
			}
		}
	}, [showGrabSheet, instances])

	async function handleSearch(e: React.FormEvent) {
		e.preventDefault()
		if (!selectedIntegration || !query.trim()) return
		searchInputRef.current?.blur()
		setSearching(true)
		setError('')
		setResults([])
		try {
			const data = await search(selectedIntegration.id, query, {
				indexerIds: selectedIndexer,
				categories: selectedCategory || undefined,
			})
			setResults(data)
			setFilter('')
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Search failed')
		} finally {
			setSearching(false)
		}
	}

	async function handleAddIntegration(e: React.FormEvent) {
		e.preventDefault()
		setSubmitting(true)
		setError('')
		try {
			const integration = await createIntegration({ type: 'prowlarr', ...formData })
			setIntegrations([...integrations, integration])
			setSelectedIntegration(integration)
			setShowAddForm(false)
			setFormData({ label: '', url: '', api_key: '' })
			setTestResult(null)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to add')
		} finally {
			setSubmitting(false)
		}
	}

	async function handleTestConnection() {
		setTesting(true)
		setTestResult(null)
		try {
			const result = await testIntegrationConnection(formData.url, formData.api_key)
			setTestResult(
				result.success
					? { success: true, message: `Connected! Prowlarr ${result.version}` }
					: { success: false, message: result.error || 'Failed' }
			)
		} catch (err) {
			setTestResult({ success: false, message: err instanceof Error ? err.message : 'Failed' })
		} finally {
			setTesting(false)
		}
	}

	async function handleDeleteIntegration() {
		if (!deleteConfirm) return
		try {
			await deleteIntegration(deleteConfirm.id)
			const updated = integrations.filter((i) => i.id !== deleteConfirm.id)
			setIntegrations(updated)
			if (selectedIntegration?.id === deleteConfirm.id) {
				setSelectedIntegration(updated[0] || null)
			}
			setDeleteConfirm(null)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to delete')
		}
	}

	async function handleGrab(result: SearchResult, instanceId: number) {
		if (!selectedIntegration) return
		setGrabbing(result.guid)
		setGrabResult(null)
		const options: { category?: string; savepath?: string } = {}
		if (grabCategory) options.category = grabCategory
		if (grabSavepath.trim()) options.savepath = grabSavepath.trim()
		try {
			await grabRelease(
				selectedIntegration.id,
				{
					guid: result.guid,
					indexerId: result.indexerId,
					downloadUrl: result.downloadUrl,
					magnetUrl: result.magnetUrl,
				},
				instanceId,
				Object.keys(options).length > 0 ? options : undefined
			)
			setGrabResult({ guid: result.guid, success: true })
			setShowGrabSheet(null)
			setTimeout(() => setGrabResult(null), 3000)
		} catch (err) {
			setGrabResult({ guid: result.guid, success: false, message: err instanceof Error ? err.message : 'Failed' })
		} finally {
			setGrabbing(null)
		}
	}

	const torrentIndexers = indexers.filter((i) => i.enable && i.protocol === 'torrent')
	const availableTags = extractTags(results.map((r) => r.title))
	const filteredResults = filterResults(results, filter)
	const sortedResults = sortResults(filteredResults, sortKey, sortAsc)

	if (showAddForm) {
		return (
			<div className="p-4">
				<div className="flex items-center gap-3 mb-6">
					<button
						onClick={() => {
							setShowAddForm(false)
							setTestResult(null)
						}}
						className="p-2 -ml-2 rounded-xl active:bg-[var(--bg-tertiary)]"
					>
						<ChevronLeft className="w-5 h-5" style={{ color: 'var(--text-primary)' }} strokeWidth={2} />
					</button>
					<h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
						Add Prowlarr
					</h2>
				</div>
				<form onSubmit={handleAddIntegration} className="space-y-4">
					<div>
						<label
							className="block text-xs font-medium mb-2 uppercase tracking-wider"
							style={{ color: 'var(--text-muted)' }}
						>
							Label
						</label>
						<input
							type="text"
							value={formData.label}
							onChange={(e) => setFormData({ ...formData, label: e.target.value })}
							className="w-full px-4 py-3 rounded-xl border text-base"
							style={{
								backgroundColor: 'var(--bg-secondary)',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
							placeholder="My Prowlarr"
							required
						/>
					</div>
					<div>
						<label
							className="block text-xs font-medium mb-2 uppercase tracking-wider"
							style={{ color: 'var(--text-muted)' }}
						>
							URL
						</label>
						<input
							type="url"
							value={formData.url}
							onChange={(e) => setFormData({ ...formData, url: e.target.value })}
							className="w-full px-4 py-3 rounded-xl border text-base"
							style={{
								backgroundColor: 'var(--bg-secondary)',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
							placeholder="http://localhost:9696"
							required
						/>
					</div>
					<div>
						<label
							className="block text-xs font-medium mb-2 uppercase tracking-wider"
							style={{ color: 'var(--text-muted)' }}
						>
							API Key
						</label>
						<input
							type="password"
							value={formData.api_key}
							onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
							className="w-full px-4 py-3 rounded-xl border text-base"
							style={{
								backgroundColor: 'var(--bg-secondary)',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
							placeholder="••••••••"
							required
						/>
					</div>
					{testResult && (
						<div
							className="px-4 py-3 rounded-xl text-sm"
							style={{
								backgroundColor: testResult.success
									? 'color-mix(in srgb, #a6e3a1 15%, transparent)'
									: 'color-mix(in srgb, var(--error) 15%, transparent)',
								color: testResult.success ? '#a6e3a1' : 'var(--error)',
							}}
						>
							{testResult.message}
						</div>
					)}
					{error && (
						<div
							className="px-4 py-3 rounded-xl text-sm"
							style={{ backgroundColor: 'color-mix(in srgb, var(--error) 15%, transparent)', color: 'var(--error)' }}
						>
							{error}
						</div>
					)}
					<div className="flex gap-3 pt-2">
						<button
							type="button"
							onClick={handleTestConnection}
							disabled={testing || !formData.url || !formData.api_key}
							className="flex-1 py-3 rounded-xl text-sm font-medium disabled:opacity-50 border"
							style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
						>
							{testing ? 'Testing...' : 'Test'}
						</button>
						<button
							type="submit"
							disabled={submitting}
							className="flex-1 py-3 rounded-xl text-sm font-medium disabled:opacity-50"
							style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
						>
							{submitting ? 'Adding...' : 'Add'}
						</button>
					</div>
				</form>
			</div>
		)
	}

	if (integrations.length === 0) {
		return (
			<div className="p-4">
				<div className="flex items-center gap-3 mb-6">
					<button onClick={onBack} className="p-2 -ml-2 rounded-xl active:bg-[var(--bg-tertiary)]">
						<ChevronLeft className="w-5 h-5" style={{ color: 'var(--text-primary)' }} strokeWidth={2} />
					</button>
					<h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
						Prowlarr Search
					</h2>
				</div>
				<div
					className="text-center py-12 rounded-2xl border"
					style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
				>
					<div
						className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
						style={{ backgroundColor: 'var(--bg-tertiary)' }}
					>
						<Search className="w-8 h-8" style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
					</div>
					<p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
						No Prowlarr configured
					</p>
					<button
						onClick={() => setShowAddForm(true)}
						className="px-5 py-2.5 rounded-xl text-sm font-medium"
						style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
					>
						Add Prowlarr
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full">
			<div className="p-4 space-y-3">
				<div className="flex items-center gap-3">
					<button onClick={onBack} className="p-2 -ml-2 rounded-xl active:bg-[var(--bg-tertiary)]">
						<ChevronLeft className="w-5 h-5" style={{ color: 'var(--text-primary)' }} strokeWidth={2} />
					</button>
					<h2 className="text-lg font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>
						Prowlarr Search
					</h2>
					<button
						onClick={() => setShowIntegrationPicker(true)}
						className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5"
						style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
					>
						{selectedIntegration?.label}
						<ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} strokeWidth={2} />
					</button>
				</div>

				<form onSubmit={handleSearch} className="space-y-3">
					<div
						className="flex items-center gap-3 px-4 py-3 rounded-xl border"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<Search className="w-5 h-5 shrink-0" style={{ color: 'var(--text-muted)' }} strokeWidth={2} />
						<input
							ref={searchInputRef}
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search torrents..."
							className="flex-1 bg-transparent outline-none text-base"
							style={{ color: 'var(--text-primary)' }}
							inputMode="search"
							enterKeyHint="search"
						/>
						{query && (
							<button type="button" onClick={() => setQuery('')} className="p-1">
								<X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} strokeWidth={2} />
							</button>
						)}
					</div>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setShowIndexerPicker(true)}
							className="flex-1 px-4 py-2.5 rounded-xl border text-sm flex items-center justify-between"
							style={{
								backgroundColor: 'var(--bg-secondary)',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
						>
							<span className="truncate">
								{selectedIndexer === '-2'
									? 'All Indexers'
									: torrentIndexers.find((i) => String(i.id) === selectedIndexer)?.name || 'All'}
							</span>
							<ChevronDown className="w-4 h-4 shrink-0 ml-2" style={{ color: 'var(--text-muted)' }} strokeWidth={2} />
						</button>
						<button
							type="button"
							onClick={() => setShowProwlarrCategoryPicker(true)}
							className="flex-1 px-4 py-2.5 rounded-xl border text-sm flex items-center justify-between"
							style={{
								backgroundColor: 'var(--bg-secondary)',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
						>
							<span className="truncate">
								{selectedCategory
									? prowlarrCategories.find((c) => String(c.id) === selectedCategory)?.name || 'All'
									: 'All Categories'}
							</span>
							<svg
								className="w-4 h-4 shrink-0 ml-2"
								style={{ color: 'var(--text-muted)' }}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
							</svg>
						</button>
						<button
							type="submit"
							disabled={searching || !query.trim()}
							className="px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
							style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
						>
							{searching ? (
								<div
									className="w-5 h-5 border-2 rounded-full animate-spin"
									style={{ borderColor: 'var(--accent-contrast)', borderTopColor: 'transparent' }}
								/>
							) : (
								'Search'
							)}
						</button>
					</div>
				</form>

				{error && (
					<div
						className="px-4 py-3 rounded-xl text-sm"
						style={{ backgroundColor: 'color-mix(in srgb, var(--error) 15%, transparent)', color: 'var(--error)' }}
					>
						{error}
					</div>
				)}
			</div>

			<div className="flex-1 overflow-y-auto px-4 pb-4">
				{searching && (
					<div className="flex items-center justify-center py-12">
						<div
							className="w-8 h-8 border-2 rounded-full animate-spin"
							style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
						/>
					</div>
				)}

				{!searching && results.length > 0 && (
					<div className="space-y-2">
						<div className="flex items-center gap-2 py-2">
							<button
								onClick={() => setShowSortPicker(true)}
								className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs"
								style={{
									backgroundColor: 'var(--bg-secondary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							>
								<ArrowUpDown className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} strokeWidth={2} />
								<span>{sortKey === 'seeders' ? 'Seeders' : sortKey === 'size' ? 'Size' : 'Age'}</span>
								<span style={{ color: 'var(--text-muted)' }}>{sortAsc ? '↑' : '↓'}</span>
							</button>
							{availableTags.length > 0 && (
								<button
									onClick={() => setShowFilterPicker(true)}
									className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs"
									style={{
										backgroundColor: 'var(--bg-secondary)',
										borderColor: 'var(--border)',
										color: 'var(--text-primary)',
									}}
								>
									<Filter className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} strokeWidth={2} />
									<span>Filter</span>
								</button>
							)}
							{filter && (
								<button
									onClick={() => setFilter('')}
									className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
									style={{
										backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)',
										color: 'var(--accent)',
									}}
								>
									{filter}
									<X className="w-3 h-3" strokeWidth={2.5} />
								</button>
							)}
							<span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
								{filter ? `${sortedResults.length}/${results.length}` : results.length}
							</span>
						</div>
						{sortedResults.map((result) => (
							<div
								key={result.guid}
								onClick={() => instances.length > 0 && setShowGrabSheet(result)}
								className="p-3 rounded-xl border active:scale-[0.99] transition-transform cursor-pointer"
								style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
							>
								<div
									className="text-sm font-medium leading-snug line-clamp-2 flex items-start gap-1.5"
									style={{ color: 'var(--text-primary)' }}
								>
									{result.indexerFlags?.some((f) => /free\s*leech|^free$/i.test(f)) && (
										<span
											onClick={(e) => {
												e.stopPropagation()
												alert('Freeleech')
											}}
											className="shrink-0 mt-0.5 px-1 py-0.5 rounded text-[9px] font-bold"
											style={{ backgroundColor: 'color-mix(in srgb, #a6e3a1 20%, transparent)', color: '#a6e3a1' }}
										>
											FL
										</span>
									)}
									<span className="line-clamp-2">{result.title}</span>
								</div>
								<div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
									<span className="truncate max-w-[100px]">{result.indexer}</span>
									<span>{formatSize(result.size)}</span>
									<span>{formatAge(result.publishDate)}</span>
									<span className="ml-auto flex items-center gap-1">
										<span style={{ color: '#a6e3a1' }}>{result.seeders ?? '-'}</span>
										<span>/</span>
										<span style={{ color: 'var(--error)' }}>{result.leechers ?? '-'}</span>
									</span>
								</div>
								{grabResult?.guid === result.guid && (
									<div
										className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium text-center"
										style={{
											backgroundColor: grabResult.success
												? 'color-mix(in srgb, #a6e3a1 20%, transparent)'
												: 'color-mix(in srgb, var(--error) 20%, transparent)',
											color: grabResult.success ? '#a6e3a1' : 'var(--error)',
										}}
									>
										{grabResult.success ? 'Added!' : grabResult.message}
									</div>
								)}
							</div>
						))}
					</div>
				)}

				{!searching && results.length === 0 && query && (
					<div className="text-center py-12">
						<p className="text-sm" style={{ color: 'var(--text-muted)' }}>
							No results found
						</p>
					</div>
				)}
			</div>

			{showIndexerPicker && (
				<>
					<div
						className="fixed inset-0 z-50"
						style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
						onClick={() => setShowIndexerPicker(false)}
					/>
					<div
						className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t max-h-[70vh] overflow-hidden"
						style={{
							backgroundColor: 'var(--bg-primary)',
							borderColor: 'var(--border)',
							paddingBottom: 'env(safe-area-inset-bottom, 0px)',
						}}
					>
						<div className="flex justify-center pt-3 pb-2">
							<div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
						</div>
						<div className="px-5 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
							<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
								Select Indexer
							</h3>
						</div>
						<div className="overflow-y-auto max-h-[50vh] p-2">
							<button
								onClick={() => {
									setSelectedIndexer('-2')
									setShowIndexerPicker(false)
								}}
								className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
								style={{ backgroundColor: selectedIndexer === '-2' ? 'var(--bg-tertiary)' : 'transparent' }}
							>
								<span style={{ color: 'var(--text-primary)' }}>All Indexers</span>
								{selectedIndexer === '-2' && (
									<Check className="w-5 h-5" style={{ color: 'var(--accent)' }} strokeWidth={2} />
								)}
							</button>
							{torrentIndexers.map((indexer) => (
								<button
									key={indexer.id}
									onClick={() => {
										setSelectedIndexer(String(indexer.id))
										setShowIndexerPicker(false)
									}}
									className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
									style={{
										backgroundColor: String(indexer.id) === selectedIndexer ? 'var(--bg-tertiary)' : 'transparent',
									}}
								>
									<span style={{ color: 'var(--text-primary)' }}>{indexer.name}</span>
									{String(indexer.id) === selectedIndexer && (
										<Check className="w-5 h-5" style={{ color: 'var(--accent)' }} strokeWidth={2} />
									)}
								</button>
							))}
						</div>
					</div>
				</>
			)}

			{showProwlarrCategoryPicker && (
				<>
					<div
						className="fixed inset-0 z-50"
						style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
						onClick={() => setShowProwlarrCategoryPicker(false)}
					/>
					<div
						className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t max-h-[70vh] overflow-hidden"
						style={{
							backgroundColor: 'var(--bg-primary)',
							borderColor: 'var(--border)',
							paddingBottom: 'env(safe-area-inset-bottom, 0px)',
						}}
					>
						<div className="flex justify-center pt-3 pb-2">
							<div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
						</div>
						<div className="px-5 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
							<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
								Select Category
							</h3>
						</div>
						<div className="overflow-y-auto max-h-[50vh] p-2">
							<button
								onClick={() => {
									setSelectedCategory('')
									setShowProwlarrCategoryPicker(false)
								}}
								className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
								style={{ backgroundColor: selectedCategory === '' ? 'var(--bg-tertiary)' : 'transparent' }}
							>
								<span style={{ color: 'var(--text-primary)' }}>All Categories</span>
								{selectedCategory === '' && (
									<svg
										className="w-5 h-5"
										style={{ color: 'var(--accent)' }}
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={2}
									>
										<path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
									</svg>
								)}
							</button>
							{prowlarrCategories.map((category) => (
								<button
									key={category.id}
									onClick={() => {
										setSelectedCategory(String(category.id))
										setShowProwlarrCategoryPicker(false)
									}}
									className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
									style={{
										backgroundColor: String(category.id) === selectedCategory ? 'var(--bg-tertiary)' : 'transparent',
									}}
								>
									<span style={{ color: 'var(--text-primary)' }}>{category.name}</span>
									{String(category.id) === selectedCategory && (
										<svg
											className="w-5 h-5"
											style={{ color: 'var(--accent)' }}
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											strokeWidth={2}
										>
											<path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
										</svg>
									)}
								</button>
							))}
						</div>
					</div>
				</>
			)}

			{showIntegrationPicker && (
				<>
					<div
						className="fixed inset-0 z-50"
						style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
						onClick={() => setShowIntegrationPicker(false)}
					/>
					<div
						className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t max-h-[70vh] overflow-hidden"
						style={{
							backgroundColor: 'var(--bg-primary)',
							borderColor: 'var(--border)',
							paddingBottom: 'env(safe-area-inset-bottom, 0px)',
						}}
					>
						<div className="flex justify-center pt-3 pb-2">
							<div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
						</div>
						<div
							className="px-5 pb-3 border-b flex items-center justify-between"
							style={{ borderColor: 'var(--border)' }}
						>
							<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
								Prowlarr Instance
							</h3>
							<button
								onClick={() => {
									setShowIntegrationPicker(false)
									setShowAddForm(true)
								}}
								className="p-2 -mr-2 rounded-xl"
								style={{ color: 'var(--accent)' }}
							>
								<Plus className="w-5 h-5" strokeWidth={2} />
							</button>
						</div>
						<div className="overflow-y-auto max-h-[50vh] p-2">
							{integrations.map((integration) => (
								<div key={integration.id} className="flex items-center gap-2">
									<button
										onClick={() => {
											setSelectedIntegration(integration)
											setShowIntegrationPicker(false)
										}}
										className="flex-1 flex items-center justify-between px-4 py-3 rounded-xl"
										style={{
											backgroundColor:
												selectedIntegration?.id === integration.id ? 'var(--bg-tertiary)' : 'transparent',
										}}
									>
										<span style={{ color: 'var(--text-primary)' }}>{integration.label}</span>
										{selectedIntegration?.id === integration.id && (
											<Check className="w-5 h-5" style={{ color: 'var(--accent)' }} strokeWidth={2} />
										)}
									</button>
									<button
										onClick={() => {
											setShowIntegrationPicker(false)
											setDeleteConfirm(integration)
										}}
										className="p-3 rounded-xl"
										style={{ color: 'var(--error)' }}
									>
										<Trash2 className="w-4 h-4" strokeWidth={1.5} />
									</button>
								</div>
							))}
						</div>
					</div>
				</>
			)}

			{showGrabSheet && (
				<>
					<div
						className="fixed inset-0 z-50"
						style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
						onClick={() => setShowGrabSheet(null)}
					/>
					<div
						className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t max-h-[85vh] overflow-hidden flex flex-col"
						style={{
							backgroundColor: 'var(--bg-primary)',
							borderColor: 'var(--border)',
							paddingBottom: 'env(safe-area-inset-bottom, 0px)',
						}}
					>
						<div className="flex justify-center pt-3 pb-2">
							<div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
						</div>
						<div className="px-5 pb-4">
							<h3 className="font-semibold line-clamp-2 leading-snug" style={{ color: 'var(--text-primary)' }}>
								{showGrabSheet.title}
							</h3>
							<div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
								<span>{formatSize(showGrabSheet.size)}</span>
								<span>{showGrabSheet.indexer}</span>
								<span style={{ color: '#a6e3a1' }}>{showGrabSheet.seeders} seeds</span>
							</div>
						</div>
						<div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
							{instances.length > 1 && (
								<div>
									<div className="text-xs font-medium px-1 pb-2" style={{ color: 'var(--text-muted)' }}>
										Instance
									</div>
									<div className="space-y-2">
										{instances.map((instance) => (
											<button
												key={instance.id}
												onClick={() => setGrabInstance(grabInstance === instance.id ? null : instance.id)}
												className="w-full flex items-center justify-between px-4 py-3 rounded-xl border active:scale-[0.98] transition-transform"
												style={{
													backgroundColor: grabInstance === instance.id ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
													borderColor: grabInstance === instance.id ? 'var(--accent)' : 'var(--border)',
												}}
											>
												<span style={{ color: 'var(--text-primary)' }}>{instance.label}</span>
												{grabInstance === instance.id && (
													<Check className="w-5 h-5" style={{ color: 'var(--accent)' }} strokeWidth={2} />
												)}
											</button>
										))}
									</div>
								</div>
							)}
							<div>
								<div className="text-xs font-medium px-1 pb-2" style={{ color: 'var(--text-muted)' }}>
									Category
								</div>
								<button
									type="button"
									onClick={() => grabInstance && setShowCategoryPicker(true)}
									disabled={!grabInstance || loadingCategories}
									className="w-full flex items-center justify-between px-4 py-3 rounded-xl border text-base disabled:opacity-50"
									style={{
										backgroundColor: 'var(--bg-secondary)',
										borderColor: 'var(--border)',
										color: grabCategory ? 'var(--text-primary)' : 'var(--text-muted)',
									}}
								>
									<span>{loadingCategories ? 'Loading...' : grabCategory || 'None'}</span>
									<ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} strokeWidth={2} />
								</button>
							</div>
							<div>
								<div className="text-xs font-medium px-1 pb-2" style={{ color: 'var(--text-muted)' }}>
									Save Path
								</div>
								<input
									type="text"
									value={grabSavepath}
									onChange={(e) => setGrabSavepath(e.target.value)}
									disabled={!grabInstance}
									placeholder="Default"
									className="w-full px-4 py-3 rounded-xl border text-base disabled:opacity-50"
									style={{
										backgroundColor: 'var(--bg-secondary)',
										borderColor: 'var(--border)',
										color: 'var(--text-primary)',
									}}
								/>
							</div>
							<button
								onClick={() => grabInstance && handleGrab(showGrabSheet, grabInstance)}
								disabled={!grabInstance || grabbing === showGrabSheet.guid}
								className="w-full py-3.5 rounded-xl text-base font-medium disabled:opacity-50 active:scale-[0.98] transition-transform"
								style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
							>
								{grabbing === showGrabSheet.guid ? 'Grabbing...' : 'Grab'}
							</button>
						</div>
					</div>
				</>
			)}

			{deleteConfirm && (
				<>
					<div
						className="fixed inset-0 z-50"
						style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
						onClick={() => setDeleteConfirm(null)}
					/>
					<div
						className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 rounded-2xl border p-5"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
							Delete Integration
						</h3>
						<p className="text-sm" style={{ color: 'var(--text-muted)' }}>
							Delete <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirm.label}</strong>?
						</p>
						<div className="flex gap-3 mt-5">
							<button
								onClick={() => setDeleteConfirm(null)}
								className="flex-1 py-3 rounded-xl text-sm font-medium"
								style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
							>
								Cancel
							</button>
							<button
								onClick={handleDeleteIntegration}
								className="flex-1 py-3 rounded-xl text-sm font-medium"
								style={{ backgroundColor: 'var(--error)', color: 'white' }}
							>
								Delete
							</button>
						</div>
					</div>
				</>
			)}

			{showSortPicker && (
				<>
					<div
						className="fixed inset-0 z-50"
						style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
						onClick={() => setShowSortPicker(false)}
					/>
					<div
						className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t"
						style={{
							backgroundColor: 'var(--bg-primary)',
							borderColor: 'var(--border)',
							paddingBottom: 'env(safe-area-inset-bottom, 0px)',
						}}
					>
						<div className="flex justify-center pt-3 pb-2">
							<div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
						</div>
						<div className="px-5 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
							<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
								Sort By
							</h3>
						</div>
						<div className="p-2">
							{(['seeders', 'size', 'age'] as SortKey[]).map((key) => (
								<button
									key={key}
									onClick={() => {
										if (sortKey === key) setSortAsc(!sortAsc)
										else {
											setSortKey(key)
											setSortAsc(false)
										}
										setShowSortPicker(false)
									}}
									className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
									style={{ backgroundColor: sortKey === key ? 'var(--bg-tertiary)' : 'transparent' }}
								>
									<span style={{ color: 'var(--text-primary)' }}>
										{key === 'seeders' ? 'Seeders' : key === 'size' ? 'Size' : 'Age'}
									</span>
									{sortKey === key && (
										<span style={{ color: 'var(--accent)' }}>{sortAsc ? '↑ Ascending' : '↓ Descending'}</span>
									)}
								</button>
							))}
						</div>
					</div>
				</>
			)}

			{showFilterPicker && (
				<>
					<div
						className="fixed inset-0 z-50"
						style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
						onClick={() => setShowFilterPicker(false)}
					/>
					<div
						className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t max-h-[70vh] overflow-hidden"
						style={{
							backgroundColor: 'var(--bg-primary)',
							borderColor: 'var(--border)',
							paddingBottom: 'env(safe-area-inset-bottom, 0px)',
						}}
					>
						<div className="flex justify-center pt-3 pb-2">
							<div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
						</div>
						<div className="px-5 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
							<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
								Filter
							</h3>
						</div>
						<div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
							<input
								type="text"
								placeholder="Type to filter..."
								value={filter}
								onChange={(e) => setFilter(e.target.value)}
								className="w-full px-4 py-2.5 rounded-xl border text-base"
								style={{
									backgroundColor: 'var(--bg-secondary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
								autoFocus
							/>
						</div>
						<div className="overflow-y-auto max-h-[40vh] p-2">
							{availableTags.slice(0, 20).map(({ tag, count }) => (
								<button
									key={tag}
									onClick={() => {
										setFilter(filter === tag ? '' : tag)
										setShowFilterPicker(false)
									}}
									className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
									style={{ backgroundColor: filter === tag ? 'var(--bg-tertiary)' : 'transparent' }}
								>
									<span style={{ color: filter === tag ? 'var(--accent)' : 'var(--text-primary)' }}>{tag}</span>
									<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
										{count}
									</span>
								</button>
							))}
						</div>
					</div>
				</>
			)}

			{showCategoryPicker && (
				<>
					<div
						className="fixed inset-0 z-[60]"
						style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
						onClick={() => setShowCategoryPicker(false)}
					/>
					<div
						className="fixed inset-x-0 bottom-0 z-[60] rounded-t-3xl border-t max-h-[70vh] overflow-hidden"
						style={{
							backgroundColor: 'var(--bg-primary)',
							borderColor: 'var(--border)',
							paddingBottom: 'env(safe-area-inset-bottom, 0px)',
						}}
					>
						<div className="flex justify-center pt-3 pb-2">
							<div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
						</div>
						<div className="px-5 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
							<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
								Category
							</h3>
						</div>
						<div className="overflow-y-auto max-h-[50vh] p-2">
							<button
								onClick={() => {
									setGrabCategory('')
									setShowCategoryPicker(false)
								}}
								className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
								style={{ backgroundColor: !grabCategory ? 'var(--bg-tertiary)' : 'transparent' }}
							>
								<span style={{ color: !grabCategory ? 'var(--accent)' : 'var(--text-primary)' }}>None</span>
								{!grabCategory && <Check className="w-5 h-5" style={{ color: 'var(--accent)' }} strokeWidth={2} />}
							</button>
							{Object.keys(grabCategories).map((cat) => (
								<button
									key={cat}
									onClick={() => {
										setGrabCategory(cat)
										setShowCategoryPicker(false)
									}}
									className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
									style={{ backgroundColor: grabCategory === cat ? 'var(--bg-tertiary)' : 'transparent' }}
								>
									<span style={{ color: grabCategory === cat ? 'var(--accent)' : 'var(--text-primary)' }}>{cat}</span>
									{grabCategory === cat && (
										<Check className="w-5 h-5" style={{ color: 'var(--accent)' }} strokeWidth={2} />
									)}
								</button>
							))}
						</div>
					</div>
				</>
			)}
		</div>
	)
}
