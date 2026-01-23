import { useState, useEffect, useCallback } from 'react'
import {
	Search,
	FolderOpen,
	Trash2,
	Rss,
	FileText,
	ArrowLeftRight,
	AlertTriangle,
	Check,
	User,
	Lock,
	LogOut,
	ChevronLeft,
	ArrowDown,
	ArrowUp,
	Server,
	Settings,
	Pencil,
	Info,
} from 'lucide-react'
import {
	getInstances,
	createInstance,
	updateInstance,
	deleteInstance,
	type Instance,
	type CreateInstanceData,
} from '../api/instances'
import { logout, changePassword } from '../api/auth'
import { ThemeSwitcher } from './ThemeSwitcher'
import { SettingsPanel } from './SettingsPanel'
import { SearchPanel } from './SearchPanel'
import { FileBrowser } from './FileBrowser'
import { OrphanManager } from './OrphanManager'
import { RSSManager } from './RSSManager'
import { LogViewer } from './LogViewer'
import { CrossSeedManager } from './CrossSeedManager'
import { Checkbox } from './ui'
import { useUpdateCheck } from '../hooks/useUpdateCheck'
import { formatSpeed, formatSize } from '../utils/format'
import { renderMarkdown } from '../utils/markdown'

declare const __APP_VERSION__: string

type Tab = 'dashboard' | 'tools'
type Tool = 'indexers' | 'files' | 'orphans' | 'rss' | 'logs' | 'cross-seed' | null

interface InstanceStats {
	id: number
	label: string
	online: boolean
	total: number
	downloading: number
	seeding: number
	paused: number
	error: number
	dlSpeed: number
	upSpeed: number
	allTimeDownload: number
	allTimeUpload: number
	freeSpaceOnDisk: number
}

