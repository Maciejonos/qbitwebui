import { useState, useMemo, useRef, useEffect } from 'react'
import { Drawer } from 'vaul'
import { HexColorPicker } from 'react-colorful'
import { Plus, Upload, Download, Pencil, Trash2, ChevronLeft } from 'lucide-react'
import { generateThemeColors, isValidHex } from '../utils/colorUtils'
import { useTheme } from '../hooks/useTheme'
import type { Theme } from '../themes'

type View = 'list' | 'editor'

interface MobileThemeManagerProps {
	onClose: () => void
}

export function MobileThemeManager({ onClose }: MobileThemeManagerProps) {
	const { themes, customThemes, addTheme, updateTheme, deleteTheme } = useTheme()
	const [view, setView] = useState<View>('list')
	const [editingTheme, setEditingTheme] = useState<Theme | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const allNames = useMemo(
		() => [...themes.map((t) => t.name), ...customThemes.map((t) => t.name)],
		[themes, customThemes]
	)

	function handleNewTheme() {
		setEditingTheme(null)
		setView('editor')
	}

	function handleEditTheme(theme: Theme) {
		setEditingTheme(theme)
		setView('editor')
	}

	function handleSaveTheme(theme: Theme) {
		if (editingTheme) {
			updateTheme(theme)
		} else {
			addTheme(theme)
		}
		setView('list')
		setEditingTheme(null)
	}

	function handleExport() {
		const blob = new Blob([JSON.stringify(customThemes, null, 2)], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = 'qbitwebui-themes.json'
		a.click()
		URL.revokeObjectURL(url)
	}

	function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0]
		if (!file) return

		const reader = new FileReader()
		reader.onload = (event) => {
			try {
				const imported = JSON.parse(event.target?.result as string) as Theme[]
				if (!Array.isArray(imported)) throw new Error('Invalid format')

				imported.forEach((t) => {
					if (t.name && t.colors) {
						addTheme({
							...t,
							id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
						})
					}
				})
			} catch {
				alert('Failed to import themes. Invalid file format.')
			}
		}
		reader.readAsText(file)
		e.target.value = ''
	}

	return (
		<Drawer.Root open={true} onOpenChange={(open) => !open && onClose()}>
			<Drawer.Portal>
				<Drawer.Overlay className="fixed inset-0 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} />
				<Drawer.Content
					className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t flex flex-col outline-none"
					style={{
						backgroundColor: 'var(--bg-primary)',
						borderColor: 'var(--border)',
						height: '90vh',
					}}
				>
					{/* Handle */}
					<div className="flex justify-center pt-3 pb-2">
						<div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
					</div>

					{view === 'list' ? (
						<ListView
							customThemes={customThemes}
							onNew={handleNewTheme}
							onEdit={handleEditTheme}
							onDelete={deleteTheme}
							onExport={handleExport}
							onImportClick={() => fileInputRef.current?.click()}
						/>
					) : (
						<EditorView
							initialTheme={editingTheme}
							existingNames={allNames}
							onSave={handleSaveTheme}
							onBack={() => {
								setView('list')
								setEditingTheme(null)
							}}
						/>
					)}

					<input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
				</Drawer.Content>
			</Drawer.Portal>
		</Drawer.Root>
	)
}

// ─────────────────────────────────────────────────────────────
// List View
// ─────────────────────────────────────────────────────────────

interface ListViewProps {
	customThemes: Theme[]
	onNew: () => void
	onEdit: (theme: Theme) => void
	onDelete: (id: string) => void
	onExport: () => void
	onImportClick: () => void
}

