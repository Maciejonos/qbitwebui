import { useState } from 'react'
import { Settings, X, Check, Pencil, Trash2 } from 'lucide-react'
import {
	useCategories,
	useTags,
	useCreateCategory,
	useEditCategory,
	useDeleteCategory,
	useCreateTag,
	useDeleteTag,
} from '../hooks/useTorrents'

interface Props {
	open: boolean
	onClose: () => void
}

type Tab = 'categories' | 'tags'

export function CategoryTagManager({ open, onClose }: Props) {
	const [tab, setTab] = useState<Tab>('categories')
	const [newCategoryName, setNewCategoryName] = useState('')
	const [newCategorySavePath, setNewCategorySavePath] = useState('')
	const [newTag, setNewTag] = useState('')
	const [editingCategory, setEditingCategory] = useState<string | null>(null)
	const [editSavePath, setEditSavePath] = useState('')

	const { data: categories = {} } = useCategories()
	const { data: tags = [] } = useTags()
	const createCategoryMutation = useCreateCategory()
	const editCategoryMutation = useEditCategory()
	const deleteCategoryMutation = useDeleteCategory()
	const createTagMutation = useCreateTag()
	const deleteTagMutation = useDeleteTag()

	if (!open) return null

	function handleCreateCategory(e: React.FormEvent) {
		e.preventDefault()
		if (!newCategoryName.trim()) return
		createCategoryMutation.mutate(
			{ name: newCategoryName.trim(), savePath: newCategorySavePath.trim() || undefined },
			{
				onSuccess: () => {
					setNewCategoryName('')
					setNewCategorySavePath('')
				},
			}
		)
	}

	function handleEditCategory(name: string) {
		if (!editSavePath.trim() && editSavePath !== '') return
		editCategoryMutation.mutate(
			{ name, savePath: editSavePath },
			{
				onSuccess: () => setEditingCategory(null),
			}
		)
	}

	function startEditCategory(name: string, currentPath: string) {
		setEditingCategory(name)
		setEditSavePath(currentPath)
	}

	function handleCreateTag(e: React.FormEvent) {
		e.preventDefault()
		if (!newTag.trim()) return
		createTagMutation.mutate(newTag.trim(), {
			onSuccess: () => setNewTag(''),
		})
	}

	return (
		<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
			<div className="relative w-full max-w-lg mx-4 opacity-0 animate-in">
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
								<Settings className="w-5 h-5" style={{ color: 'var(--accent)' }} strokeWidth={2} />
							</div>
							<h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
								Manage Categories & Tags
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

					<div className="p-5 space-y-4">
						<div
							className="flex p-1 rounded-xl border"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
						>
							<button
								type="button"
								onClick={() => setTab('categories')}
								className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all"
								style={{
									backgroundColor: tab === 'categories' ? 'var(--accent)' : 'transparent',
									color: tab === 'categories' ? 'var(--accent-contrast)' : 'var(--text-muted)',
								}}
							>
								Categories
							</button>
							<button
								type="button"
								onClick={() => setTab('tags')}
								className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all"
								style={{
									backgroundColor: tab === 'tags' ? 'var(--accent)' : 'transparent',
									color: tab === 'tags' ? 'var(--accent-contrast)' : 'var(--text-muted)',
								}}
							>
								Tags
							</button>
						</div>

						{tab === 'categories' ? (
							<div className="space-y-3">
								<div className="max-h-64 overflow-y-auto space-y-1">
									{Object.entries(categories).length === 0 ? (
										<div className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
											No categories
										</div>
									) : (
										Object.entries(categories).map(([name, cat]) => (
											<div
												key={name}
												className="flex items-center gap-2 px-3 py-2 rounded-lg"
												style={{ backgroundColor: 'var(--bg-secondary)' }}
											>
												{editingCategory === name ? (
													<>
														<span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>
															{name}
														</span>
														<input
															type="text"
															value={editSavePath}
															onChange={(e) => setEditSavePath(e.target.value)}
															onKeyDown={(e) => {
																if (e.key === 'Enter') handleEditCategory(name)
																if (e.key === 'Escape') setEditingCategory(null)
															}}
															placeholder="Save path"
															autoFocus
															className="flex-1 px-2 py-1 rounded border text-xs focus:outline-none"
															style={{
																backgroundColor: 'var(--bg-tertiary)',
																borderColor: 'var(--border)',
																color: 'var(--text-primary)',
															}}
														/>
														<button
															onClick={() => handleEditCategory(name)}
															className="p-1 rounded hover:opacity-70"
															style={{ color: 'var(--success)' }}
														>
															<Check className="w-4 h-4" strokeWidth={2} />
														</button>
														<button
															onClick={() => setEditingCategory(null)}
															className="p-1 rounded hover:opacity-70"
															style={{ color: 'var(--text-muted)' }}
														>
															<X className="w-4 h-4" strokeWidth={2} />
														</button>
													</>
												) : (
													<>
														<span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
															{name}
														</span>
														<span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>
															{cat.savePath || '(default)'}
														</span>
														<button
															onClick={() => startEditCategory(name, cat.savePath)}
															className="p-1 rounded hover:opacity-70"
															style={{ color: 'var(--text-muted)' }}
														>
															<Pencil className="w-4 h-4" strokeWidth={2} />
														</button>
														<button
															onClick={() => deleteCategoryMutation.mutate(name)}
															disabled={deleteCategoryMutation.isPending}
															className="p-1 rounded hover:opacity-70"
															style={{ color: 'var(--error)' }}
														>
															<Trash2 className="w-4 h-4" strokeWidth={2} />
														</button>
													</>
												)}
											</div>
										))
									)}
								</div>
								<form onSubmit={handleCreateCategory} className="flex gap-2">
									<input
										type="text"
										value={newCategoryName}
										onChange={(e) => setNewCategoryName(e.target.value)}
										placeholder="Name"
										className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none"
										style={{
											backgroundColor: 'var(--bg-secondary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
									/>
									<input
										type="text"
										value={newCategorySavePath}
										onChange={(e) => setNewCategorySavePath(e.target.value)}
										placeholder="Save path (optional)"
										className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none"
										style={{
											backgroundColor: 'var(--bg-secondary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
									/>
									<button
										type="submit"
										disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
										className="px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
										style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
									>
										Add
									</button>
								</form>
							</div>
						) : (
							<div className="space-y-3">
								<div className="max-h-64 overflow-y-auto space-y-1">
									{tags.length === 0 ? (
										<div className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
											No tags
										</div>
									) : (
										tags.map((tag) => (
											<div
												key={tag}
												className="flex items-center justify-between px-3 py-2 rounded-lg"
												style={{ backgroundColor: 'var(--bg-secondary)' }}
											>
												<span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
													{tag}
												</span>
												<button
													onClick={() => deleteTagMutation.mutate(tag)}
													disabled={deleteTagMutation.isPending}
													className="p-1 rounded hover:opacity-70"
													style={{ color: 'var(--error)' }}
												>
													<Trash2 className="w-4 h-4" strokeWidth={2} />
												</button>
											</div>
										))
									)}
								</div>
								<form onSubmit={handleCreateTag} className="flex gap-2">
									<input
										type="text"
										value={newTag}
										onChange={(e) => setNewTag(e.target.value)}
										placeholder="New tag name"
										className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none"
										style={{
											backgroundColor: 'var(--bg-secondary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
									/>
									<button
										type="submit"
										disabled={!newTag.trim() || createTagMutation.isPending}
										className="px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
										style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
									>
										Add
									</button>
								</form>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
