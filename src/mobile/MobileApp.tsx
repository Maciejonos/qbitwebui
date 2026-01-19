import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
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
						<svg
							className="w-5 h-5 animate-pulse"
							style={{ color: 'var(--accent-contrast)' }}
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2.5}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
							/>
						</svg>
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
					<svg
						className="w-8 h-8"
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
									<svg
										className="w-5 h-5"
										style={{ color: altSpeed.enabled ? 'var(--accent)' : 'var(--text-muted)' }}
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={2}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
										/>
									</svg>
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
								<svg
									className="w-4 h-4 flex-shrink-0"
									style={{ color: searchFocused ? 'var(--accent)' : 'var(--text-muted)' }}
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
									/>
								</svg>
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
										<svg
											className="w-4 h-4"
											style={{ color: 'var(--text-muted)' }}
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											strokeWidth={2}
										>
											<path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
										</svg>
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
							<svg
								className="w-6 h-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={mainTab === 'torrents' ? 2 : 1.5}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
								/>
							</svg>
							<span className="text-xs font-medium">Torrents</span>
						</button>
						<button
							onClick={() => setShowAddModal(true)}
							className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors active:scale-95"
							style={{ color: 'var(--text-muted)' }}
						>
							<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
							</svg>
							<span className="text-xs font-medium">Add</span>
						</button>
						<button
							onClick={() => setMainTab('tools')}
							className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors"
							style={{ color: mainTab === 'tools' ? 'var(--accent)' : 'var(--text-muted)' }}
						>
							<svg
								className="w-6 h-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={mainTab === 'tools' ? 2 : 1.5}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
								/>
							</svg>
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
