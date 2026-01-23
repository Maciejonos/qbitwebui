import { useState, useRef } from 'react'
import { Plus, X, Upload, CheckCircle, Check } from 'lucide-react'
import { useAddTorrent, useCategories } from '../hooks/useTorrents'

interface Props {
	open: boolean
	onClose: () => void
}

type Tab = 'link' | 'file'

export function AddTorrentModal({ open, onClose }: Props) {
	const [tab, setTab] = useState<Tab>('link')
	const [url, setUrl] = useState('')
	const [files, setFiles] = useState<File[]>([])
	const [category, setCategory] = useState('')
	const [tags, setTags] = useState('')
	const [savepath, setSavepath] = useState('')
	const [startTorrent, setStartTorrent] = useState(true)
	const [sequential, setSequential] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const { data: categories = {} } = useCategories()
	const addMutation = useAddTorrent()

	if (!open) return null

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (tab === 'link' && !url.trim()) return
		if (tab === 'file' && files.length === 0) return

		addMutation.mutate(
			{
				options: {
					urls: tab === 'link' ? url.trim() : undefined,
					category: category || undefined,
					tags: tags || undefined,
					savepath: savepath || undefined,
					paused: !startTorrent,
					sequentialDownload: sequential,
				},
				files: tab === 'file' ? files : undefined,
			},
			{
				onSuccess: () => {
					setUrl('')
					setFiles([])
					setCategory('')
					setTags('')
					setSavepath('')
					setStartTorrent(true)
					setSequential(false)
					onClose()
				},
			}
		)
	}

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const selected = Array.from(e.target.files || []).filter((f) => f.name.endsWith('.torrent'))
		if (selected.length > 0) setFiles((prev) => [...prev, ...selected])
	}

	function handleDrop(e: React.DragEvent) {
		e.preventDefault()
		const dropped = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith('.torrent'))
		if (dropped.length > 0) {
			setFiles((prev) => [...prev, ...dropped])
			setTab('file')
		}
	}

	function removeFile(index: number) {
		setFiles((prev) => prev.filter((_, i) => i !== index))
	}

	return (
		<div
			className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
			onDragOver={(e) => e.preventDefault()}
			onDrop={handleDrop}
		>
			<div className="relative w-full max-w-md mx-4 opacity-0 animate-in">
				<div
					className="absolute -inset-px rounded-2xl"
					style={{
						background: 'linear-gradient(to bottom, color-mix(in srgb, var(--accent) 20%, transparent), transparent)',
					}}
				/>
				<div
					className="relative rounded-2xl border"
					style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
				>
					<div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
						<div className="flex items-center gap-3">
							<div
								className="w-10 h-10 rounded-xl flex items-center justify-center"
								style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)' }}
							>
								<Plus className="w-5 h-5" style={{ color: 'var(--accent)' }} strokeWidth={2} />
							</div>
							<h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
								Add Torrent
							</h3>
						</div>
						<button
							onClick={onClose}
							className="p-2 rounded-lg transition-colors hover:opacity-80"
							style={{ color: 'var(--text-muted)' }}
						>
							<X className="w-5 h-5" strokeWidth={2} />
						</button>
					</div>

					<form onSubmit={handleSubmit} className="p-5 space-y-4">
						<div
							className="flex p-1 rounded-xl border"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
						>
							<button
								type="button"
								onClick={() => setTab('link')}
								className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all"
								style={{
									backgroundColor: tab === 'link' ? 'var(--accent)' : 'transparent',
									color: tab === 'link' ? 'var(--accent-contrast)' : 'var(--text-muted)',
								}}
							>
								Magnet / URL
							</button>
							<button
								type="button"
								onClick={() => setTab('file')}
								className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all"
								style={{
									backgroundColor: tab === 'file' ? 'var(--accent)' : 'transparent',
									color: tab === 'file' ? 'var(--accent-contrast)' : 'var(--text-muted)',
								}}
							>
								Torrent File
							</button>
						</div>

						{tab === 'link' ? (
							<div>
								<label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
									Magnet link or URL
								</label>
								<textarea
									value={url}
									onChange={(e) => setUrl(e.target.value)}
									placeholder="magnet:?xt=urn:btih:... or https://..."
									rows={3}
									className="w-full px-4 py-3 rounded-xl border text-sm resize-none focus:outline-none transition-colors"
									style={{
										backgroundColor: 'var(--bg-secondary)',
										borderColor: 'var(--border)',
										color: 'var(--text-primary)',
									}}
								/>
							</div>
						) : (
							<div>
								<label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
									Torrent files
								</label>
								<input
									ref={fileInputRef}
									type="file"
									accept=".torrent"
									multiple
									onChange={handleFileChange}
									className="hidden"
								/>
								<button
									type="button"
									onClick={() => fileInputRef.current?.click()}
									className="w-full py-4 px-4 rounded-xl border border-dashed text-sm transition-colors hover:opacity-80"
									style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
								>
									<div className="flex flex-col items-center gap-2" style={{ color: 'var(--text-muted)' }}>
										<Upload className="w-6 h-6" strokeWidth={1.5} />
										<span>Click or drop .torrent files</span>
									</div>
								</button>
								{files.length > 0 && (
									<div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
										{files.map((f, i) => (
											<div
												key={i}
												className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
												style={{ backgroundColor: 'var(--bg-secondary)' }}
											>
												<CheckCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} strokeWidth={2} />
												<span className="truncate flex-1" style={{ color: 'var(--text-primary)' }}>
													{f.name}
												</span>
												<button
													type="button"
													onClick={() => removeFile(i)}
													className="p-0.5 rounded hover:opacity-70"
													style={{ color: 'var(--text-muted)' }}
												>
													<X className="w-3.5 h-3.5" strokeWidth={2} />
												</button>
											</div>
										))}
									</div>
								)}
							</div>
						)}

						<div className="grid grid-cols-2 gap-3">
							<div>
								<label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
									Category
								</label>
								<select
									value={category}
									onChange={(e) => setCategory(e.target.value)}
									className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-colors appearance-none cursor-pointer"
									style={{
										backgroundColor: 'var(--bg-secondary)',
										borderColor: 'var(--border)',
										color: 'var(--text-primary)',
									}}
								>
									<option value="">None</option>
									{Object.keys(categories).map((cat) => (
										<option key={cat} value={cat}>
											{cat}
										</option>
									))}
								</select>
							</div>
							<div>
								<label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
									Tags
								</label>
								<input
									type="text"
									value={tags}
									onChange={(e) => setTags(e.target.value)}
									placeholder="tag1, tag2"
									className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-colors"
									style={{
										backgroundColor: 'var(--bg-secondary)',
										borderColor: 'var(--border)',
										color: 'var(--text-primary)',
									}}
								/>
							</div>
						</div>

						<div>
							<label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
								Save path
							</label>
							<input
								type="text"
								value={savepath}
								onChange={(e) => setSavepath(e.target.value)}
								placeholder="Default"
								className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-colors"
								style={{
									backgroundColor: 'var(--bg-secondary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>

						<div className="flex items-center gap-4 pt-2">
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={startTorrent}
									onChange={(e) => setStartTorrent(e.target.checked)}
									className="sr-only peer"
								/>
								<div
									className="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
									style={{
										borderColor: startTorrent ? 'var(--accent)' : 'var(--border)',
										backgroundColor: startTorrent ? 'var(--accent)' : 'transparent',
									}}
								>
									{startTorrent && (
										<Check className="w-2.5 h-2.5" style={{ color: 'var(--accent-contrast)' }} strokeWidth={4} />
									)}
								</div>
								<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
									Start torrent
								</span>
							</label>
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={sequential}
									onChange={(e) => setSequential(e.target.checked)}
									className="sr-only peer"
								/>
								<div
									className="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
									style={{
										borderColor: sequential ? 'var(--accent)' : 'var(--border)',
										backgroundColor: sequential ? 'var(--accent)' : 'transparent',
									}}
								>
									{sequential && (
										<Check className="w-2.5 h-2.5" style={{ color: 'var(--accent-contrast)' }} strokeWidth={4} />
									)}
								</div>
								<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
									Sequential
								</span>
							</label>
						</div>

						<div className="flex gap-3 pt-2">
							<button
								type="button"
								onClick={onClose}
								className="flex-1 py-3 rounded-xl border text-sm font-medium transition-colors hover:opacity-80"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-muted)',
								}}
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={
									addMutation.isPending || (tab === 'link' && !url.trim()) || (tab === 'file' && files.length === 0)
								}
								className="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
							>
								{addMutation.isPending ? 'Adding...' : 'Add Torrent'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	)
}
