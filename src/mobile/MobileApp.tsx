import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { Download, Plus, Wrench, Zap, User, LogOut, Search, X, Server } from 'lucide-react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { getInstances, type Instance } from '../api/instances'
import { logout } from '../api/auth'
import { getSpeedLimitsMode, toggleSpeedLimitsMode } from '../api/qbittorrent'
import { MobileInstancePicker } from './MobileInstancePicker'
import { MobileStats } from './MobileStats'
import { MobileTorrentList } from './MobileTorrentList'
import { MobileThemeSwitcher } from './MobileThemeSwitcher'
import { InstanceProvider } from '../contexts/InstanceContext'

const MobileTorrentDetail = lazy(() =>
	import('./MobileTorrentDetail').then((m) => ({ default: m.MobileTorrentDetail }))
)
const MobileTools = lazy(() => import('./MobileTools').then((m) => ({ default: m.MobileTools })))
const AddTorrentModal = lazy(() =>
	import('../components/AddTorrentModal').then((m) => ({ default: m.AddTorrentModal }))
)

type MainTab = 'torrents' | 'tools'

function useAltSpeedMode(instanceId: number | null) {
	const [enabled, setEnabled] = useState(false)
	const [toggling, setToggling] = useState(false)

	useEffect(() => {
		if (instanceId === null) return
		let mounted = true
		const checkMode = async () => {
			const mode = await getSpeedLimitsMode(instanceId).catch(() => 0)
			if (mounted) setEnabled(mode === 1)
		}
		checkMode()
		const interval = setInterval(checkMode, 2000)
		return () => {
			mounted = false
			clearInterval(interval)
		}
	}, [instanceId])

	const toggle = useCallback(async () => {
		if (instanceId === null || toggling) return
		setToggling(true)
		const ok = await toggleSpeedLimitsMode(instanceId)
			.then(() => true)
			.catch(() => false)
		if (ok) setEnabled((prev) => !prev)
		setToggling(false)
	}, [instanceId, toggling])

	return { enabled, toggling, toggle }
}

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 1,
			staleTime: 1000,
		},
	},
})

interface Props {
	username: string
	onLogout: () => void
	authDisabled?: boolean
}

