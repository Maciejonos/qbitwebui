import { useState, useEffect, useCallback } from 'react'
import { listFiles, getDownloadUrl, type FileEntry } from '../api/files'
import { formatSize } from '../utils/format'

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

export function FileBrowser() {
	const [path, setPath] = useState('/')
	const [files, setFiles] = useState<FileEntry[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	const loadFiles = useCallback(async () => {
		setLoading(true)
		setError('')
		try {
			const data = await listFiles(path)
			setFiles(data)
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to load files')
			setFiles([])
		} finally {
			setLoading(false)
		}
	}, [path])

	useEffect(() => {
		loadFiles()
	}, [loadFiles])

	function handleNavigate(name: string) {
		setPath(path === '/' ? `/${name}` : `${path}/${name}`)
	}

	function handleBack() {
		const parts = path.split('/').filter(Boolean)
		parts.pop()
		setPath(parts.length ? `/${parts.join('/')}` : '/')
	}

	function handleBreadcrumb(index: number) {
		const parts = path.split('/').filter(Boolean)
		setPath(index === -1 ? '/' : `/${parts.slice(0, index + 1).join('/')}`)
	}

	const pathParts = path.split('/').filter(Boolean)

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2 p-3 rounded-lg border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
				<button
					onClick={handleBack}
					disabled={path === '/'}
					className="p-1.5 rounded-md transition-colors disabled:opacity-30"
					style={{ backgroundColor: 'var(--bg-tertiary)' }}
				>
					<svg className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
					</svg>
				</button>
				<div className="flex items-center text-sm overflow-x-auto">
					<button
						onClick={() => handleBreadcrumb(-1)}
						className="px-1 py-1 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"
						style={{ color: path === '/' ? 'var(--text-primary)' : 'var(--text-muted)' }}
					>
						/
					</button>
					{pathParts.map((part, i) => (
						<div key={i} className="flex items-center shrink-0">
							<button
								onClick={() => handleBreadcrumb(i)}
								className="px-1 py-1 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
								style={{ color: i === pathParts.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}
							>
								{part}
							</button>
							<span style={{ color: 'var(--text-muted)' }}>/</span>
						</div>
					))}
				</div>
				<button
					onClick={loadFiles}
					className="ml-auto p-1.5 rounded-md transition-colors"
					style={{ backgroundColor: 'var(--bg-tertiary)' }}
					title="Refresh"
				>
					<svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
					</svg>
				</button>
			</div>

			{error && (
				<div className="p-4 rounded-lg text-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)', color: 'var(--error)' }}>
					{error}
				</div>
			)}

			<div className="rounded-lg border overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
				<table className="w-full">
					<thead>
						<tr className="border-b" style={{ borderColor: 'var(--border)' }}>
							<th className="text-left px-4 py-3 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Name</th>
							<th className="text-right px-4 py-3 text-[10px] font-medium uppercase tracking-wider w-28" style={{ color: 'var(--text-muted)' }}>Size</th>
							<th className="text-right px-4 py-3 text-[10px] font-medium uppercase tracking-wider w-44" style={{ color: 'var(--text-muted)' }}>Modified</th>
							<th className="w-16"></th>
						</tr>
					</thead>
					<tbody>
						{loading && files.length === 0 ? (
							<tr>
								<td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
									Loading...
								</td>
							</tr>
						) : files.length === 0 ? (
							<tr>
								<td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
									Empty directory
								</td>
							</tr>
						) : (
							files.map((file) => (
								<tr
									key={file.name}
									className="border-b last:border-b-0 hover:bg-[var(--bg-tertiary)] transition-colors"
									style={{ borderColor: 'var(--border)' }}
								>
									<td className="px-4 py-2.5">
										{file.isDirectory ? (
											<button
												onClick={() => handleNavigate(file.name)}
												className="flex items-center gap-2 text-sm hover:underline"
												style={{ color: 'var(--text-primary)' }}
											>
												<svg className="w-4 h-4 shrink-0" style={{ color: 'var(--warning)' }} fill="currentColor" viewBox="0 0 24 24">
													<path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
												</svg>
												<span className="truncate">{file.name}</span>
											</button>
										) : (
											<div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
												<svg className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} fill="currentColor" viewBox="0 0 24 24">
													<path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V7.875L14.25 1.5H5.625z" />
													<path d="M14.25 1.5v5.25a1.125 1.125 0 001.125 1.125h5.25" />
												</svg>
												<span className="truncate">{file.name}</span>
											</div>
										)}
									</td>
									<td className="px-4 py-2.5 text-right text-sm tabular-nums" style={{ color: 'var(--text-muted)' }}>
										{file.isDirectory ? '—' : formatSize(file.size)}
									</td>
									<td className="px-4 py-2.5 text-right text-sm tabular-nums" style={{ color: 'var(--text-muted)' }}>
										{formatDate(file.modified)}
									</td>
									<td className="px-4 py-2.5 text-right">
										<a
											href={getDownloadUrl(path === '/' ? `/${file.name}` : `${path}/${file.name}`)}
											className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
											style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
											title={file.isDirectory ? 'Download as .tar' : 'Download'}
										>
											<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
												<path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
											</svg>
										</a>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	)
}
