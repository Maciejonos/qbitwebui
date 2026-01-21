import { useState, useEffect, useCallback } from 'react'
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
	const { hasUpdate, latestVersion } = useUpdateCheck()

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
					<div
						className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono"
						style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
						title={hasUpdate ? `Update available: v${latestVersion}` : 'Up to date'}
					>
						v{__APP_VERSION__}
						{hasUpdate ? (
							<svg className="w-3.5 h-3.5" style={{ color: 'var(--warning)' }} fill="currentColor" viewBox="0 0 24 24">
								<path d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
							</svg>
						) : (
							<svg
								className="w-3.5 h-3.5"
								style={{ color: '#a6e3a1' }}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2.5}
							>
								<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						)}
					</div>
					{!authDisabled && (
						<div className="relative">
							<button
								onClick={() => setUserMenuOpen(!userMenuOpen)}
								className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]"
								style={{ backgroundColor: 'var(--bg-secondary)' }}
							>
								<svg
									className="w-5 h-5"
									style={{ color: 'var(--text-muted)' }}
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={1.5}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
									/>
								</svg>
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
											<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
												/>
											</svg>
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
											<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
												/>
											</svg>
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
								<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
								</svg>
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
									<svg
										className="w-8 h-8 mb-3"
										style={{ color: 'var(--accent)' }}
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={1.5}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
										/>
									</svg>
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
										<svg
											className="w-8 h-8 mb-3"
											style={{ color: 'var(--accent)' }}
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											strokeWidth={1.5}
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
											/>
										</svg>
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
									<svg
										className="w-8 h-8 mb-3"
										style={{ color: 'var(--accent)' }}
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={1.5}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
										/>
									</svg>
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
									<svg
										className="w-8 h-8 mb-3"
										style={{ color: 'var(--accent)' }}
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={1.5}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M12.75 19.5v-.75a7.5 7.5 0 0 0-7.5-7.5H4.5m0-6.75h.75c7.87 0 14.25 6.38 14.25 14.25v.75M6 18.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
										/>
									</svg>
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
									<svg
										className="w-8 h-8 mb-3"
										style={{ color: 'var(--accent)' }}
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={1.5}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
										/>
									</svg>
									<div className="font-medium" style={{ color: 'var(--text-primary)' }}>
										Log Viewer
									</div>
									<div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
										Application logs
									</div>
								</button>
								<button
									onClick={() => setActiveTool('cross-seed')}
									className="p-6 rounded-xl border text-left transition-all hover:border-[var(--accent)]"
									style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
								>
									<svg
										className="w-8 h-8 mb-3"
										style={{ color: 'var(--accent)' }}
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={1.5}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
										/>
									</svg>
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
										<svg
											className="w-5 h-5"
											style={{ color: 'var(--accent)' }}
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											strokeWidth={2}
										>
											<path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
										</svg>
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
										<svg
											className="w-5 h-5"
											style={{ color: '#a6e3a1' }}
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											strokeWidth={2}
										>
											<path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
										</svg>
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
															<svg
																className="w-5 h-5"
																style={{ color: 'var(--text-muted)' }}
																fill="none"
																viewBox="0 0 24 24"
																stroke="currentColor"
																strokeWidth={1.5}
															>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z"
																/>
															</svg>
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
															<svg
																className="w-4 h-4"
																fill="none"
																viewBox="0 0 24 24"
																stroke="currentColor"
																strokeWidth={1.5}
															>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
																/>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
																/>
															</svg>
														</button>
														<button
															onClick={(e) => {
																e.stopPropagation()
																openEdit(instance)
															}}
															className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
															style={{ color: 'var(--text-muted)' }}
														>
															<svg
																className="w-4 h-4"
																fill="none"
																viewBox="0 0 24 24"
																stroke="currentColor"
																strokeWidth={1.5}
															>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
																/>
															</svg>
														</button>
														<button
															onClick={(e) => {
																e.stopPropagation()
																setDeleteConfirm(instance)
															}}
															className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
															style={{ color: 'var(--error)' }}
														>
															<svg
																className="w-4 h-4"
																fill="none"
																viewBox="0 0 24 24"
																stroke="currentColor"
																strokeWidth={1.5}
															>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
																/>
															</svg>
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
