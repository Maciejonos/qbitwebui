import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './contexts/ThemeProvider'
import { InstanceProvider } from './contexts/InstanceContext'
import { PaginationProvider } from './contexts/PaginationContext'
import { Layout } from './components/Layout'
import { AuthForm } from './components/AuthForm'
import { InstanceManager } from './components/InstanceManager'
import { TorrentList } from './components/TorrentList'
import { getMe, type User } from './api/auth'
import { getInstances, type Instance } from './api/instances'

const MobileApp = lazy(() => import('./mobile/MobileApp').then((m) => ({ default: m.MobileApp })))

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 1,
			staleTime: 1000,
		},
	},
})

const isMobile = () => window.innerWidth < 768

type View = 'loading' | 'auth' | 'instances' | 'torrents' | 'mobile'
type Tab = 'dashboard' | 'tools'
type Tool = 'indexers' | 'files' | 'orphans' | 'rss' | 'logs' | 'cross-seed' | 'statistics' | 'network' | null

function parseHash(): { tab: Tab; instanceId: number | null; tool: Tool } {
	const hash = window.location.hash.slice(1)
	if (hash === 'tools') return { tab: 'tools', instanceId: null, tool: null }
	if (hash.startsWith('tools/')) {
		const toolName = hash.slice(6) as Tool
		const validTools: Tool[] = ['indexers', 'files', 'orphans', 'rss', 'logs', 'cross-seed', 'statistics', 'network']
		if (validTools.includes(toolName)) {
			return { tab: 'tools', instanceId: null, tool: toolName }
		}
		return { tab: 'tools', instanceId: null, tool: null }
	}
	if (hash.startsWith('instance/')) {
		const id = parseInt(hash.slice(9), 10)
		if (!isNaN(id)) return { tab: 'dashboard', instanceId: id, tool: null }
	}
	return { tab: 'dashboard', instanceId: null, tool: null }
}

function setHash(tab: Tab, instanceId: number | null, tool?: Tool) {
	if (instanceId) {
		window.location.hash = `instance/${instanceId}`
	} else if (tab === 'tools') {
		window.location.hash = tool ? `tools/${tool}` : 'tools'
	} else {
		window.location.hash = ''
	}
}

