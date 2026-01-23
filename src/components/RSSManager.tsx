import { useState } from 'react'
import { Plus, ChevronDown, ChevronRight, Rss, RefreshCw, X } from 'lucide-react'
import { type Instance } from '../api/instances'
import { useRSSManager } from '../hooks/useRSSManager'
import type { RSSArticle } from '../types/rss'
import { Checkbox, Select } from './ui'

type Tab = 'feeds' | 'rules'

interface ArticleDownloadProps {
	article: RSSArticle
	idx: number
	instances: Instance[]
	rss: ReturnType<typeof useRSSManager>
}

function ArticleDownload({ article, idx, instances, rss }: ArticleDownloadProps) {
	const articleId = article.id || String(idx)
	const isGrabbing = rss.grabbing === articleId
	const grabResult = rss.grabResult?.id === articleId ? rss.grabResult : null

	if (grabResult) {
		return (
			<span
				className="px-2 py-1 rounded text-[10px] font-medium"
				style={{
					backgroundColor: grabResult.success
						? 'color-mix(in srgb, #a6e3a1 20%, transparent)'
						: 'color-mix(in srgb, var(--error) 20%, transparent)',
					color: grabResult.success ? '#a6e3a1' : 'var(--error)',
				}}
			>
				{grabResult.success ? 'Added!' : 'Failed'}
			</span>
		)
	}

	if (instances.length === 1) {
		return (
			<button
				onClick={() => rss.handleGrabArticle(article.torrentURL!, articleId, instances[0].id)}
				disabled={isGrabbing}
				className="px-2 py-1 rounded text-[10px] font-medium disabled:opacity-50"
				style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
			>
				{isGrabbing ? '...' : 'Download'}
			</button>
		)
	}

	const isOpen = rss.instanceDropdown === articleId

	return (
		<div className="relative">
			<button
				onClick={() => rss.setInstanceDropdown(isOpen ? null : articleId)}
				disabled={isGrabbing}
				className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium disabled:opacity-50"
				style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
			>
				{isGrabbing ? '...' : 'Download'}
				<ChevronDown className="w-2.5 h-2.5" strokeWidth={2.5} />
			</button>
			{isOpen && (
				<>
					<div className="fixed inset-0 z-10" onClick={() => rss.setInstanceDropdown(null)} />
					<div
						className="absolute right-0 top-full mt-1 z-20 min-w-[120px] rounded-lg border shadow-lg overflow-hidden"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						{instances.map((i) => (
							<button
								key={i.id}
								onClick={() => rss.handleGrabArticle(article.torrentURL!, articleId, i.id)}
								className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-[var(--bg-tertiary)] transition-colors"
								style={{ color: 'var(--text-primary)' }}
							>
								{i.label}
							</button>
						))}
					</div>
				</>
			)}
		</div>
	)
}

interface Props {
	instances: Instance[]
}

