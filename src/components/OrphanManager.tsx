import { useState } from 'react'
import { type Instance } from '../api/instances'
import { deleteTorrents } from '../api/qbittorrent'
import { formatSize } from '../utils/format'

interface OrphanTorrent {
	instanceId: number
	instanceLabel: string
	hash: string
	name: string
	size: number
	reason: 'missingFiles' | 'unregistered'
	trackerMessage?: string
}

interface Props {
	instances: Instance[]
}

export function OrphanManager({ instances }: Props) {
	const [scanning, setScanning] = useState(false)
	const [orphans, setOrphans] = useState<OrphanTorrent[]>([])
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [scanned, setScanned] = useState(false)
	const [deleteFiles, setDeleteFiles] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const [showConfirm, setShowConfirm] = useState(false)

	async function scan() {
		setScanning(true)
		setOrphans([])
		setSelected(new Set())
		setScanned(false)
		try {
			const res = await fetch('/api/tools/orphans/scan', {
				method: 'POST',
				credentials: 'include',
			})
			if (!res.ok) throw new Error('Scan failed')
			const data = await res.json()
			setOrphans(data.orphans)
			setScanned(true)
		} finally {
			setScanning(false)
		}
	}

	function toggleSelect(key: string) {
		setSelected(prev => {
			const next = new Set(prev)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})
	}

	function selectAll() {
		if (selected.size === orphans.length) {
			setSelected(new Set())
		} else {
			setSelected(new Set(orphans.map(o => `${o.instanceId}:${o.hash}`)))
		}
	}

	async function handleDelete() {
		setDeleting(true)
		try {
			const byInstance = new Map<number, string[]>()
			for (const key of selected) {
				const [instanceId, hash] = key.split(':')
				const id = parseInt(instanceId, 10)
				if (!byInstance.has(id)) byInstance.set(id, [])
				byInstance.get(id)!.push(hash)
			}
			for (const [instanceId, hashes] of byInstance) {
				await deleteTorrents(instanceId, hashes, deleteFiles)
			}
			setOrphans(prev => prev.filter(o => !selected.has(`${o.instanceId}:${o.hash}`)))
			setSelected(new Set())
			setShowConfirm(false)
		} finally {
			setDeleting(false)
		}
	}

	const groupedByInstance = orphans.reduce((acc, o) => {
		if (!acc[o.instanceLabel]) acc[o.instanceLabel] = []
		acc[o.instanceLabel].push(o)
		return acc
	}, {} as Record<string, OrphanTorrent[]>)

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Orphan Manager</h1>
					<p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
						Find torrents with missing files or unregistered from trackers
					</p>
				</div>
				<button
					onClick={scan}
					disabled={scanning || instances.length === 0}
					className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
					style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
				>
					{scanning ? 'Scanning...' : 'Scan All Instances'}
				</button>
			</div>

			{scanning && (
				<div className="mb-6 p-4 rounded-xl border flex items-center gap-3" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
					<div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
					<span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Scanning instances... (check server logs for details)</span>
				</div>
			)}

			{instances.length === 0 && (
				<div className="text-center py-12 rounded-xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
					<p className="text-sm" style={{ color: 'var(--text-muted)' }}>No instances configured</p>
				</div>
			)}

			{scanned && orphans.length === 0 && (
				<div className="text-center py-12 rounded-xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
					<svg className="w-12 h-12 mx-auto mb-3" style={{ color: '#a6e3a1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>All clear!</p>
					<p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>No orphaned torrents found</p>
				</div>
			)}

			{orphans.length > 0 && (
				<>
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-4">
							<button
								onClick={selectAll}
								className="text-sm hover:underline"
								style={{ color: 'var(--accent)' }}
							>
								{selected.size === orphans.length ? 'Deselect all' : 'Select all'}
							</button>
							<span className="text-sm" style={{ color: 'var(--text-muted)' }}>
								{selected.size} of {orphans.length} selected
							</span>
						</div>
						{selected.size > 0 && (
							<button
								onClick={() => setShowConfirm(true)}
								className="px-4 py-2 rounded-lg text-sm font-medium"
								style={{ backgroundColor: 'var(--error)', color: 'white' }}
							>
								Delete Selected
							</button>
						)}
					</div>

					{Object.entries(groupedByInstance).map(([instanceLabel, items]) => (
						<div key={instanceLabel} className="mb-6">
							<h2 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
								<svg className="w-4 h-4" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
								</svg>
								{instanceLabel}
								<span className="font-normal" style={{ color: 'var(--text-muted)' }}>({items.length})</span>
							</h2>
							<div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
								{items.map((item, idx) => {
									const key = `${item.instanceId}:${item.hash}`
									return (
										<div
											key={key}
											className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
											style={{ borderTop: idx > 0 ? '1px solid var(--border)' : undefined }}
											onClick={() => toggleSelect(key)}
										>
											<div
												className="w-5 h-5 rounded flex items-center justify-center border shrink-0 transition-colors"
												style={{
													backgroundColor: selected.has(key) ? 'var(--accent)' : 'transparent',
													borderColor: selected.has(key) ? 'var(--accent)' : 'var(--border)',
												}}
											>
												{selected.has(key) && (
													<svg className="w-3 h-3" style={{ color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
														<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
													</svg>
												)}
											</div>
											<div className="flex-1 min-w-0">
												<div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
													{item.name}
												</div>
												<div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
													<span>{formatSize(item.size)}</span>
													<span>•</span>
													{item.reason === 'missingFiles' ? (
														<span style={{ color: 'var(--warning)' }}>Missing files</span>
													) : (
														<span style={{ color: 'var(--error)' }} title={item.trackerMessage}>
															Unregistered
														</span>
													)}
												</div>
											</div>
										</div>
									)
								})}
							</div>
						</div>
					))}
				</>
			)}

			{showConfirm && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
					<div
						className="w-full max-w-md rounded-xl border p-6"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Delete Torrents</h3>
						<p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
							Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{selected.size}</strong> torrent{selected.size !== 1 ? 's' : ''}?
						</p>
						<label className="flex items-center gap-3 mb-6 cursor-pointer">
							<div
								className="w-5 h-5 rounded flex items-center justify-center border shrink-0 transition-colors"
								style={{
									backgroundColor: deleteFiles ? 'var(--error)' : 'transparent',
									borderColor: deleteFiles ? 'var(--error)' : 'var(--border)',
								}}
								onClick={() => setDeleteFiles(!deleteFiles)}
							>
								{deleteFiles && (
									<svg className="w-3 h-3" style={{ color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
									</svg>
								)}
							</div>
							<span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Also delete downloaded files</span>
						</label>
						<div className="flex gap-3 justify-end">
							<button
								onClick={() => setShowConfirm(false)}
								disabled={deleting}
								className="px-4 py-2 rounded-lg text-sm border disabled:opacity-50"
								style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
							>
								Cancel
							</button>
							<button
								onClick={handleDelete}
								disabled={deleting}
								className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
								style={{ backgroundColor: 'var(--error)', color: 'white' }}
							>
								{deleting ? 'Deleting...' : 'Delete'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