export default function App() {
	const [view, setView] = useState<View>('loading')
	const [user, setUser] = useState<User | null>(null)
	const [currentInstance, setCurrentInstance] = useState<Instance | null>(null)
	const [authDisabled, setAuthDisabled] = useState(false)
	const [initialTab, setInitialTab] = useState<Tab>('dashboard')
	const [initialTool, setInitialTool] = useState<Tool>(null)

	const applyRoute = useCallback(async (authenticated: boolean) => {
		if (!authenticated) return
		const { tab, instanceId, tool } = parseHash()
		setInitialTab(tab)
		setInitialTool(tool)
		if (instanceId) {
			const instances = await getInstances().catch(() => [])
			const instance = instances.find((i) => i.id === instanceId)
			if (instance) {
				setCurrentInstance(instance)
				setView('torrents')
				return
			}
		}
		const autoSelect = localStorage.getItem('autoSelectSingleInstance') === 'true'
		if (autoSelect) {
			const instances = await getInstances().catch(() => [])
			if (instances.length === 1) {
				setCurrentInstance(instances[0])
				setView('torrents')
				setHash('dashboard', instances[0].id)
				return
			}
		}
		setCurrentInstance(null)
		setView(isMobile() ? 'mobile' : 'instances')
	}, [])

	useEffect(() => {
		fetch('/api/config')
			.then((r) => r.json())
			.then(({ authDisabled }) => {
				if (authDisabled) {
					setAuthDisabled(true)
					setUser({ id: 1, username: 'guest' })
					applyRoute(true)
					return
				}
				getMe()
					.then((u) => {
						if (u) {
							setUser(u)
							applyRoute(true)
						} else {
							setView('auth')
						}
					})
					.catch(() => setView('auth'))
			})
			.catch(() => setView('auth'))
	}, [applyRoute])

	useEffect(() => {
		function handleHashChange() {
			const { tab, instanceId, tool } = parseHash()
			setInitialTab(tab)
			setInitialTool(tool)
			if (instanceId && currentInstance?.id !== instanceId) {
				getInstances()
					.then((instances) => {
						const instance = instances.find((i) => i.id === instanceId)
						if (instance) {
							setCurrentInstance(instance)
							setView('torrents')
						} else {
							setCurrentInstance(null)
							setView('instances')
						}
					})
					.catch(() => {
						setCurrentInstance(null)
						setView('instances')
					})
			} else if (!instanceId && currentInstance !== null) {
				setCurrentInstance(null)
				setView(isMobile() ? 'mobile' : 'instances')
			}
		}
		window.addEventListener('hashchange', handleHashChange)
		return () => window.removeEventListener('hashchange', handleHashChange)
	}, [currentInstance])

	function selectInstance(instance: Instance) {
		setCurrentInstance(instance)
		setInitialTab('dashboard')
		setView('torrents')
		setHash('dashboard', instance.id)
	}

	function goToTab(tab: Tab) {
		setCurrentInstance(null)
		setInitialTab(tab)
		setInitialTool(null)
		setView('instances')
		setHash(tab, null)
	}

	function handleTabChange(tab: Tab) {
		setInitialTab(tab)
		setInitialTool(null)
		setHash(tab, null)
	}

	function handleToolChange(tool: Tool) {
		setInitialTool(tool)
		setHash('tools', null, tool)
	}

	if (view === 'loading') {
		return (
			<ThemeProvider>
				<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
					<div className="text-sm" style={{ color: 'var(--text-muted)' }}>
						Loading...
					</div>
				</div>
			</ThemeProvider>
		)
	}

	if (view === 'auth') {
		return (
			<ThemeProvider>
				<AuthForm
					onSuccess={(u) => {
						setUser(u)
						setView(isMobile() ? 'mobile' : 'instances')
					}}
				/>
			</ThemeProvider>
		)
	}

	if (view === 'mobile') {
		return (
			<ThemeProvider>
				<Suspense
					fallback={
						<div
							className="min-h-screen flex items-center justify-center"
							style={{ backgroundColor: 'var(--bg-primary)' }}
						>
							<div className="text-sm" style={{ color: 'var(--text-muted)' }}>
								Loading...
							</div>
						</div>
					}
				>
					<MobileApp
						username={user?.username || ''}
						onLogout={() => {
							setUser(null)
							setView('auth')
						}}
						authDisabled={authDisabled}
					/>
				</Suspense>
			</ThemeProvider>
		)
	}

	if (view === 'instances' || !currentInstance) {
		return (
			<ThemeProvider>
				<QueryClientProvider client={queryClient}>
					<InstanceManager
						username={user?.username || ''}
						onSelectInstance={selectInstance}
						onLogout={() => {
							setUser(null)
							setCurrentInstance(null)
							setView('auth')
						}}
						authDisabled={authDisabled}
						initialTab={initialTab}
						initialTool={initialTool}
						onTabChange={handleTabChange}
						onToolChange={handleToolChange}
					/>
				</QueryClientProvider>
			</ThemeProvider>
		)
	}

	return (
		<ThemeProvider>
			<QueryClientProvider client={queryClient}>
				<InstanceProvider instance={currentInstance}>
					<PaginationProvider>
						<Layout
							onTabChange={goToTab}
							username={user?.username}
							authDisabled={authDisabled}
							onLogout={() => {
								setUser(null)
								setCurrentInstance(null)
								setView('auth')
							}}
						>
							<TorrentList />
						</Layout>
					</PaginationProvider>
				</InstanceProvider>
			</QueryClientProvider>
		</ThemeProvider>
	)
}