export function RSSManager({ instances }: Props) {
	const [tab, setTab] = useState<Tab>('feeds')
	const rss = useRSSManager({ instances })

	const selectedInstance = rss.selectedInstance
	if (!selectedInstance) {
		return (
			<div
				className="text-center py-12 rounded-xl border"
				style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
			>
				<p className="text-sm" style={{ color: 'var(--text-muted)' }}>
					No instances available
				</p>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					{instances.map((inst) => (
						<button
							key={inst.id}
							onClick={() => rss.selectInstance(inst)}
							className={`px-3 py-1.5 rounded-lg text-sm ${selectedInstance.id === inst.id ? 'font-medium' : ''}`}
							style={{
								backgroundColor: selectedInstance.id === inst.id ? 'var(--accent)' : 'var(--bg-secondary)',
								color: selectedInstance.id === inst.id ? 'var(--accent-contrast)' : 'var(--text-secondary)',
							}}
						>
							{inst.label}
						</button>
					))}
				</div>
				<div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
					{(['feeds', 'rules'] as Tab[]).map((t) => (
						<button
							key={t}
							onClick={() => setTab(t)}
							className="px-3 py-1 rounded-md text-xs font-medium capitalize transition-all"
							style={{
								backgroundColor: tab === t ? 'var(--bg-primary)' : 'transparent',
								color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
								boxShadow: tab === t ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
							}}
						>
							{t}
						</button>
					))}
				</div>
			</div>

			{rss.error && (
				<div
					className="px-4 py-3 rounded-lg text-sm"
					style={{ backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)', color: 'var(--error)' }}
				>
					{rss.error}
					<button onClick={rss.clearError} className="ml-2 opacity-70 hover:opacity-100">
						×
					</button>
				</div>
			)}

			{rss.loading ? (
				<div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
					Loading...
				</div>
			) : tab === 'feeds' ? (
				<>
					<div className="flex items-center gap-2">
						<button
							onClick={() => rss.setShowAddFeed(true)}
							className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
							style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
						>
							<Plus className="w-3.5 h-3.5" strokeWidth={2} />
							Add Feed
						</button>
						<button
							onClick={() => rss.setShowAddFolder(true)}
							className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border"
							style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
						>
							<Plus className="w-3.5 h-3.5" strokeWidth={2} />
							Add Folder
						</button>
					</div>

					{rss.showAddFeed && (
						<div
							className="p-4 rounded-xl border"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
						>
							<form onSubmit={rss.handleAddFeed} className="space-y-3">
								<div className="grid grid-cols-2 gap-3">
									<div>
										<label
											className="block text-[10px] font-medium mb-1 uppercase tracking-wider"
											style={{ color: 'var(--text-muted)' }}
										>
											Feed URL
										</label>
										<input
											type="url"
											value={rss.feedUrl}
											onChange={(e) => rss.setFeedUrl(e.target.value)}
											className="w-full px-3 py-2 rounded-lg border text-sm"
											style={{
												backgroundColor: 'var(--bg-tertiary)',
												borderColor: 'var(--border)',
												color: 'var(--text-primary)',
											}}
											placeholder="https://example.com/rss.xml"
											required
										/>
									</div>
									<div>
										<label
											className="block text-[10px] font-medium mb-1 uppercase tracking-wider"
											style={{ color: 'var(--text-muted)' }}
										>
											Folder (optional)
										</label>
										<Select
											value={rss.feedPath}
											onChange={rss.setFeedPath}
											options={[
												{ value: '', label: 'None' },
												...rss.feeds.filter((f) => f.isFolder).map((f) => ({ value: f.path, label: f.path })),
											]}
											minWidth="100%"
											className="h-[38px] [&>button]:h-full [&>button]:rounded-lg [&>button]:px-3 [&>button]:text-sm"
										/>
									</div>
								</div>
								<div className="flex gap-2">
									<button
										type="submit"
										disabled={rss.submitting}
										className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
										style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
									>
										{rss.submitting ? 'Adding...' : 'Add'}
									</button>
									<button
										type="button"
										onClick={rss.cancelAddFeed}
										className="px-3 py-1.5 rounded-lg text-xs border"
										style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
									>
										Cancel
									</button>
								</div>
							</form>
						</div>
					)}

					{rss.showAddFolder && (
						<div
							className="p-4 rounded-xl border"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
						>
							<form onSubmit={rss.handleAddFolder} className="space-y-3">
								<div>
									<label
										className="block text-[10px] font-medium mb-1 uppercase tracking-wider"
										style={{ color: 'var(--text-muted)' }}
									>
										Folder Name
									</label>
									<input
										type="text"
										value={rss.folderName}
										onChange={(e) => rss.setFolderName(e.target.value)}
										className="w-full px-3 py-2 rounded-lg border text-sm"
										style={{
											backgroundColor: 'var(--bg-tertiary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
										placeholder="Movies"
										required
									/>
								</div>
								<div className="flex gap-2">
									<button
										type="submit"
										disabled={rss.submitting}
										className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
										style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
									>
										{rss.submitting ? 'Creating...' : 'Create'}
									</button>
									<button
										type="button"
										onClick={rss.cancelAddFolder}
										className="px-3 py-1.5 rounded-lg text-xs border"
										style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
									>
										Cancel
									</button>
								</div>
							</form>
						</div>
					)}

					<div className="grid grid-cols-[280px_1fr] gap-4">
						<div
							className="rounded-xl border overflow-hidden"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
						>
							<div
								className="px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-wider"
								style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
							>
								Feeds
							</div>
							<div className="max-h-[400px] overflow-y-auto">
								{rss.visibleFeeds.length === 0 ? (
									<div className="px-3 py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
										No feeds
									</div>
								) : (
									rss.visibleFeeds.map((feed) => (
										<div
											key={feed.path}
											className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group ${rss.selectedFeed?.path === feed.path ? 'bg-[var(--bg-tertiary)]' : 'hover:bg-[var(--bg-tertiary)]'}`}
											style={{ paddingLeft: `${12 + feed.depth * 16}px` }}
											onClick={() => (feed.isFolder ? rss.toggleFolder(feed.path) : rss.setSelectedFeed(feed))}
										>
											{feed.isFolder ? (
												<ChevronRight
													className={`w-4 h-4 shrink-0 transition-transform ${rss.expandedFolders.has(feed.path) ? 'rotate-90' : ''}`}
													style={{ color: 'var(--text-muted)' }}
													strokeWidth={2}
												/>
											) : (
												<Rss className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
											)}
											<span
												className="text-xs truncate flex-1"
												style={{
													color: rss.selectedFeed?.path === feed.path ? 'var(--text-primary)' : 'var(--text-secondary)',
												}}
											>
												{feed.name}
											</span>
											{!feed.isFolder && (
												<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
													<button
														onClick={(e) => {
															e.stopPropagation()
															rss.handleRefresh(feed)
														}}
														disabled={rss.refreshing === feed.path}
														className="p-1 rounded hover:bg-[var(--bg-primary)]"
														style={{ color: 'var(--text-muted)' }}
													>
														<RefreshCw
															className={`w-3 h-3 ${rss.refreshing === feed.path ? 'animate-spin' : ''}`}
															strokeWidth={2}
														/>
													</button>
													<button
														onClick={(e) => {
															e.stopPropagation()
															rss.setDeleteConfirm(feed)
														}}
														className="p-1 rounded hover:bg-[var(--bg-primary)]"
														style={{ color: 'var(--error)' }}
													>
														<X className="w-3 h-3" strokeWidth={2} />
													</button>
												</div>
											)}
											{feed.isFolder && (
												<button
													onClick={(e) => {
														e.stopPropagation()
														rss.setDeleteConfirm(feed)
													}}
													className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--bg-primary)]"
													style={{ color: 'var(--error)' }}
												>
													<X className="w-3 h-3" strokeWidth={2} />
												</button>
											)}
										</div>
									))
								)}
							</div>
						</div>

						<div
							className="rounded-xl border overflow-hidden"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
						>
							<div
								className="px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-wider flex items-center justify-between"
								style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
							>
								<span>Articles {rss.selectedFeed && `(${rss.feedArticles.length})`}</span>
								{rss.selectedFeed && (
									<span className="font-normal normal-case truncate max-w-[200px]" title={rss.selectedFeed.url}>
										{rss.selectedFeed.name}
									</span>
								)}
							</div>
							<div className="max-h-[400px] overflow-y-auto">
								{!rss.selectedFeed ? (
									<div className="px-3 py-12 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
										Select a feed to view articles
									</div>
								) : rss.feedArticles.length > 0 ? (
									rss.feedArticles.map((article, idx) => (
										<div
											key={article.id || idx}
											className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover:bg-[var(--bg-tertiary)] transition-colors"
											style={{ borderColor: 'var(--border)' }}
										>
											<div className="flex-1 min-w-0">
												<div
													className="text-xs truncate"
													style={{ color: article.isRead ? 'var(--text-muted)' : 'var(--text-primary)' }}
													title={article.title}
												>
													{article.title}
												</div>
												{article.date && (
													<div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
														{new Date(article.date).toLocaleDateString()}
													</div>
												)}
											</div>
											{article.torrentURL && (
												<ArticleDownload article={article} idx={idx} instances={instances} rss={rss} />
											)}
										</div>
									))
								) : rss.selectedFeed.data?.isLoading ? (
									<div className="px-3 py-12 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
										Loading feed...
									</div>
								) : rss.selectedFeed.data?.hasError ? (
									<div className="px-3 py-12 text-center text-xs" style={{ color: 'var(--error)' }}>
										Failed to load feed
									</div>
								) : (
									<div className="px-3 py-12 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
										No articles - try refreshing
									</div>
								)}
							</div>
						</div>
					</div>
				</>
			) : (
				<>
					<div className="flex items-center gap-2">
						<button
							onClick={() => rss.setShowNewRule(true)}
							className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
							style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
						>
							<Plus className="w-3.5 h-3.5" strokeWidth={2} />
							New Rule
						</button>
					</div>

					{rss.showNewRule && (
						<div
							className="p-4 rounded-xl border"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
						>
							<form onSubmit={rss.handleCreateRule} className="space-y-3">
								<div>
									<label
										className="block text-[10px] font-medium mb-1 uppercase tracking-wider"
										style={{ color: 'var(--text-muted)' }}
									>
										Rule Name
									</label>
									<input
										type="text"
										value={rss.newRuleName}
										onChange={(e) => rss.setNewRuleName(e.target.value)}
										className="w-full px-3 py-2 rounded-lg border text-sm"
										style={{
											backgroundColor: 'var(--bg-tertiary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
										placeholder="TV Shows 1080p"
										required
									/>
								</div>
								<div className="flex gap-2">
									<button
										type="submit"
										disabled={rss.submitting}
										className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
										style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
									>
										{rss.submitting ? 'Creating...' : 'Create'}
									</button>
									<button
										type="button"
										onClick={rss.cancelNewRule}
										className="px-3 py-1.5 rounded-lg text-xs border"
										style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
									>
										Cancel
									</button>
								</div>
							</form>
						</div>
					)}

					<div className="grid grid-cols-[280px_1fr] gap-4">
						<div
							className="rounded-xl border overflow-hidden"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
						>
							<div
								className="px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-wider"
								style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
							>
								Rules ({Object.keys(rss.rules).length})
							</div>
							<div className="max-h-[500px] overflow-y-auto">
								{Object.keys(rss.rules).length === 0 ? (
									<div className="px-3 py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
										No rules
									</div>
								) : (
									Object.entries(rss.rules).map(([name, rule]) => (
										<div
											key={name}
											className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group ${rss.selectedRule === name ? 'bg-[var(--bg-tertiary)]' : 'hover:bg-[var(--bg-tertiary)]'}`}
											onClick={() => rss.setSelectedRule(name)}
										>
											<div
												className="w-2 h-2 rounded-full shrink-0"
												style={{ backgroundColor: rule.enabled ? '#a6e3a1' : 'var(--text-muted)' }}
											/>
											<span
												className="text-xs truncate flex-1"
												style={{ color: rss.selectedRule === name ? 'var(--text-primary)' : 'var(--text-secondary)' }}
											>
												{name}
											</span>
											<button
												onClick={(e) => {
													e.stopPropagation()
													rss.setRuleDeleteConfirm(name)
												}}
												className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--bg-primary)]"
												style={{ color: 'var(--error)' }}
											>
												<X className="w-3 h-3" strokeWidth={2} />
											</button>
										</div>
									))
								)}
							</div>
						</div>

						<div
							className="rounded-xl border overflow-hidden"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
						>
							<div
								className="px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-wider"
								style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
							>
								{rss.selectedRule ? `Edit: ${rss.selectedRule}` : 'Rule Editor'}
							</div>
							{!rss.selectedRule || !rss.editingRule ? (
								<div className="px-3 py-12 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
									Select a rule to edit
								</div>
							) : (
								<div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
									<Checkbox
										label="Enabled"
										checked={rss.editingRule.enabled}
										onChange={(v) => rss.setEditingRule({ ...rss.editingRule!, enabled: v })}
									/>

									<div className="grid grid-cols-2 gap-4">
										<div>
											<label
												className="block text-[10px] font-medium mb-1 uppercase tracking-wider"
												style={{ color: 'var(--text-muted)' }}
											>
												Must Contain
											</label>
											<input
												type="text"
												value={rss.editingRule.mustContain}
												onChange={(e) => rss.setEditingRule({ ...rss.editingRule!, mustContain: e.target.value })}
												className="w-full px-3 py-2 rounded border text-xs font-mono"
												style={{
													backgroundColor: 'var(--bg-tertiary)',
													borderColor: 'var(--border)',
													color: 'var(--text-primary)',
												}}
												placeholder="1080p|720p"
											/>
										</div>
										<div>
											<label
												className="block text-[10px] font-medium mb-1 uppercase tracking-wider"
												style={{ color: 'var(--text-muted)' }}
											>
												Must NOT Contain
											</label>
											<input
												type="text"
												value={rss.editingRule.mustNotContain}
												onChange={(e) => rss.setEditingRule({ ...rss.editingRule!, mustNotContain: e.target.value })}
												className="w-full px-3 py-2 rounded border text-xs font-mono"
												style={{
													backgroundColor: 'var(--bg-tertiary)',
													borderColor: 'var(--border)',
													color: 'var(--text-primary)',
												}}
												placeholder="CAM|TS"
											/>
										</div>
									</div>

									<div className="flex items-center gap-4">
										<Checkbox
											label="Use Regex"
											checked={rss.editingRule.useRegex}
											onChange={(v) => rss.setEditingRule({ ...rss.editingRule!, useRegex: v })}
										/>
										<Checkbox
											label="Smart Episode Filter"
											checked={rss.editingRule.smartFilter}
											onChange={(v) => rss.setEditingRule({ ...rss.editingRule!, smartFilter: v })}
										/>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div>
											<label
												className="block text-[10px] font-medium mb-1 uppercase tracking-wider"
												style={{ color: 'var(--text-muted)' }}
											>
												Episode Filter
											</label>
											<input
												type="text"
												value={rss.editingRule.episodeFilter}
												onChange={(e) => rss.setEditingRule({ ...rss.editingRule!, episodeFilter: e.target.value })}
												className="w-full px-3 py-2 rounded border text-xs font-mono"
												style={{
													backgroundColor: 'var(--bg-tertiary)',
													borderColor: 'var(--border)',
													color: 'var(--text-primary)',
												}}
												placeholder="S01E01-S01E10"
											/>
										</div>
										<div>
											<label
												className="block text-[10px] font-medium mb-1 uppercase tracking-wider"
												style={{ color: 'var(--text-muted)' }}
											>
												Ignore Days
											</label>
											<input
												type="number"
												value={rss.editingRule.ignoreDays}
												onChange={(e) =>
													rss.setEditingRule({ ...rss.editingRule!, ignoreDays: parseInt(e.target.value) || 0 })
												}
												className="w-full px-3 py-2 rounded border text-xs"
												style={{
													backgroundColor: 'var(--bg-tertiary)',
													borderColor: 'var(--border)',
													color: 'var(--text-primary)',
												}}
												min={0}
											/>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div>
											<label
												className="block text-[10px] font-medium mb-1 uppercase tracking-wider"
												style={{ color: 'var(--text-muted)' }}
											>
												Category
											</label>
											<select
												value={rss.editingRule.assignedCategory}
												onChange={(e) => rss.setEditingRule({ ...rss.editingRule!, assignedCategory: e.target.value })}
												className="w-full px-3 py-2 rounded border text-xs"
												style={{
													backgroundColor: 'var(--bg-tertiary)',
													borderColor: 'var(--border)',
													color: 'var(--text-primary)',
												}}
											>
												<option value="">None</option>
												{Object.keys(rss.categories).map((cat) => (
													<option key={cat} value={cat}>
														{cat}
													</option>
												))}
											</select>
										</div>
										<div>
											<label
												className="block text-[10px] font-medium mb-1 uppercase tracking-wider"
												style={{ color: 'var(--text-muted)' }}
											>
												Add Paused
											</label>
											<select
												value={
													rss.editingRule.addPaused === null
														? 'default'
														: rss.editingRule.addPaused
															? 'always'
															: 'never'
												}
												onChange={(e) =>
													rss.setEditingRule({
														...rss.editingRule!,
														addPaused: e.target.value === 'default' ? null : e.target.value === 'always',
													})
												}
												className="w-full px-3 py-2 rounded border text-xs"
												style={{
													backgroundColor: 'var(--bg-tertiary)',
													borderColor: 'var(--border)',
													color: 'var(--text-primary)',
												}}
											>
												<option value="default">Use global setting</option>
												<option value="always">Always</option>
												<option value="never">Never</option>
											</select>
										</div>
									</div>

									<div>
										<label
											className="block text-[10px] font-medium mb-1 uppercase tracking-wider"
											style={{ color: 'var(--text-muted)' }}
										>
											Save Path
										</label>
										<input
											type="text"
											value={rss.editingRule.savePath}
											onChange={(e) => rss.setEditingRule({ ...rss.editingRule!, savePath: e.target.value })}
											className="w-full px-3 py-2 rounded border text-xs font-mono"
											style={{
												backgroundColor: 'var(--bg-tertiary)',
												borderColor: 'var(--border)',
												color: 'var(--text-primary)',
											}}
											placeholder="/downloads/tv"
										/>
									</div>

									<div>
										<label
											className="block text-[10px] font-medium mb-2 uppercase tracking-wider"
											style={{ color: 'var(--text-muted)' }}
										>
											Apply to Feeds
										</label>
										<div
											className="max-h-32 overflow-y-auto rounded border p-2 space-y-1"
											style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
										>
											{rss.feedUrls.length === 0 ? (
												<div className="text-xs py-2 text-center" style={{ color: 'var(--text-muted)' }}>
													No feeds available
												</div>
											) : (
												rss.feedUrls.map((url) => (
													<Checkbox
														key={url}
														label={url}
														checked={rss.editingRule!.affectedFeeds.includes(url)}
														onChange={(checked) => {
															const newFeeds = checked
																? [...rss.editingRule!.affectedFeeds, url]
																: rss.editingRule!.affectedFeeds.filter((f) => f !== url)
															rss.setEditingRule({ ...rss.editingRule!, affectedFeeds: newFeeds })
														}}
													/>
												))
											)}
										</div>
									</div>

									<div className="flex items-center gap-2 pt-2">
										<button
											onClick={rss.handleSaveRule}
											disabled={rss.savingRule}
											className="px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-50"
											style={{
												backgroundColor: rss.ruleSaved ? '#a6e3a1' : 'var(--accent)',
												color: rss.ruleSaved ? '#1e1e2e' : 'var(--accent-contrast)',
											}}
										>
											{rss.savingRule ? 'Saving...' : rss.ruleSaved ? 'Saved!' : 'Save'}
										</button>
										<button
											onClick={rss.handleCancelEdit}
											className="px-4 py-2 rounded-lg text-xs border"
											style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
										>
											Cancel
										</button>
										<button
											onClick={rss.handlePreviewMatches}
											disabled={rss.loadingMatches}
											className="px-4 py-2 rounded-lg text-xs border disabled:opacity-50"
											style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
										>
											{rss.loadingMatches ? 'Loading...' : 'Preview Matches'}
										</button>
									</div>

									{rss.matchingArticles && (
										<div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
											<div
												className="text-[10px] font-semibold uppercase tracking-wider mb-2"
												style={{ color: 'var(--text-muted)' }}
											>
												Matching Articles
											</div>
											<div
												className="max-h-40 overflow-y-auto rounded border p-2"
												style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
											>
												{Object.keys(rss.matchingArticles).length === 0 ? (
													<div className="text-xs py-2 text-center" style={{ color: 'var(--text-muted)' }}>
														No matches
													</div>
												) : (
													Object.entries(rss.matchingArticles).map(([feedName, matchedTitles]) => (
														<div key={feedName} className="mb-2 last:mb-0">
															<div
																className="text-[10px] font-medium truncate"
																style={{ color: 'var(--text-secondary)' }}
															>
																{feedName}
															</div>
															{matchedTitles.map((title, i) => (
																<div
																	key={i}
																	className="text-xs pl-2 truncate"
																	style={{ color: 'var(--text-muted)' }}
																	title={title}
																>
																	{title}
																</div>
															))}
														</div>
													))
												)}
											</div>
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				</>
			)}

			{rss.deleteConfirm && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center p-4"
					style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
				>
					<div
						className="w-full max-w-sm rounded-xl border p-6"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
							Delete {rss.deleteConfirm.isFolder ? 'Folder' : 'Feed'}
						</h3>
						<p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
							Are you sure you want to delete{' '}
							<strong style={{ color: 'var(--text-primary)' }}>{rss.deleteConfirm.name}</strong>?
							{rss.deleteConfirm.isFolder && ' This will also delete all feeds inside.'}
						</p>
						<div className="flex gap-3 justify-end">
							<button
								onClick={() => rss.setDeleteConfirm(null)}
								className="px-4 py-2 rounded-lg text-sm border"
								style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
							>
								Cancel
							</button>
							<button
								onClick={rss.handleDeleteItem}
								className="px-4 py-2 rounded-lg text-sm font-medium"
								style={{ backgroundColor: 'var(--error)', color: 'white' }}
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}

			{rss.ruleDeleteConfirm && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center p-4"
					style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
				>
					<div
						className="w-full max-w-sm rounded-xl border p-6"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
							Delete Rule
						</h3>
						<p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
							Are you sure you want to delete{' '}
							<strong style={{ color: 'var(--text-primary)' }}>{rss.ruleDeleteConfirm}</strong>?
						</p>
						<div className="flex gap-3 justify-end">
							<button
								onClick={() => rss.setRuleDeleteConfirm(null)}
								className="px-4 py-2 rounded-lg text-sm border"
								style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
							>
								Cancel
							</button>
							<button
								onClick={rss.handleDeleteRule}
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
