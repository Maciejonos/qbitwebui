import { useState, useEffect, type ReactNode } from 'react'
import { Settings, X } from 'lucide-react'
import type { Instance } from '../api/instances'
import type { QBittorrentPreferences } from '../types/preferences'
import { getPreferences, setPreferences } from '../api/qbittorrent'
import { BehaviorTab } from './settings/BehaviorTab'
import { DownloadsTab } from './settings/DownloadsTab'
import { ConnectionTab } from './settings/ConnectionTab'
import { SpeedTab } from './settings/SpeedTab'
import { BitTorrentTab } from './settings/BitTorrentTab'
import { RSSTab } from './settings/RSSTab'
import { WebUITab } from './settings/WebUITab'
import { AdvancedTab } from './settings/AdvancedTab'

type SettingsTab = 'behavior' | 'downloads' | 'connection' | 'speed' | 'bittorrent' | 'rss' | 'webui' | 'advanced'

const TABS: { id: SettingsTab; label: string; icon: ReactNode }[] = [
	{
		id: 'behavior',
		label: 'Behavior',
		icon: (
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
			/>
		),
	},
	{
		id: 'downloads',
		label: 'Downloads',
		icon: (
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
			/>
		),
	},
	{
		id: 'connection',
		label: 'Connection',
		icon: (
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"
			/>
		),
	},
	{
		id: 'speed',
		label: 'Speed',
		icon: (
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
			/>
		),
	},
	{
		id: 'bittorrent',
		label: 'BitTorrent',
		icon: (
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
			/>
		),
	},
	{
		id: 'rss',
		label: 'RSS',
		icon: (
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M12.75 19.5v-.75a7.5 7.5 0 0 0-7.5-7.5H4.5m0-6.75h.75c7.87 0 14.25 6.38 14.25 14.25v.75M6 18.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
			/>
		),
	},
	{
		id: 'webui',
		label: 'WebUI',
		icon: (
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25"
			/>
		),
	},
	{
		id: 'advanced',
		label: 'Advanced',
		icon: (
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"
			/>
		),
	},
]

interface Props {
	instance: Instance
	onClose: () => void
}

export function SettingsPanel({ instance, onClose }: Props) {
	const [activeTab, setActiveTab] = useState<SettingsTab>('behavior')
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [preferences, setPreferencesState] = useState<Partial<QBittorrentPreferences>>({})
	const [originalPreferences, setOriginalPreferences] = useState<Partial<QBittorrentPreferences>>({})

	useEffect(() => {
		async function load() {
			setLoading(true)
			setError(null)
			try {
				const prefs = await getPreferences(instance.id)
				setPreferencesState(prefs)
				setOriginalPreferences(prefs)
			} catch {
				setError('Failed to load preferences')
			} finally {
				setLoading(false)
			}
		}
		load()
	}, [instance.id])

	function handleChange(updates: Partial<QBittorrentPreferences>) {
		setPreferencesState((prev) => ({ ...prev, ...updates }))
	}

	async function handleSave() {
		setSaving(true)
		setError(null)
		try {
			const changed: Partial<QBittorrentPreferences> = {}
			for (const key of Object.keys(preferences) as (keyof QBittorrentPreferences)[]) {
				if (preferences[key] !== originalPreferences[key]) {
					;(changed as Record<string, unknown>)[key] = preferences[key]
				}
			}
			if (Object.keys(changed).length > 0) {
				await setPreferences(instance.id, changed)
				setOriginalPreferences(preferences)
			}
			onClose()
		} catch {
			setError('Failed to save preferences')
		} finally {
			setSaving(false)
		}
	}

	function handleClose() {
		if (hasChanges && !confirm('You have unsaved changes. Discard them?')) return
		onClose()
	}

	const hasChanges = JSON.stringify(preferences) !== JSON.stringify(originalPreferences)

	return (
		<div
			className="mb-4 rounded-lg border overflow-hidden"
			style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
		>
			<div
				className="flex items-center justify-between px-4 py-3 border-b"
				style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-tertiary)' }}
			>
				<div className="flex items-center gap-3">
					<Settings className="w-4 h-4" style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
					<span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
						Settings
					</span>
					<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
						— {instance.label}
					</span>
				</div>
				<div className="flex items-center gap-2">
					{hasChanges && (
						<span
							className="text-[10px] px-1.5 py-0.5 rounded"
							style={{
								backgroundColor: 'color-mix(in srgb, var(--warning) 20%, transparent)',
								color: 'var(--warning)',
							}}
						>
							unsaved
						</span>
					)}
					<button
						type="button"
						onClick={handleClose}
						className="p-1 rounded hover:bg-[var(--bg-primary)]"
						style={{ color: 'var(--text-muted)' }}
					>
						<X className="w-4 h-4" strokeWidth={2} />
					</button>
				</div>
			</div>

			<div
				className="flex border-b overflow-x-auto"
				style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
			>
				{TABS.map((tab) => (
					<button
						type="button"
						key={tab.id}
						onClick={() => setActiveTab(tab.id)}
						className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors"
						style={{
							borderColor: activeTab === tab.id ? 'var(--accent)' : 'transparent',
							color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
							backgroundColor: activeTab === tab.id ? 'var(--bg-secondary)' : 'transparent',
						}}
					>
						<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
							{tab.icon}
						</svg>
						<span className="hidden sm:inline">{tab.label}</span>
					</button>
				))}
			</div>

			{loading ? (
				<div className="flex items-center justify-center py-12">
					<div
						className="w-5 h-5 border-2 rounded-full animate-spin"
						style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
					/>
				</div>
			) : error && !Object.keys(preferences).length ? (
				<div className="flex items-center justify-center py-12 text-xs" style={{ color: 'var(--error)' }}>
					{error}
				</div>
			) : (
				<>
					<div className="p-4 max-h-[60vh] overflow-y-auto">
						{activeTab === 'behavior' && <BehaviorTab preferences={preferences} onChange={handleChange} />}
						{activeTab === 'downloads' && <DownloadsTab preferences={preferences} onChange={handleChange} />}
						{activeTab === 'connection' && <ConnectionTab preferences={preferences} onChange={handleChange} />}
						{activeTab === 'speed' && <SpeedTab preferences={preferences} onChange={handleChange} />}
						{activeTab === 'bittorrent' && <BitTorrentTab preferences={preferences} onChange={handleChange} />}
						{activeTab === 'rss' && <RSSTab preferences={preferences} onChange={handleChange} />}
						{activeTab === 'webui' && <WebUITab preferences={preferences} onChange={handleChange} />}
						{activeTab === 'advanced' && <AdvancedTab preferences={preferences} onChange={handleChange} />}
					</div>

					<div
						className="flex items-center gap-2 px-4 py-3 border-t"
						style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-tertiary)' }}
					>
						{error && (
							<span className="text-xs mr-auto" style={{ color: 'var(--error)' }}>
								{error}
							</span>
						)}
						<button
							type="button"
							onClick={handleSave}
							disabled={saving || !hasChanges}
							className="px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50 transition-colors"
							style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
						>
							{saving ? 'Saving...' : 'Save'}
						</button>
						<button
							type="button"
							onClick={handleClose}
							className="px-3 py-1.5 rounded text-xs border transition-colors hover:bg-[var(--bg-primary)]"
							style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
						>
							Cancel
						</button>
					</div>
				</>
			)}
		</div>
	)
}