export function MobileApp({ username, onLogout, authDisabled }: Props) {
	const [instances, setInstances] = useState<Instance[]>([])
	const [selectedInstance, setSelectedInstance] = useState<Instance | 'all'>('all')
	const [loading, setLoading] = useState(true)
	const [selectedTorrentHash, setSelectedTorrentHash] = useState<string | null>(null)
	const [selectedTorrentInstanceId, setSelectedTorrentInstanceId] = useState<number | null>(null)
	const [showUserMenu, setShowUserMenu] = useState(false)
	const [search, setSearch] = useState('')
	const [searchFocused, setSearchFocused] = useState(false)
	const [mainTab, setMainTab] = useState<MainTab>('torrents')
	const [compactMode, setCompactMode] = useState(() => localStorage.getItem('mobileCompactMode') === 'true')
	const [showAddModal, setShowAddModal] = useState(false)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const effectiveInstance = selectedInstance !== 'all' ? selectedInstance : instances.length === 1 ? instances[0] : null
	const altSpeed = useAltSpeedMode(effectiveInstance?.id ?? null)

	const toggleCompactMode = useCallback(() => {
		setCompactMode((prev) => {
			const next = !prev
			localStorage.setItem('mobileCompactMode', String(next))
			return next
		})
	}, [])

	const loadInstances = useCallback(async () => {
		try {
			const data = await getInstances()
			setInstances(data)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		loadInstances()
	}, [loadInstances])

	async function handleLogout() {
		await logout()
		onLogout()
	}

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
				<div className="flex flex-col items-center gap-3">
					<div
						className="w-10 h-10 rounded-xl flex items-center justify-center"
						style={{
							background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, black))',
						}}
					>
						<Download className="w-5 h-5 animate-pulse" style={{ color: 'var(--accent-contrast)' }} strokeWidth={2.5} />
					</div>
					<span className="text-sm" style={{ color: 'var(--text-muted)' }}>
						Loading...
					</span>
				</div>
			</div>
		)
	}

	if (instances.length === 0) {
		return (
			<div
				className="min-h-screen flex flex-col items-center justify-center p-6"
				style={{ backgroundColor: 'var(--bg-primary)' }}
			>
				<div
					className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
					style={{ backgroundColor: 'var(--bg-secondary)' }}
				>
					<Server className="w-8 h-8" style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
				</div>
				<h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
					No Instances
				</h2>
				<p className="text-sm text-center mb-6" style={{ color: 'var(--text-muted)' }}>
					Add a qBittorrent instance using the desktop version to get started.
				</p>
				{!authDisabled && (
					<button
						onClick={handleLogout}
						className="px-6 py-3 rounded-xl text-sm font-medium"
						style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
					>
						Logout
					</button>
				)}
			</div>
		)
	}

	return (
		<QueryClientProvider client={queryClient}>
			<div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
				<header
					className="sticky top-0 z-40 border-b backdrop-blur-xl"
					style={{
						backgroundColor: 'color-mix(in srgb, var(--bg-primary) 85%, transparent)',
						borderColor: 'var(--border)',
					}}
				>
					<div className="flex items-center justify-between px-4 py-3">
						<div className="flex items-center gap-3">
							<img src="/logo.png" alt="qbitwebui" className="w-8 h-8" />
							{mainTab === 'torrents' && (
								<MobileInstancePicker instances={instances} current={selectedInstance} onChange={setSelectedInstance} />
							)}
							{mainTab === 'tools' && (
								<span className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
									Tools
								</span>
							)}
						</div>
						<div className="flex items-center gap-2">
							{effectiveInstance && (
								<button
									onClick={altSpeed.toggle}
									disabled={altSpeed.toggling}
									className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all"
									style={{
										backgroundColor: altSpeed.enabled
											? 'color-mix(in srgb, var(--accent) 20%, transparent)'
											: 'var(--bg-secondary)',
										opacity: altSpeed.toggling ? 0.5 : 1,
									}}
								>
									<Zap
										className="w-5 h-5"
										style={{ color: altSpeed.enabled ? 'var(--accent)' : 'var(--text-muted)' }}
										strokeWidth={2}
									/>
								</button>
							)}
							<MobileThemeSwitcher />
							{!authDisabled && (
								<div className="relative">
									<button
										onClick={() => setShowUserMenu(!showUserMenu)}
										className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
										style={{ backgroundColor: 'var(--bg-secondary)' }}
									>
										<User className="w-5 h-5" style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
									</button>
									{showUserMenu && (
										<>
											<div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
											<div
												className="absolute right-0 top-full mt-2 z-50 min-w-[160px] rounded-xl border shadow-xl overflow-hidden"
												style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
											>
												<div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
													<span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
														{username}
													</span>
												</div>
												<button
													onClick={() => {
														setShowUserMenu(false)
														handleLogout()
													}}
													className="w-full text-left px-4 py-3 text-sm active:bg-[var(--bg-tertiary)] flex items-center gap-3"
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
					</div>
					{mainTab === 'torrents' && (
						<div className="px-4 pb-3">
							<div
								className="flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all duration-200"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: searchFocused ? 'var(--accent)' : 'var(--border)',
								}}
							>
								<Search
									className="w-4 h-4 flex-shrink-0"
									style={{ color: searchFocused ? 'var(--accent)' : 'var(--text-muted)' }}
									strokeWidth={2}
								/>
								<input
									ref={searchInputRef}
									type="text"
									inputMode="search"
									enterKeyHint="search"
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									onFocus={() => setSearchFocused(true)}
									onBlur={() => setSearchFocused(false)}
									placeholder="Search torrents..."
									className="flex-1 bg-transparent outline-none"
									style={{ color: 'var(--text-primary)', fontSize: '16px' }}
								/>
								{search && (
									<button
										onMouseDown={(e) => e.preventDefault()}
										onClick={() => {
											setSearch('')
											searchInputRef.current?.focus()
										}}
										className="p-1 rounded-full active:scale-90 transition-transform"
										style={{ backgroundColor: 'var(--bg-tertiary)' }}
									>
										<X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} strokeWidth={2} />
									</button>
								)}
							</div>
						</div>
					)}
				</header>

				<main
					className="flex-1 overflow-y-auto"
					style={{ paddingBottom: 'calc(70px + env(safe-area-inset-bottom, 0px))' }}
				>
					{mainTab === 'torrents' && (
						<div className="p-4 space-y-4">
							<MobileStats instances={selectedInstance === 'all' ? instances : [selectedInstance]} />
							<MobileTorrentList
								instances={selectedInstance === 'all' ? instances : [selectedInstance]}
								search={search}
								compact={compactMode}
								onToggleCompact={toggleCompactMode}
								onSelectTorrent={(hash, instanceId) => {
									setSelectedTorrentHash(hash)
									setSelectedTorrentInstanceId(instanceId)
								}}
							/>
						</div>
					)}
					{mainTab === 'tools' && (
						<Suspense fallback={null}>
							<MobileTools instances={instances} />
						</Suspense>
					)}
				</main>

				<nav
					className="fixed bottom-0 left-0 right-0 z-30 border-t backdrop-blur-xl"
					style={{
						backgroundColor: 'color-mix(in srgb, var(--bg-primary) 90%, transparent)',
						borderColor: 'var(--border)',
						paddingBottom: 'env(safe-area-inset-bottom, 0px)',
					}}
				>
					<div className="flex">
						<button
							onClick={() => setMainTab('torrents')}
							className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors"
							style={{ color: mainTab === 'torrents' ? 'var(--accent)' : 'var(--text-muted)' }}
						>
							<Download className="w-6 h-6" strokeWidth={mainTab === 'torrents' ? 2 : 1.5} />
							<span className="text-xs font-medium">Torrents</span>
						</button>
						<button
							onClick={() => setShowAddModal(true)}
							className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors active:scale-95"
							style={{ color: 'var(--text-muted)' }}
						>
							<Plus className="w-6 h-6" strokeWidth={1.5} />
							<span className="text-xs font-medium">Add</span>
						</button>
						<button
							onClick={() => setMainTab('tools')}
							className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors"
							style={{ color: mainTab === 'tools' ? 'var(--accent)' : 'var(--text-muted)' }}
						>
							<Wrench className="w-6 h-6" strokeWidth={mainTab === 'tools' ? 2 : 1.5} />
							<span className="text-xs font-medium">Tools</span>
						</button>
					</div>
				</nav>

				{selectedTorrentHash && selectedTorrentInstanceId && (
					<Suspense fallback={null}>
						<MobileTorrentDetail
							torrentHash={selectedTorrentHash}
							instanceId={selectedTorrentInstanceId}
							onClose={() => {
								setSelectedTorrentHash(null)
								setSelectedTorrentInstanceId(null)
							}}
						/>
					</Suspense>
				)}

				{showAddModal && (
					<Suspense fallback={null}>
						<InstanceProvider instance={selectedInstance !== 'all' ? selectedInstance : instances[0]}>
							<AddTorrentModal open={showAddModal} onClose={() => setShowAddModal(false)} />
						</InstanceProvider>
					</Suspense>
				)}
			</div>
		</QueryClientProvider>
	)
}