function ListView({ customThemes, onNew, onEdit, onDelete, onExport, onImportClick }: ListViewProps) {
	return (
		<>
			{/* Header */}
			<div className="px-5 pb-3">
				<Drawer.Title className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
					Manage Themes
				</Drawer.Title>
			</div>

			{/* Action Bar */}
			<div className="px-4 pb-3 flex items-center gap-2">
				<button
					onClick={onNew}
					className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform"
					style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
				>
					<Plus className="w-4 h-4" strokeWidth={2} />
					New Theme
				</button>
				<div className="flex-1" />
				<button
					onClick={onImportClick}
					className="p-2.5 rounded-xl active:scale-[0.98] transition-transform"
					style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
				>
					<Upload className="w-5 h-5" strokeWidth={2} />
				</button>
				<button
					onClick={onExport}
					disabled={customThemes.length === 0}
					className="p-2.5 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50"
					style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
				>
					<Download className="w-5 h-5" strokeWidth={2} />
				</button>
			</div>

			{/* Theme List */}
			<div
				className="flex-1 overflow-y-auto px-4 space-y-2"
				style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
			>
				{customThemes.length === 0 ? (
					<div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
						No custom themes yet
					</div>
				) : (
					customThemes.map((t) => (
						<div
							key={t.id}
							className="flex items-center gap-3 p-4 rounded-2xl border"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
						>
							<div className="flex gap-1.5 shrink-0">
								<div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.colors.bgPrimary }} />
								<div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.colors.accent }} />
								<div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.colors.warning }} />
							</div>
							<span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
								{t.name}
							</span>
							<button
								onClick={() => onEdit(t)}
								className="p-2 rounded-xl active:scale-[0.95] transition-transform"
								style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
							>
								<Pencil className="w-4 h-4" strokeWidth={2} />
							</button>
							<button
								onClick={() => onDelete(t.id)}
								className="p-2 rounded-xl active:scale-[0.95] transition-transform"
								style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--error)' }}
							>
								<Trash2 className="w-4 h-4" strokeWidth={2} />
							</button>
						</div>
					))
				)}
			</div>
		</>
	)
}

// ─────────────────────────────────────────────────────────────
// Editor View
// ─────────────────────────────────────────────────────────────

interface EditorViewProps {
	initialTheme: Theme | null
	existingNames: string[]
	onSave: (theme: Theme) => void
	onBack: () => void
}