function SpeedGraph({ history, color }: { history: number[]; color: string }) {
	const h = 32
	const w = 80
	const values = history.length >= 5 ? history.slice(-5) : [...Array(5 - history.length).fill(0), ...history]
	const max = Math.max(...values, 1)
	const points = values.map((v, i) => `${(i / 4) * w},${h - 2 - (v / max) * (h - 4)}`).join(' ')

	return (
		<svg width={w} height={h} className="opacity-60">
			<polyline
				points={points}
				fill="none"
				stroke={color}
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

interface Props {
	username: string
	onSelectInstance: (instance: Instance) => void
	onLogout: () => void
	authDisabled?: boolean
}

export function InstanceManager({ username, onSelectInstance, onLogout, authDisabled }: Props) {
	const [tab, setTab] = useState<Tab>('dashboard')
	const [activeTool, setActiveTool] = useState<Tool>(null)
	const [instances, setInstances] = useState<Instance[]>([])
	const [stats, setStats] = useState<InstanceStats[]>([])
	const [loading, setLoading] = useState(true)
	const [showForm, setShowForm] = useState(false)
	const [editingId, setEditingId] = useState<number | null>(null)
	const [formData, setFormData] = useState<CreateInstanceData>({
		label: '',
		url: '',
		qbt_username: '',
		qbt_password: '',
		skip_auth: false,
	})
	const [error, setError] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [deleteConfirm, setDeleteConfirm] = useState<Instance | null>(null)
	const [testing, setTesting] = useState(false)
	const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
	const [userMenuOpen, setUserMenuOpen] = useState(false)
	const [showPasswordModal, setShowPasswordModal] = useState(false)
	const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' })
	const [passwordError, setPasswordError] = useState('')
	const [changingPassword, setChangingPassword] = useState(false)
	const [dlHistory, setDlHistory] = useState<number[]>([])
	const [upHistory, setUpHistory] = useState<number[]>([])
	const [settingsInstance, setSettingsInstance] = useState<Instance | null>(null)
	const [filesEnabled, setFilesEnabled] = useState(false)
	const {
		hasUpdate,
		latestVersion,
		releaseNotes,
		releaseUrl,
		isLoading: updateLoading,
		error: updateError,
	} = useUpdateCheck()

	useEffect(() => {
		fetch('/api/config')
			.then((r) => r.json())
			.then((c) => setFilesEnabled(c.filesEnabled))
			.catch(() => {})
	}, [])

	const loadInstances = useCallback(async () => {
		try {
			const data = await getInstances()
			setInstances(data)
		} catch {
			setError('Failed to load instances')
		} finally {
			setLoading(false)
		}
	}, [])

	const loadStats = useCallback(async () => {
		const res = await fetch('/api/instances/stats', { credentials: 'include' }).catch(() => null)
		if (res?.ok) {
			setStats(await res.json())
		}
	}, [])

	useEffect(() => {
		loadInstances()
	}, [loadInstances])

	useEffect(() => {
		if (instances.length > 0) {
			loadStats()
			const interval = setInterval(loadStats, 2000)
			return () => clearInterval(interval)
		}
	}, [instances.length, loadStats])

	useEffect(() => {
		if (stats.length > 0) {
			const totalDl = stats.reduce((a, s) => a + s.dlSpeed, 0)
			const totalUp = stats.reduce((a, s) => a + s.upSpeed, 0)
			setDlHistory((prev) => [...prev.slice(-4), totalDl])
			setUpHistory((prev) => [...prev.slice(-4), totalUp])
		}
	}, [stats])

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setError('')
		setSubmitting(true)
		try {
			if (editingId) {
				const updateData = { ...formData }
				if (!updateData.qbt_password) {
					delete (updateData as { qbt_password?: string }).qbt_password
				}
				await updateInstance(editingId, updateData)
			} else {
				await createInstance(formData)
			}
			setShowForm(false)
			setEditingId(null)
			setFormData({ label: '', url: '', qbt_username: '', qbt_password: '', skip_auth: false })
			setTestResult(null)
			await loadInstances()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Operation failed')
		} finally {
			setSubmitting(false)
		}
	}

	async function handleDelete() {
		if (!deleteConfirm) return
		try {
			await deleteInstance(deleteConfirm.id)
			setDeleteConfirm(null)
			await loadInstances()
		} catch {
			setError('Failed to delete instance')
		}
	}

	async function testConnection() {
		setTesting(true)
		setTestResult(null)
		try {
			let res: Response
			if (editingId && !formData.qbt_password && !formData.skip_auth) {
				res = await fetch(`/api/instances/${editingId}/test`, {
					method: 'POST',
					credentials: 'include',
				})
			} else {
				res = await fetch('/api/instances/test', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({
						url: formData.url,
						username: formData.qbt_username,
						password: formData.qbt_password,
						skip_auth: formData.skip_auth,
					}),
				})
			}
			const data = await res.json()
			if (res.ok) {
				setTestResult({ success: true, message: `Connected! qBittorrent ${data.version}` })
			} else {
				setTestResult({ success: false, message: data.error || 'Connection failed' })
			}
		} catch (err) {
			setTestResult({ success: false, message: err instanceof Error ? err.message : 'Connection failed' })
		} finally {
			setTesting(false)
		}
	}

	function openEdit(instance: Instance) {
		setEditingId(instance.id)
		setFormData({
			label: instance.label,
			url: instance.url,
			qbt_username: instance.qbt_username || '',
			qbt_password: '',
			skip_auth: instance.skip_auth,
		})
		setTestResult(null)
		setShowForm(true)
	}

	function closeForm() {
		setShowForm(false)
		setEditingId(null)
		setTestResult(null)
	}

	async function handleLogout() {
		await logout()
		onLogout()
	}

	async function handlePasswordChange(e: React.FormEvent) {
		e.preventDefault()
		setPasswordError('')
		if (passwordData.new !== passwordData.confirm) {
			setPasswordError('New passwords do not match')
			return
		}
		if (passwordData.new.length < 8) {
			setPasswordError('Password must be at least 8 characters')
			return
		}
		setChangingPassword(true)
		try {
			await changePassword(passwordData.current, passwordData.new)
			setShowPasswordModal(false)
			setPasswordData({ current: '', new: '', confirm: '' })
		} catch (err) {
			setPasswordError(err instanceof Error ? err.message : 'Failed to change password')
		} finally {
			setChangingPassword(false)
		}
	}

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
				<div className="text-sm" style={{ color: 'var(--text-muted)' }}>
					Loading...
				</div>
			</div>
		)
	}

	const displayInstances = instances.filter((i) => i.id !== editingId && i.id !== settingsInstance?.id)
	const showingPanel = showForm || settingsInstance

	return (
		<div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
			<header className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-3">
						<img src="/logo.png" alt="qbitwebui" className="w-8 h-8" />
						<span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
							qbitwebui
						</span>
					</div>
					<div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
						{[
							{ id: 'dashboard' as Tab, label: 'Dashboard' },
							{ id: 'tools' as Tab, label: 'Tools' },
						].map((t) => (
							<button
								key={t.id}
								onClick={() => {
									setTab(t.id)
									setActiveTool(null)
								}}
								className="px-3 py-1 rounded-md text-xs font-medium transition-all"
								style={{
									backgroundColor: tab === t.id ? 'var(--bg-primary)' : 'transparent',
									color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
									boxShadow: tab === t.id ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
								}}
							>
								{t.label}
							</button>
						))}
					</div>
				</div>
				<div className="flex items-center gap-3">
					<ThemeSwitcher />
					<div className="relative group">
						<div
							className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono"
							style={{
								backgroundColor: 'var(--bg-tertiary)',
								borderColor: 'var(--border)',
								color: 'var(--text-muted)',
							}}
							title={hasUpdate ? `Update available: v${latestVersion}` : 'Up to date'}
							tabIndex={0}
						>
							v{__APP_VERSION__}
							{hasUpdate ? (
								<Info className="w-3.5 h-3.5" style={{ color: 'var(--warning)' }} strokeWidth={2} />
							) : (
								<Check className="w-3.5 h-3.5" style={{ color: '#a6e3a1' }} strokeWidth={2.5} />
							)}
						</div>
						<div className="absolute right-0 top-full mt-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition">
							<div
								className="w-80 max-h-80 overflow-auto rounded-lg border shadow-xl p-3"
								style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
							>
								<div className="flex items-center justify-between mb-2">
									<span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
										Release notes{latestVersion ? ` v${latestVersion}` : ''}
									</span>
									{releaseUrl && (
										<a
											href={releaseUrl}
											target="_blank"
											rel="noreferrer"
											className="text-[10px] uppercase tracking-wide"
											style={{ color: 'var(--accent)' }}
										>
											View
										</a>
									)}
								</div>
								{updateLoading ? (
									<p className="text-xs" style={{ color: 'var(--text-muted)' }}>
										Loading release notes...
									</p>
								) : updateError ? (
									<p className="text-xs" style={{ color: 'var(--error)' }}>
										Failed to load release notes.
									</p>
								) : releaseNotes ? (
									<div className="space-y-2">{renderMarkdown(releaseNotes)}</div>
								) : (
									<p className="text-xs" style={{ color: 'var(--text-muted)' }}>
										No release notes available.
									</p>
								)}
							</div>
						</div>
					</div>
					{!authDisabled && (
						<div className="relative">
							<button
								onClick={() => setUserMenuOpen(!userMenuOpen)}
								className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]"
								style={{ backgroundColor: 'var(--bg-secondary)' }}
							>
								<User className="w-5 h-5" style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
							</button>
							{userMenuOpen && (
								<>
									<div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
									<div
										className="absolute right-0 top-full mt-2 z-20 min-w-[160px] rounded-lg border shadow-lg overflow-hidden"
										style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
									>
										<div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
											<span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
												{username}
											</span>
										</div>
										<button
											onClick={() => {
												setUserMenuOpen(false)
												setShowPasswordModal(true)
											}}
											className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
											style={{ color: 'var(--text-secondary)' }}
										>
											<Lock className="w-4 h-4" strokeWidth={1.5} />
											Change Password
										</button>
										<button
											onClick={() => {
												setUserMenuOpen(false)
												handleLogout()
											}}
											className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
											style={{ color: 'var(--error)' }}
										>
											<LogOut className="w-4 h-4" strokeWidth={1.5} />
											Logout
										</button>
									</div>
								</>
							)}
						</div>
					)}
				</div>
			</header>

			<main className="max-w-6xl mx-auto p-6">
				{tab === 'tools' ? (
					activeTool ? (
						<>
							<button
								onClick={() => setActiveTool(null)}
								className="flex items-center gap-2 mb-6 text-sm hover:underline"
								style={{ color: 'var(--text-muted)' }}
							>
								<ChevronLeft className="w-4 h-4" strokeWidth={2} />
								Back to Tools
							</button>
							{activeTool === 'indexers' && <SearchPanel />}
							{activeTool === 'files' && <FileBrowser />}
							{activeTool === 'orphans' && <OrphanManager instances={instances} />}
							{activeTool === 'rss' && <RSSManager instances={instances} />}
							{activeTool === 'logs' && <LogViewer instances={instances} />}
							{activeTool === 'cross-seed' && <CrossSeedManager instances={instances} />}
						</>
					) : (
						<>
							<h1 className="text-xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
								Tools
							</h1>
							<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
								<button
									onClick={() => setActiveTool('indexers')}
									className="p-6 rounded-xl border text-left transition-all hover:border-[var(--accent)]"
									style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
								>
									<Search className="w-8 h-8 mb-3" style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
									<div className="font-medium" style={{ color: 'var(--text-primary)' }}>
										Prowlarr
									</div>
									<div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
										Search indexers
									</div>
								</button>
								{filesEnabled && (
									<button
										onClick={() => setActiveTool('files')}
										className="p-6 rounded-xl border text-left transition-all hover:border-[var(--accent)]"
										style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
									>
										<FolderOpen className="w-8 h-8 mb-3" style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
										<div className="font-medium" style={{ color: 'var(--text-primary)' }}>
											File Browser
										</div>
										<div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
											Browse downloads
										</div>
									</button>
								)}
								<button
									onClick={() => setActiveTool('orphans')}
									className="p-6 rounded-xl border text-left transition-all hover:border-[var(--accent)]"
									style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
								>
									<Trash2 className="w-8 h-8 mb-3" style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
									<div className="font-medium" style={{ color: 'var(--text-primary)' }}>
										Orphan Manager
									</div>
									<div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
										Clean up torrents
									</div>
								</button>
								<button
									onClick={() => setActiveTool('rss')}
									className="p-6 rounded-xl border text-left transition-all hover:border-[var(--accent)]"
									style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
								>
									<Rss className="w-8 h-8 mb-3" style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
									<div className="font-medium" style={{ color: 'var(--text-primary)' }}>
										RSS Manager
									</div>
									<div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
										Feeds & auto-download
									</div>
								</button>
								<button
									onClick={() => setActiveTool('logs')}
									className="p-6 rounded-xl border text-left transition-all hover:border-[var(--accent)]"
									style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
								>
									<FileText className="w-8 h-8 mb-3" style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
									<div className="font-medium" style={{ color: 'var(--text-primary)' }}>
										Log Viewer
									</div>
									<div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
										Application logs
									</div>
								</button>
								<button
									onClick={() => setActiveTool('cross-seed')}
									className="p-6 rounded-xl border text-left transition-all hover:border-[var(--accent)] relative"
									style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
								>
									<span className="absolute top-3 right-3 cursor-help" title="Experimental feature">
										<AlertTriangle className="w-6 h-6" style={{ color: 'var(--error)' }} />
									</span>
									<ArrowLeftRight className="w-8 h-8 mb-3" style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
									<div className="font-medium" style={{ color: 'var(--text-primary)' }}>
										Cross-Seed
									</div>
									<div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
										Find matching torrents
									</div>
								</button>
							</div>
						</>
					)
				) : (
					<>
						{stats.length > 0 && !showingPanel && (
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
								{[
									{ label: 'Total', value: stats.reduce((a, s) => a + s.total, 0), color: 'var(--text-primary)' },
									{ label: 'Leeching', value: stats.reduce((a, s) => a + s.downloading, 0), color: 'var(--accent)' },
									{ label: 'Seeding', value: stats.reduce((a, s) => a + s.seeding, 0), color: '#a6e3a1' },
									{ label: 'Stopped', value: stats.reduce((a, s) => a + s.paused, 0), color: 'var(--text-muted)' },
								].map((item) => (
									<div
										key={item.label}
										className="p-4 rounded-xl border"
										style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
									>
										<div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
											{item.label}
										</div>
										<div className="text-2xl font-semibold" style={{ color: item.color }}>
											{item.value}
										</div>
									</div>
								))}
							</div>
						)}

						{stats.length > 0 && !showingPanel && (
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
								<div
									className="p-4 rounded-xl border flex items-center justify-between"
									style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
								>
									<div className="flex items-center gap-3">
										<ArrowDown className="w-5 h-5" style={{ color: 'var(--accent)' }} strokeWidth={2} />
										<div>
											<div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
												Download
											</div>
											<div className="text-lg font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>
												{formatSpeed(stats.reduce((a, s) => a + s.dlSpeed, 0))}
											</div>
										</div>
									</div>
									<SpeedGraph history={dlHistory} color="var(--accent)" />
								</div>
								<div
									className="p-4 rounded-xl border flex items-center justify-between"
									style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
								>
									<div className="flex items-center gap-3">
										<ArrowUp className="w-5 h-5" style={{ color: '#a6e3a1' }} strokeWidth={2} />
										<div>
											<div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
												Upload
											</div>
											<div className="text-lg font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>
												{formatSpeed(stats.reduce((a, s) => a + s.upSpeed, 0))}
											</div>
										</div>
									</div>
									<SpeedGraph history={upHistory} color="#a6e3a1" />
								</div>
								<div
									className="p-4 rounded-xl border"
									style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
								>
									<div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
										All-Time Down
									</div>
									<div className="text-lg font-medium tabular-nums" style={{ color: 'var(--accent)' }}>
										{formatSize(stats.reduce((a, s) => a + s.allTimeDownload, 0))}
									</div>
								</div>
								<div
									className="p-4 rounded-xl border"
									style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
								>
									<div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
										All-Time Up
									</div>
									<div className="text-lg font-medium tabular-nums" style={{ color: '#a6e3a1' }}>
										{formatSize(stats.reduce((a, s) => a + s.allTimeUpload, 0))}
									</div>
								</div>
							</div>
						)}

						<div className="flex items-center justify-between mb-6">
							<h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
								Instances
							</h1>
							{!showingPanel && (
								<button
									onClick={() => {
										setShowForm(true)
										setEditingId(null)
										setFormData({ label: '', url: '', qbt_username: '', qbt_password: '', skip_auth: false })
									}}
									className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
									style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
								>
									Add Instance
								</button>
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

						{showForm && (
							<div
								className="mb-6 p-6 rounded-xl border"
								style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
							>
								<h2 className="text-lg font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
									{editingId ? 'Edit Instance' : 'Add Instance'}
								</h2>
								<form onSubmit={handleSubmit} className="space-y-4">
									<div className="grid grid-cols-2 gap-4">
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
												className="w-full px-4 py-2.5 rounded-lg border text-sm"
												style={{
													backgroundColor: 'var(--bg-tertiary)',
													borderColor: 'var(--border)',
													color: 'var(--text-primary)',
												}}
												placeholder="Home Server"
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
												className="w-full px-4 py-2.5 rounded-lg border text-sm"
												style={{
													backgroundColor: 'var(--bg-tertiary)',
													borderColor: 'var(--border)',
													color: 'var(--text-primary)',
												}}
												placeholder="http://192.168.1.100:8080"
												required
											/>
										</div>
										<div>
											<label
												className="block text-xs font-medium mb-2 uppercase tracking-wider"
												style={{ color: 'var(--text-muted)' }}
											>
												qBittorrent Username
											</label>
											<input
												type="text"
												value={formData.qbt_username}
												onChange={(e) => setFormData({ ...formData, qbt_username: e.target.value })}
												className="w-full px-4 py-2.5 rounded-lg border text-sm"
												style={{
													backgroundColor: 'var(--bg-tertiary)',
													borderColor: 'var(--border)',
													color: 'var(--text-primary)',
													opacity: formData.skip_auth ? 0.5 : 1,
												}}
												placeholder="admin"
												required={!formData.skip_auth}
												disabled={formData.skip_auth}
											/>
										</div>
										<div>
											<label
												className="block text-xs font-medium mb-2 uppercase tracking-wider"
												style={{ color: 'var(--text-muted)' }}
											>
												qBittorrent Password
											</label>
											<input
												type="password"
												value={formData.qbt_password}
												onChange={(e) => setFormData({ ...formData, qbt_password: e.target.value })}
												className="w-full px-4 py-2.5 rounded-lg border text-sm"
												style={{
													backgroundColor: 'var(--bg-tertiary)',
													borderColor: 'var(--border)',
													color: 'var(--text-primary)',
													opacity: formData.skip_auth ? 0.5 : 1,
												}}
												placeholder={editingId ? '••••••••  (unchanged)' : '••••••••'}
												required={!formData.skip_auth && !editingId}
												disabled={formData.skip_auth}
											/>
										</div>
									</div>

									<Checkbox
										checked={formData.skip_auth ?? false}
										onChange={(v) => setFormData({ ...formData, skip_auth: v })}
										label="Skip authentication (enable if qBittorrent has IP bypass enabled)"
									/>

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
											{submitting ? 'Saving...' : editingId ? 'Update' : 'Add'}
										</button>
										<button
											type="button"
											onClick={testConnection}
											disabled={
												testing ||
												!formData.url ||
												(!formData.skip_auth && (!formData.qbt_username || (!editingId && !formData.qbt_password)))
											}
											className="px-4 py-2 rounded-lg text-sm border disabled:opacity-50"
											style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
										>
											{testing
												? 'Testing...'
												: editingId && !formData.qbt_password && !formData.skip_auth
													? 'Test Saved'
													: 'Test Connection'}
										</button>
										<button
											type="button"
											onClick={closeForm}
											className="px-4 py-2 rounded-lg text-sm border"
											style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
										>
											Cancel
										</button>
									</div>
								</form>
							</div>
						)}

						{settingsInstance && (
							<SettingsPanel instance={settingsInstance} onClose={() => setSettingsInstance(null)} />
						)}

						{displayInstances.length === 0 && !showingPanel ? (
							<div
								className="text-center py-12 rounded-xl border"
								style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
							>
								<p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
									No instances configured
								</p>
								<p className="text-xs" style={{ color: 'var(--text-muted)' }}>
									Add your first qBittorrent instance to get started
								</p>
							</div>
						) : (
							displayInstances.length > 0 && (
								<div className="grid gap-4">
									{displayInstances.map((instance) => {
										const instanceStats = stats.find((s) => s.id === instance.id)
										return (
											<div
												key={instance.id}
												className="p-4 rounded-xl border group cursor-pointer transition-colors hover:border-[var(--accent)]"
												style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
												onClick={() => onSelectInstance(instance)}
											>
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-4">
														<div
															className="w-10 h-10 rounded-lg flex items-center justify-center relative"
															style={{ backgroundColor: 'var(--bg-tertiary)' }}
														>
															<Server className="w-5 h-5" style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
															{instanceStats && (
																<div
																	className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2"
																	style={{
																		backgroundColor: instanceStats.online ? '#a6e3a1' : 'var(--error)',
																		borderColor: 'var(--bg-secondary)',
																	}}
																/>
															)}
														</div>
														<div>
															<span className="font-medium" style={{ color: 'var(--text-primary)' }}>
																{instance.label}
															</span>
															<div className="text-sm" style={{ color: 'var(--text-muted)' }}>
																{instance.url}
															</div>
														</div>
													</div>
													<div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
														<button
															onClick={(e) => {
																e.stopPropagation()
																setSettingsInstance(instance)
															}}
															className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
															style={{ color: 'var(--text-muted)' }}
															title="Settings"
														>
															<Settings className="w-4 h-4" strokeWidth={1.5} />
														</button>
														<button
															onClick={(e) => {
																e.stopPropagation()
																openEdit(instance)
															}}
															className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
															style={{ color: 'var(--text-muted)' }}
														>
															<Pencil className="w-4 h-4" strokeWidth={1.5} />
														</button>
														<button
															onClick={(e) => {
																e.stopPropagation()
																setDeleteConfirm(instance)
															}}
															className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
															style={{ color: 'var(--error)' }}
														>
															<Trash2 className="w-4 h-4" strokeWidth={1.5} />
														</button>
													</div>
												</div>
												{instanceStats?.online && (
													<div
														className="mt-3 pt-3 border-t grid grid-cols-3 items-center text-xs"
														style={{ borderColor: 'var(--border)' }}
													>
														<div className="flex items-center gap-4">
															<span style={{ color: 'var(--text-muted)' }}>
																<span style={{ color: 'var(--text-secondary)' }}>{instanceStats.total}</span> torrents
															</span>
															<span style={{ color: 'var(--text-muted)' }}>
																<span style={{ color: 'var(--accent)' }}>{instanceStats.downloading}</span> leech
															</span>
															<span style={{ color: 'var(--text-muted)' }}>
																<span style={{ color: '#a6e3a1' }}>{instanceStats.seeding}</span> seed
															</span>
														</div>
														<span className="text-center" style={{ color: 'var(--text-muted)' }}>
															Free space: {formatSize(instanceStats.freeSpaceOnDisk)}
														</span>
														<div className="flex items-center gap-3 justify-end">
															<span style={{ color: 'var(--accent)' }}>↓ {formatSpeed(instanceStats.dlSpeed)}</span>
															<span style={{ color: '#a6e3a1' }}>↑ {formatSpeed(instanceStats.upSpeed)}</span>
														</div>
													</div>
												)}
											</div>
										)
									})}
								</div>
							)
						)}
					</>
				)}
			</main>

			{deleteConfirm && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center p-4"
					style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
				>
					<div
						className="w-full max-w-sm rounded-xl border p-6"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
							Delete Instance
						</h3>
						<p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
							Are you sure you want to delete{' '}
							<strong style={{ color: 'var(--text-primary)' }}>{deleteConfirm.label}</strong>? This action cannot be
							undone.
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
								onClick={handleDelete}
								className="px-4 py-2 rounded-lg text-sm font-medium"
								style={{ backgroundColor: 'var(--error)', color: 'white' }}
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}

			{showPasswordModal && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center p-4"
					style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
				>
					<div
						className="w-full max-w-sm rounded-xl border p-6"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
							Change Password
						</h3>
						<form onSubmit={handlePasswordChange} className="space-y-4">
							<div>
								<label
									className="block text-xs font-medium mb-2 uppercase tracking-wider"
									style={{ color: 'var(--text-muted)' }}
								>
									Current Password
								</label>
								<input
									type="password"
									value={passwordData.current}
									onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
									className="w-full px-4 py-2.5 rounded-lg border text-sm"
									style={{
										backgroundColor: 'var(--bg-tertiary)',
										borderColor: 'var(--border)',
										color: 'var(--text-primary)',
									}}
									required
								/>
							</div>
							<div>
								<label
									className="block text-xs font-medium mb-2 uppercase tracking-wider"
									style={{ color: 'var(--text-muted)' }}
								>
									New Password
								</label>
								<input
									type="password"
									value={passwordData.new}
									onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
									className="w-full px-4 py-2.5 rounded-lg border text-sm"
									style={{
										backgroundColor: 'var(--bg-tertiary)',
										borderColor: 'var(--border)',
										color: 'var(--text-primary)',
									}}
									required
								/>
							</div>
							<div>
								<label
									className="block text-xs font-medium mb-2 uppercase tracking-wider"
									style={{ color: 'var(--text-muted)' }}
								>
									Confirm New Password
								</label>
								<input
									type="password"
									value={passwordData.confirm}
									onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
									className="w-full px-4 py-2.5 rounded-lg border text-sm"
									style={{
										backgroundColor: 'var(--bg-tertiary)',
										borderColor: 'var(--border)',
										color: 'var(--text-primary)',
									}}
									required
								/>
							</div>
							{passwordError && (
								<div
									className="px-4 py-3 rounded-lg text-sm"
									style={{
										backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)',
										color: 'var(--error)',
									}}
								>
									{passwordError}
								</div>
							)}
							<div className="flex gap-3 justify-end pt-2">
								<button
									type="button"
									onClick={() => {
										setShowPasswordModal(false)
										setPasswordData({ current: '', new: '', confirm: '' })
										setPasswordError('')
									}}
									className="px-4 py-2 rounded-lg text-sm border"
									style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={changingPassword}
									className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
									style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
								>
									{changingPassword ? 'Changing...' : 'Change Password'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	)
}
