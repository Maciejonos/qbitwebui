import { useState, useEffect, useCallback, Fragment } from 'react'
import {
	getIntegrations,
	createIntegration,
	deleteIntegration,
	testIntegrationConnection,
	getIndexers,
	search,
	grabRelease,
	type Integration,
	type Indexer,
	type SearchResult,
} from '../api/integrations'
import { getInstances, type Instance } from '../api/instances'
import { extractTags, sortResults, filterResults, type SortKey } from '../utils/search'

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
	return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatAge(dateStr: string): string {
	const date = new Date(dateStr)
	const now = new Date()
	const diff = now.getTime() - date.getTime()
	const days = Math.floor(diff / (1000 * 60 * 60 * 24))
	if (days === 0) return 'Today'
	if (days === 1) return '1 day'
	if (days < 30) return `${days} days`
	if (days < 365) return `${Math.floor(days / 30)} months`
	return `${Math.floor(days / 365)} years`
}

export function SearchPanel() {
	const [integrations, setIntegrations] = useState<Integration[]>([])
	const [instances, setInstances] = useState<Instance[]>([])
	const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)
	const [indexers, setIndexers] = useState<Indexer[]>([])
	const [selectedIndexer, setSelectedIndexer] = useState<string>('-2')
	const [query, setQuery] = useState('')
	const [results, setResults] = useState<SearchResult[]>([])
	const [searching, setSearching] = useState(false)
	const [error, setError] = useState('')
	const [showAddForm, setShowAddForm] = useState(false)
	const [formData, setFormData] = useState({ label: '', url: '', api_key: '' })
	const [submitting, setSubmitting] = useState(false)
	const [grabbing, setGrabbing] = useState<string | null>(null)
	const [grabResult, setGrabResult] = useState<{ guid: string; success: boolean; message?: string } | null>(null)
	const [sortKey, setSortKey] = useState<SortKey>('seeders')
	const [sortAsc, setSortAsc] = useState(false)
	const [testing, setTesting] = useState(false)
	const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
	const [deleteConfirm, setDeleteConfirm] = useState<Integration | null>(null)
	const [page, setPage] = useState(1)
	const itemsPerPage = 25
	const [indexerDropdownOpen, setIndexerDropdownOpen] = useState(false)
	const [filter, setFilter] = useState('')
	const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
	const [grabDropdownOpen, setGrabDropdownOpen] = useState<string | null>(null)

	const availableTags = extractTags(results.map(r => r.title))

	const loadData = useCallback(async () => {
		const [integrationsData, instancesData] = await Promise.all([
			getIntegrations().catch(() => []),
			getInstances().catch(() => []),
		])
		setIntegrations(integrationsData)
		setInstances(instancesData)
		if (integrationsData.length > 0 && !selectedIntegration) {
			setSelectedIntegration(integrationsData[0])
		}
	}, [selectedIntegration])

	useEffect(() => {
		loadData()
	}, [loadData])

	useEffect(() => {
		if (selectedIntegration) {
			getIndexers(selectedIntegration.id)
				.then(setIndexers)
				.catch(() => setIndexers([]))
		}
	}, [selectedIntegration])

	async function handleSearch(e: React.FormEvent) {
		e.preventDefault()
		if (!selectedIntegration || !query.trim()) return

		setSearching(true)
		setError('')
		setResults([])

		try {
			const data = await search(selectedIntegration.id, query, {
				indexerIds: selectedIndexer,
			})
			setResults(data)
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
			const integration = await createIntegration({
				type: 'prowlarr',
				...formData,
			})
			setIntegrations([...integrations, integration])
			setSelectedIntegration(integration)
			setShowAddForm(false)
			setFormData({ label: '', url: '', api_key: '' })
			setTestResult(null)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to add integration')
		} finally {
			setSubmitting(false)
		}
	}

	async function handleDeleteIntegration() {
		if (!deleteConfirm) return
		try {
			await deleteIntegration(deleteConfirm.id)
			const updated = integrations.filter(i => i.id !== deleteConfirm.id)
			setIntegrations(updated)
			if (selectedIntegration?.id === deleteConfirm.id) {
				setSelectedIntegration(updated[0] || null)
			}
			setDeleteConfirm(null)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to delete')
		}
	}

	async function handleTestConnection() {
		setTesting(true)
		setTestResult(null)
		try {
			const result = await testIntegrationConnection(formData.url, formData.api_key)
			if (result.success) {
				setTestResult({ success: true, message: `Connected! Prowlarr ${result.version}` })
			} else {
				setTestResult({ success: false, message: result.error || 'Connection failed' })
			}
		} catch (err) {
			setTestResult({ success: false, message: err instanceof Error ? err.message : 'Connection failed' })
		} finally {
			setTesting(false)
		}
	}

	async function handleGrab(result: SearchResult, instanceId: number) {
		if (!selectedIntegration) {
			setGrabResult({ guid: result.guid, success: false, message: 'No integration selected' })
			return
		}
		setGrabbing(result.guid)
		setGrabResult(null)
		try {
			await grabRelease(selectedIntegration.id, {
				guid: result.guid,
				indexerId: result.indexerId,
				downloadUrl: result.downloadUrl,
				magnetUrl: result.magnetUrl,
			}, instanceId)
			setGrabResult({ guid: result.guid, success: true })
			setTimeout(() => setGrabResult(null), 3000)
		} catch (err) {
			setGrabResult({ guid: result.guid, success: false, message: err instanceof Error ? err.message : 'Failed' })
		} finally {
			setGrabbing(null)
		}
	}

	function handleSort(key: SortKey) {
		if (sortKey === key) {
			setSortAsc(!sortAsc)
		} else {
			setSortKey(key)
			setSortAsc(false)
		}
	}

	const filteredResults = filterResults(results, filter)
	const sortedResults = sortResults(filteredResults, sortKey, sortAsc)

	const totalPages = Math.ceil(sortedResults.length / itemsPerPage)
	const paginatedResults = sortedResults.slice((page - 1) * itemsPerPage, page * itemsPerPage)

	useEffect(() => {
		setPage(1)
		setFilter('')
	}, [results])

	useEffect(() => {
		setPage(1)
	}, [filter])

	if (integrations.length === 0 && !showAddForm) {
		return (
			<div className="text-center py-12 rounded-xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
				<p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No integrations configured</p>
				<button
					onClick={() => setShowAddForm(true)}
					className="px-4 py-2 rounded-lg text-sm font-medium"
					style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
				>
					Add Integration
				</button>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			{showAddForm && (
				<div className="p-6 rounded-xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
					<h2 className="text-lg font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Add Integration</h2>
					<form onSubmit={handleAddIntegration} className="space-y-4">
						<div className="grid grid-cols-3 gap-4">
							<div>
								<label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Label</label>
								<input
									type="text"
									value={formData.label}
									onChange={(e) => setFormData({ ...formData, label: e.target.value })}
									className="w-full px-4 py-2.5 rounded-lg border text-sm"
									style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
									placeholder="My Prowlarr"
									required
								/>
							</div>
							<div>
								<label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>URL</label>
								<input
									type="url"
									value={formData.url}
									onChange={(e) => setFormData({ ...formData, url: e.target.value })}
									className="w-full px-4 py-2.5 rounded-lg border text-sm"
									style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
									placeholder="http://localhost:9696"
									required
								/>
							</div>
							<div>
								<label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>API Key</label>
								<input
									type="password"
									value={formData.api_key}
									onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
									className="w-full px-4 py-2.5 rounded-lg border text-sm"
									style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
									placeholder="••••••••"
									required
								/>
							</div>
						</div>
						{testResult && (
							<div
								className="px-4 py-3 rounded-lg text-sm"
								style={{
									backgroundColor: testResult.success
										? 'color-mix(in srgb, #a6e3a1 10%, transparent)'
										: 'color-mix(in srgb, var(--error) 10%, transparent)',
									color: testResult.success ? '#a6e3a1' : 'var(--error)',
								}}
							>
								{testResult.message}
							</div>
						)}
						<div className="flex gap-3">
							<button
								type="submit"
								disabled={submitting}
								className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
								style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
							>
								{submitting ? 'Adding...' : 'Add'}
							</button>
							<button
								type="button"
								onClick={handleTestConnection}
								disabled={testing || !formData.url || !formData.api_key}
								className="px-4 py-2 rounded-lg text-sm border disabled:opacity-50"
								style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
							>
								{testing ? 'Testing...' : 'Test Connection'}
							</button>
							<button
								type="button"
								onClick={() => { setShowAddForm(false); setTestResult(null) }}
								className="px-4 py-2 rounded-lg text-sm border"
								style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
							>
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}

			{error && (
				<div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)', color: 'var(--error)' }}>
					{error}
				</div>
			)}

			{!showAddForm && (
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						{integrations.map((integration) => (
							<button
								key={integration.id}
								onClick={() => setSelectedIntegration(integration)}
								className={`px-3 py-1.5 rounded-lg text-sm ${selectedIntegration?.id === integration.id ? 'font-medium' : ''}`}
								style={{
									backgroundColor: selectedIntegration?.id === integration.id ? 'var(--accent)' : 'var(--bg-secondary)',
									color: selectedIntegration?.id === integration.id ? 'var(--accent-contrast)' : 'var(--text-secondary)',
								}}
							>
								{integration.label}
							</button>
						))}
						<button
							onClick={() => setShowAddForm(true)}
							className="p-1.5 rounded-lg border"
							style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
						>
							<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
							</svg>
						</button>
					</div>
					{selectedIntegration && (
						<button
							onClick={() => setDeleteConfirm(selectedIntegration)}
							className="p-1.5 rounded-lg border transition-colors hover:bg-[var(--bg-tertiary)]"
							style={{ borderColor: 'var(--border)', color: 'var(--error)' }}
						>
							<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
							</svg>
						</button>
					)}
				</div>
			)}

			{selectedIntegration && !showAddForm && (
				<form onSubmit={handleSearch} className="flex gap-3">
					<div className="flex-1">
						<input
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							className="w-full px-4 py-2.5 rounded-lg border text-sm"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
							placeholder="Search torrents..."
						/>
					</div>
					<div className="relative">
						<button
							type="button"
							onClick={() => setIndexerDropdownOpen(!indexerDropdownOpen)}
							className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
						>
							<span>
								{selectedIndexer === '-2'
									? 'All Indexers'
									: indexers.find(i => String(i.id) === selectedIndexer)?.name || 'All Indexers'}
							</span>
							<svg className={`w-4 h-4 transition-transform ${indexerDropdownOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
							</svg>
						</button>
						{indexerDropdownOpen && (
							<>
								<div className="fixed inset-0 z-10" onClick={() => setIndexerDropdownOpen(false)} />
								<div
									className="absolute right-0 top-full mt-1 z-20 min-w-[200px] max-h-64 overflow-y-auto rounded-lg border shadow-lg"
									style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
								>
									<button
										type="button"
										onClick={() => { setSelectedIndexer('-2'); setIndexerDropdownOpen(false) }}
										className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
										style={{ color: selectedIndexer === '-2' ? 'var(--accent)' : 'var(--text-primary)' }}
									>
										All Indexers
									</button>
									{indexers.filter(i => i.enable && i.protocol === 'torrent').map((indexer) => (
										<button
											key={indexer.id}
											type="button"
											onClick={() => { setSelectedIndexer(String(indexer.id)); setIndexerDropdownOpen(false) }}
											className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
											style={{ color: String(indexer.id) === selectedIndexer ? 'var(--accent)' : 'var(--text-primary)' }}
										>
											{indexer.name}
										</button>
									))}
								</div>
							</>
						)}
					</div>
					<button
						type="submit"
						disabled={searching || !query.trim()}
						className="px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
						style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
					>
						{searching ? 'Searching...' : 'Search'}
					</button>
				</form>
			)}

			{results.length > 0 && (
				<>
					<div className="flex items-center gap-2 flex-wrap">
						{availableTags.length > 0 && (
							<div className="relative">
								<button
									type="button"
									onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
									className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm"
									style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
								>
									<svg className="w-4 h-4" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
									</svg>
									<span>Filter</span>
									<svg className={`w-3 h-3 transition-transform ${filterDropdownOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
									</svg>
								</button>
								{filterDropdownOpen && (
									<>
										<div className="fixed inset-0 z-10" onClick={() => setFilterDropdownOpen(false)} />
										<div
											className="absolute left-0 top-full mt-1 z-20 min-w-[200px] max-h-72 overflow-y-auto rounded-lg border shadow-lg"
											style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
										>
											<div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
												<input
													type="text"
													placeholder="Type to filter..."
													value={filter}
													onChange={(e) => setFilter(e.target.value)}
													onClick={(e) => e.stopPropagation()}
													className="w-full px-2.5 py-1.5 rounded border text-sm"
													style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
													autoFocus
												/>
											</div>
											<div className="p-1">
											{availableTags.slice(0, 20).map(({ tag, count }) => (
												<button
													key={tag}
													type="button"
													onClick={() => { setFilter(filter === tag ? '' : tag); setFilterDropdownOpen(false) }}
													className="w-full flex items-center justify-between px-3 py-1.5 text-sm rounded hover:bg-[var(--bg-tertiary)] transition-colors"
													style={{ color: filter === tag ? 'var(--accent)' : 'var(--text-primary)' }}
												>
													<span>{tag}</span>
													<span className="text-xs" style={{ color: 'var(--text-muted)' }}>{count}</span>
												</button>
											))}
											</div>
										</div>
									</>
								)}
							</div>
						)}
						{filter && (
							<button
								onClick={() => setFilter('')}
								className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
								style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}
							>
								{filter}
								<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						)}
						<span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
							{filter ? `${sortedResults.length} of ${results.length}` : `${results.length} results`}
						</span>
					</div>
					{sortedResults.length > 0 && (
					<div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
						<table className="w-full text-sm table-fixed">
							<thead>
								<tr style={{ borderBottom: '1px solid var(--border)' }}>
									<th className="text-left px-4 py-3 font-medium w-[45%]" style={{ color: 'var(--text-muted)' }}>Name</th>
									<th className="text-left px-4 py-3 font-medium w-[12%]" style={{ color: 'var(--text-muted)' }}>Indexer</th>
									<th
										className="text-right px-4 py-3 font-medium cursor-pointer hover:text-[var(--text-primary)] w-[10%]"
										style={{ color: sortKey === 'size' ? 'var(--text-primary)' : 'var(--text-muted)' }}
										onClick={() => handleSort('size')}
									>
										Size {sortKey === 'size' && (sortAsc ? '↑' : '↓')}
									</th>
									<th
										className="text-right px-4 py-3 font-medium cursor-pointer hover:text-[var(--text-primary)] w-[10%]"
										style={{ color: sortKey === 'seeders' ? 'var(--text-primary)' : 'var(--text-muted)' }}
										onClick={() => handleSort('seeders')}
									>
										S/L {sortKey === 'seeders' && (sortAsc ? '↑' : '↓')}
									</th>
									<th
										className="text-right px-4 py-3 font-medium cursor-pointer hover:text-[var(--text-primary)] w-[10%]"
										style={{ color: sortKey === 'age' ? 'var(--text-primary)' : 'var(--text-muted)' }}
										onClick={() => handleSort('age')}
									>
										Age {sortKey === 'age' && (sortAsc ? '↑' : '↓')}
									</th>
									<th className="px-4 py-3 w-[13%]"></th>
								</tr>
							</thead>
							<tbody>
								{paginatedResults.map((result) => (
									<tr key={result.guid} className="hover:bg-[var(--bg-tertiary)]" style={{ borderBottom: '1px solid var(--border)' }}>
										<td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
											<div className="truncate" title={result.title}>{result.title}</div>
										</td>
										<td className="px-4 py-3 truncate" style={{ color: 'var(--text-muted)' }}>{result.indexer}</td>
										<td className="px-4 py-3 text-right whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{formatSize(result.size)}</td>
										<td className="px-4 py-3 text-right whitespace-nowrap">
											<span style={{ color: '#a6e3a1' }}>{result.seeders ?? '-'}</span>
											<span style={{ color: 'var(--text-muted)' }}>/</span>
											<span style={{ color: 'var(--error)' }}>{result.leechers ?? '-'}</span>
										</td>
										<td className="px-4 py-3 text-right whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatAge(result.publishDate)}</td>
										<td className="px-4 py-3 text-right">
											{grabResult?.guid === result.guid ? (
												<span
													className="px-3 py-1 rounded text-xs font-medium"
													style={{
														backgroundColor: grabResult.success ? 'color-mix(in srgb, #a6e3a1 20%, transparent)' : 'color-mix(in srgb, var(--error) 20%, transparent)',
														color: grabResult.success ? '#a6e3a1' : 'var(--error)',
													}}
												>
													{grabResult.success ? 'Added!' : grabResult.message}
												</span>
											) : instances.length === 0 ? (
												<span className="text-xs" style={{ color: 'var(--text-muted)' }}>No instances</span>
											) : instances.length === 1 ? (
												<button
													onClick={() => handleGrab(result, instances[0].id)}
													disabled={grabbing === result.guid}
													className="px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
													style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
												>
													{grabbing === result.guid ? '...' : 'Grab'}
												</button>
											) : (
												<div className="relative inline-block">
													<button
														onClick={() => setGrabDropdownOpen(grabDropdownOpen === result.guid ? null : result.guid)}
														disabled={grabbing === result.guid}
														className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
														style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
													>
														{grabbing === result.guid ? '...' : 'Grab'}
														<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
															<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
														</svg>
													</button>
													{grabDropdownOpen === result.guid && (
														<>
															<div className="fixed inset-0 z-10" onClick={() => setGrabDropdownOpen(null)} />
															<div
																className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-lg border shadow-lg overflow-hidden"
																style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
															>
																{instances.map(i => (
																	<button
																		key={i.id}
																		onClick={() => { handleGrab(result, i.id); setGrabDropdownOpen(null) }}
																		className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-tertiary)] transition-colors"
																		style={{ color: 'var(--text-primary)' }}
																	>
																		{i.label}
																	</button>
																))}
															</div>
														</>
													)}
												</div>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					)}
					{sortedResults.length === 0 && filter && (
						<div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
							No results match "{filter}"
						</div>
					)}
					{totalPages > 1 && (
						<div className="flex items-center justify-between">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								{sortedResults.length} results
							</span>
							<div className="flex items-center gap-1">
								<button
									onClick={() => setPage(p => Math.max(1, p - 1))}
									disabled={page === 1}
									className="px-2 py-1 rounded text-xs disabled:opacity-30"
									style={{ color: 'var(--text-secondary)' }}
								>
									←
								</button>
								{Array.from({ length: totalPages }, (_, i) => i + 1)
									.filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
									.map((p, idx, arr) => (
										<Fragment key={p}>
											{idx > 0 && arr[idx - 1] !== p - 1 && (
												<span className="px-1 text-xs" style={{ color: 'var(--text-muted)' }}>...</span>
											)}
											<button
												onClick={() => setPage(p)}
												className="min-w-[28px] px-2 py-1 rounded text-xs font-medium"
												style={{
													backgroundColor: page === p ? 'var(--accent)' : 'transparent',
													color: page === p ? 'var(--accent-contrast)' : 'var(--text-secondary)',
												}}
											>
												{p}
											</button>
										</Fragment>
									))}
								<button
									onClick={() => setPage(p => Math.min(totalPages, p + 1))}
									disabled={page === totalPages}
									className="px-2 py-1 rounded text-xs disabled:opacity-30"
									style={{ color: 'var(--text-secondary)' }}
								>
									→
								</button>
							</div>
						</div>
					)}
				</>
			)}

			{results.length === 0 && query && !searching && (
				<div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
					No results found
				</div>
			)}

			{deleteConfirm && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
					<div
						className="w-full max-w-sm rounded-xl border p-6"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Delete Integration</h3>
						<p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
							Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirm.label}</strong>? This action cannot be undone.
						</p>
						<div className="flex gap-3 justify-end">
							<button
								onClick={() => setDeleteConfirm(null)}
								className="px-4 py-2 rounded-lg text-sm border"
								style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
							>
								Cancel
							</button>
							<button
								onClick={handleDeleteIntegration}
								className="px-4 py-2 rounded-lg text-sm font-medium"
								style={{ backgroundColor: 'var(--error)', color: 'white' }}
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
