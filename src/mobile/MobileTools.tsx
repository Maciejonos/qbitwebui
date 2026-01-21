import { useState, useEffect, lazy, Suspense, type ReactNode } from 'react'
import { type Instance } from '../api/instances'

const MobileSearchPanel = lazy(() => import('./MobileSearchPanel').then((m) => ({ default: m.MobileSearchPanel })))
const MobileFileBrowser = lazy(() => import('./MobileFileBrowser').then((m) => ({ default: m.MobileFileBrowser })))
const MobileOrphanManager = lazy(() =>
	import('./MobileOrphanManager').then((m) => ({ default: m.MobileOrphanManager }))
)
const MobileRSSManager = lazy(() => import('./MobileRSSManager').then((m) => ({ default: m.MobileRSSManager })))
const MobileLogViewer = lazy(() => import('./MobileLogViewer').then((m) => ({ default: m.MobileLogViewer })))
const MobileCrossSeedManager = lazy(() =>
	import('./MobileCrossSeedManager').then((m) => ({ default: m.MobileCrossSeedManager }))
)

type Tool = 'search' | 'files' | 'orphans' | 'rss' | 'logs' | 'cross-seed' | null

const Spinner = (
	<div className="flex items-center justify-center p-8">
		<div
			className="w-6 h-6 border-2 rounded-full animate-spin"
			style={{ borderColor: 'color-mix(in srgb, var(--accent) 20%, transparent)', borderTopColor: 'var(--accent)' }}
		/>
	</div>
)

function LazyTool({ children }: { children: ReactNode }): ReactNode {
	return <Suspense fallback={Spinner}>{children}</Suspense>
}

interface Props {
	instances: Instance[]
}

export function MobileTools({ instances }: Props): ReactNode {
	const [activeTool, setActiveTool] = useState<Tool>(null)
	const [filesEnabled, setFilesEnabled] = useState(false)

	useEffect(() => {
		fetch('/api/config')
			.then((r) => r.json())
			.then((c) => setFilesEnabled(c.filesEnabled))
			.catch(() => {})
	}, [])

	const handleBack = () => setActiveTool(null)

	switch (activeTool) {
		case 'search':
			return (
				<LazyTool>
					<MobileSearchPanel instances={instances} onBack={handleBack} />
				</LazyTool>
			)
		case 'files':
			return (
				<LazyTool>
					<MobileFileBrowser onBack={handleBack} />
				</LazyTool>
			)
		case 'orphans':
			return (
				<LazyTool>
					<MobileOrphanManager instances={instances} onBack={handleBack} />
				</LazyTool>
			)
		case 'rss':
			return (
				<LazyTool>
					<MobileRSSManager instances={instances} onBack={handleBack} />
				</LazyTool>
			)
		case 'logs':
			return (
				<LazyTool>
					<MobileLogViewer instances={instances} onBack={handleBack} />
				</LazyTool>
			)
		case 'cross-seed':
			return (
				<LazyTool>
					<MobileCrossSeedManager instances={instances} onBack={handleBack} />
				</LazyTool>
			)
	}

	return (
		<div className="p-4 space-y-3">
			<button
				onClick={() => setActiveTool('search')}
				className="w-full p-4 rounded-2xl border text-left active:scale-[0.98] transition-transform"
				style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
			>
				<div className="flex items-start gap-4">
					<div
						className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
						style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}
					>
						<svg
							className="w-6 h-6"
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
					</div>
					<div className="flex-1 min-w-0">
						<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
							Prowlarr Search
						</h3>
						<p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
							Search indexers and grab releases
						</p>
					</div>
					<svg
						className="w-5 h-5 mt-1 shrink-0"
						style={{ color: 'var(--text-muted)' }}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
					</svg>
				</div>
			</button>

			{filesEnabled && (
				<button
					onClick={() => setActiveTool('files')}
					className="w-full p-4 rounded-2xl border text-left active:scale-[0.98] transition-transform"
					style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
				>
					<div className="flex items-start gap-4">
						<div
							className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
							style={{ backgroundColor: 'color-mix(in srgb, var(--warning) 15%, transparent)' }}
						>
							<svg
								className="w-6 h-6"
								style={{ color: 'var(--warning)' }}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={1.5}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
								/>
							</svg>
						</div>
						<div className="flex-1 min-w-0">
							<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
								File Browser
							</h3>
							<p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
								Browse, download, and manage files
							</p>
						</div>
						<svg
							className="w-5 h-5 mt-1 shrink-0"
							style={{ color: 'var(--text-muted)' }}
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
						>
							<path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
						</svg>
					</div>
				</button>
			)}

			<button
				onClick={() => setActiveTool('orphans')}
				className="w-full p-4 rounded-2xl border text-left active:scale-[0.98] transition-transform"
				style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
			>
				<div className="flex items-start gap-4">
					<div
						className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
						style={{ backgroundColor: 'color-mix(in srgb, var(--error) 15%, transparent)' }}
					>
						<svg
							className="w-6 h-6"
							style={{ color: 'var(--error)' }}
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={1.5}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
							/>
						</svg>
					</div>
					<div className="flex-1 min-w-0">
						<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
							Orphan Manager
						</h3>
						<p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
							Find torrents with missing files
						</p>
					</div>
					<svg
						className="w-5 h-5 mt-1 shrink-0"
						style={{ color: 'var(--text-muted)' }}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
					</svg>
				</div>
			</button>

			<button
				onClick={() => setActiveTool('rss')}
				className="w-full p-4 rounded-2xl border text-left active:scale-[0.98] transition-transform"
				style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
			>
				<div className="flex items-start gap-4">
					<div
						className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
						style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}
					>
						<svg
							className="w-6 h-6"
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
					</div>
					<div className="flex-1 min-w-0">
						<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
							RSS Manager
						</h3>
						<p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
							Manage feeds and auto-download rules
						</p>
					</div>
					<svg
						className="w-5 h-5 mt-1 shrink-0"
						style={{ color: 'var(--text-muted)' }}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
					</svg>
				</div>
			</button>

			<button
				onClick={() => setActiveTool('logs')}
				className="w-full p-4 rounded-2xl border text-left active:scale-[0.98] transition-transform"
				style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
			>
				<div className="flex items-start gap-4">
					<div
						className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
						style={{ backgroundColor: 'color-mix(in srgb, var(--text-muted) 15%, transparent)' }}
					>
						<svg
							className="w-6 h-6"
							style={{ color: 'var(--text-muted)' }}
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
					</div>
					<div className="flex-1 min-w-0">
						<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
							Log Viewer
						</h3>
						<p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
							View application and peer logs
						</p>
					</div>
					<svg
						className="w-5 h-5 mt-1 shrink-0"
						style={{ color: 'var(--text-muted)' }}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
					</svg>
				</div>
			</button>

			<button
				onClick={() => setActiveTool('cross-seed')}
				className="w-full p-4 rounded-2xl border text-left active:scale-[0.98] transition-transform"
				style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
			>
				<div className="flex items-start gap-4">
					<div
						className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
						style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}
					>
						<svg
							className="w-6 h-6"
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
					</div>
					<div className="flex-1 min-w-0">
						<h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
							Cross-Seed
						</h3>
						<p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
							Find matching torrents across trackers
						</p>
					</div>
					<svg
						className="w-5 h-5 mt-1 shrink-0"
						style={{ color: 'var(--text-muted)' }}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
					</svg>
				</div>
			</button>
		</div>
	)
}