function EditorView({ initialTheme, existingNames, onSave, onBack }: EditorViewProps) {
	const [name, setName] = useState(initialTheme?.name ?? 'My Custom Theme')
	const [bgPrimary, setBgPrimary] = useState(initialTheme?.colors.bgPrimary ?? '#1e1e2e')
	const [accent, setAccent] = useState(initialTheme?.colors.accent ?? '#cba6f7')
	const [textPrimary, setTextPrimary] = useState(initialTheme?.colors.textPrimary ?? '#cdd6f4')
	const [warning, setWarning] = useState(initialTheme?.colors.warning ?? '#f7b731')

	const previewColors = useMemo(() => {
		if (isValidHex(bgPrimary) && isValidHex(accent) && isValidHex(textPrimary) && isValidHex(warning)) {
			return generateThemeColors(bgPrimary, accent, textPrimary, warning)
		}
		return null
	}, [bgPrimary, accent, textPrimary, warning])

	const isNameTaken = useMemo(() => {
		const trimmed = name.trim().toLowerCase()
		return existingNames.some((n) => {
			if (initialTheme?.name.toLowerCase() === trimmed) return false
			return n.toLowerCase() === trimmed
		})
	}, [name, existingNames, initialTheme?.name])

	const handleSave = () => {
		if (!previewColors || !name.trim() || isNameTaken) return
		onSave({
			id: initialTheme?.id ?? `custom-${Date.now()}`,
			name: name.trim(),
			colors: previewColors,
		})
	}

	const colorFields = [
		{ label: 'Background', val: bgPrimary, set: setBgPrimary },
		{ label: 'Accent', val: accent, set: setAccent },
		{ label: 'Text', val: textPrimary, set: setTextPrimary },
		{ label: 'Warning', val: warning, set: setWarning },
	]

	return (
		<>
			{/* Header */}
			<div className="px-4 pb-3 flex items-center gap-3">
				<button
					onClick={onBack}
					className="p-2 -ml-2 rounded-xl active:scale-[0.95] transition-transform"
					style={{ color: 'var(--text-muted)' }}
				>
					<ChevronLeft className="w-5 h-5" strokeWidth={2} />
				</button>
				<Drawer.Title className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
					{initialTheme ? 'Edit Theme' : 'New Theme'}
				</Drawer.Title>
			</div>

			{/* Content */}
			<div
				className="flex-1 overflow-y-auto px-4 space-y-4"
				style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
			>
				{/* Theme Name */}
				<div className="space-y-1">
					<label className="text-xs font-medium flex justify-between" style={{ color: 'var(--text-secondary)' }}>
						<span>Theme Name</span>
						<span style={{ color: 'var(--text-muted)' }}>{name.length}/20</span>
					</label>
					<input
						type="text"
						value={name}
						onChange={(e) => {
							const sanitized = e.target.value.replace(/[^a-zA-Z0-9\s\-_]/g, '')
							setName(sanitized.slice(0, 20))
						}}
						maxLength={20}
						className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
						style={{
							backgroundColor: 'var(--bg-secondary)',
							color: 'var(--text-primary)',
							border: `1px solid ${isNameTaken ? 'var(--error)' : 'var(--border)'}`,
						}}
					/>
					{isNameTaken && (
						<p className="text-xs" style={{ color: 'var(--error)' }}>
							Name already exists
						</p>
					)}
				</div>

				{/* Color Inputs */}
				<div className="grid grid-cols-1 gap-3">
					{colorFields.map((field) => (
						<ColorInput key={field.label} label={field.label} value={field.val} onChange={field.set} />
					))}
				</div>

				{/* Preview */}
				{previewColors && (
					<div
						className="rounded-2xl p-4 space-y-3"
						style={{ backgroundColor: previewColors.bgPrimary, border: `1px solid ${previewColors.border}` }}
					>
						<div className="flex justify-between items-center">
							<div className="text-sm font-bold" style={{ color: previewColors.textPrimary }}>
								{name || 'Theme Name'}
							</div>
							<div
								className="px-2.5 py-1 rounded-full text-xs font-medium"
								style={{ backgroundColor: previewColors.accent, color: previewColors.accentContrast }}
							>
								Badge
							</div>
						</div>
						<div
							className="p-3 rounded-xl"
							style={{ backgroundColor: previewColors.bgSecondary, border: `1px solid ${previewColors.border}` }}
						>
							<div className="text-xs mb-2" style={{ color: previewColors.textSecondary }}>
								Preview Card
							</div>
							<button
								className="w-full py-2 rounded-lg text-xs font-medium"
								style={{ backgroundColor: previewColors.accent, color: previewColors.accentContrast }}
							>
								Action
							</button>
						</div>
					</div>
				)}

				{/* Save Button */}
				<button
					onClick={handleSave}
					disabled={!previewColors || !name.trim() || isNameTaken}
					className="w-full py-3.5 rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
					style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
				>
					Save Theme
				</button>
			</div>
		</>
	)
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		function handleClick(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('mousedown', handleClick)
		return () => document.removeEventListener('mousedown', handleClick)
	}, [open])

	return (
		<div className="space-y-1">
			<label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
				{label}
			</label>
			<div className="flex items-center gap-2">
				<div ref={ref} className="relative">
					<button
						type="button"
						onClick={() => setOpen(!open)}
						className="w-10 h-10 rounded-xl shrink-0 cursor-pointer active:scale-95 transition-transform"
						style={{
							backgroundColor: isValidHex(value) ? value : 'transparent',
							border: '1px solid var(--border)',
						}}
					/>
					{open && (
						<div
							className="absolute top-full left-0 mt-2 z-10 p-3 rounded-xl shadow-xl"
							style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
						>
							<HexColorPicker color={isValidHex(value) ? value : '#000000'} onChange={onChange} />
						</div>
					)}
				</div>
				<input
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					className="flex-1 px-3 py-2.5 font-mono text-xs rounded-xl focus:outline-none"
					style={{
						backgroundColor: 'var(--bg-secondary)',
						color: 'var(--text-primary)',
						border: '1px solid var(--border)',
					}}
					placeholder="#000000"
				/>
			</div>
		</div>
	)
}
