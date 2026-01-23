import { useState, useRef, useEffect, type FC } from 'react'
import {
	LayoutGrid,
	Download,
	Upload,
	CheckCircle,
	Square,
	Zap,
	Search,
	ChevronDown,
	Folder,
	Tag,
	Settings,
	Repeat,
	Columns3,
	GripHorizontal,
	Check,
} from 'lucide-react'
import type { TorrentFilter } from '../types/qbittorrent'
import type { Category } from '../api/qbittorrent'
import type { ColumnDef } from './columns'

const filters: { value: TorrentFilter; label: string; Icon: FC<{ className?: string; strokeWidth?: number }> }[] = [
	{ value: 'all', label: 'All', Icon: LayoutGrid },
	{ value: 'downloading', label: 'Downloading', Icon: Download },
	{ value: 'seeding', label: 'Seeding', Icon: Upload },
	{ value: 'completed', label: 'Completed', Icon: CheckCircle },
	{ value: 'stopped', label: 'Stopped', Icon: Square },
	{ value: 'active', label: 'Active', Icon: Zap },
]

interface Props {
	filter: TorrentFilter
	onFilterChange: (f: TorrentFilter) => void
}

export function FilterBar({ filter, onFilterChange }: Props) {
	return (
		<>
			{filters.map((f) => (
				<button
					key={f.value}
					onClick={() => onFilterChange(f.value)}
					className="relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
					style={{
						color: filter === f.value ? 'var(--accent-contrast)' : 'var(--text-muted)',
					}}
				>
					{filter === f.value && (
						<div
							className="absolute inset-0 rounded-lg shadow-lg"
							style={{
								background: 'linear-gradient(to right, var(--accent), color-mix(in srgb, var(--accent) 80%, black))',
								boxShadow: '0 4px 14px color-mix(in srgb, var(--accent) 20%, transparent)',
							}}
						/>
					)}
					<f.Icon className="relative w-3.5 h-3.5" strokeWidth={2} />
					<span className="relative">{f.label}</span>
				</button>
			))}
		</>
	)
}

export function SearchInput({ value, onChange }: { value: string; onChange: (s: string) => void }) {
	return (
		<div className="relative shrink min-w-0 w-64">
			<Search
				className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
				style={{ color: 'var(--text-muted)' }}
				strokeWidth={2}
			/>
			<input
				type="text"
				placeholder="Search torrents..."
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all duration-200"
				style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
			/>
		</div>
	)
}

interface DropdownProps<T extends string> {
	value: T | null
	onChange: (v: T | null) => void
	options: { value: T; label: string; count?: number }[]
	placeholder: string
	Icon: FC<{ className?: string; strokeWidth?: number }>
}

function Dropdown<T extends string>({ value, onChange, options, placeholder, Icon }: DropdownProps<T>) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const selected = options.find((o) => o.value === value)

	return (
		<div ref={ref} className="relative">
			<button
				onClick={() => setOpen(!open)}
				className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
				style={{
					color: value ? 'var(--accent)' : 'var(--text-muted)',
					backgroundColor: value ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
				}}
			>
				<Icon className="w-3.5 h-3.5" strokeWidth={2} />
				<span className="max-w-[100px] truncate">{selected?.label ?? placeholder}</span>
				<ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
			</button>
			{open && (
				<div
					className="absolute top-full left-0 mt-1 min-w-[180px] max-h-[300px] overflow-auto rounded-lg border shadow-xl z-[100]"
					style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
				>
					<button
						onClick={() => {
							onChange(null)
							setOpen(false)
						}}
						className="w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors"
						style={{
							color: !value ? 'var(--accent)' : 'var(--text-muted)',
							backgroundColor: !value ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
						}}
					>
						<span>All</span>
					</button>
					{options.map((o) => (
						<button
							key={o.value}
							onClick={() => {
								onChange(o.value)
								setOpen(false)
							}}
							className="w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors"
							style={{
								color: value === o.value ? 'var(--accent)' : 'var(--text-muted)',
								backgroundColor:
									value === o.value ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
							}}
						>
							<span className="truncate">{o.label}</span>
							{o.count !== undefined && (
								<span style={{ color: 'var(--text-muted)' }} className="ml-2">
									{o.count}
								</span>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

interface CategoryDropdownProps {
	value: string | null
	onChange: (v: string | null) => void
	categories: Record<string, Category>
}

export function CategoryDropdown({ value, onChange, categories }: CategoryDropdownProps) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const names = Object.keys(categories)
	const selected = names.find((n) => n === value)

	return (
		<div ref={ref} className="relative">
			<button
				onClick={() => setOpen(!open)}
				className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
				style={{
					color: value ? 'var(--accent)' : 'var(--text-muted)',
					backgroundColor: value ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
				}}
			>
				<Folder className="w-3.5 h-3.5" strokeWidth={2} />
				<span className="max-w-[100px] truncate">{selected ?? 'Category'}</span>
				<ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
			</button>
			{open && (
				<div
					className="absolute top-full left-0 mt-1 min-w-[180px] max-h-[300px] overflow-auto rounded-lg border shadow-xl z-[100]"
					style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
				>
					<button
						onClick={() => {
							onChange(null)
							setOpen(false)
						}}
						className="w-full flex items-center px-3 py-2 text-xs text-left transition-colors"
						style={{
							color: !value ? 'var(--accent)' : 'var(--text-muted)',
							backgroundColor: !value ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
						}}
					>
						All
					</button>
					{names.map((name) => (
						<button
							key={name}
							onClick={() => {
								onChange(name)
								setOpen(false)
							}}
							className="w-full px-3 py-2 text-xs text-left transition-colors truncate"
							style={{
								color: value === name ? 'var(--accent)' : 'var(--text-muted)',
								backgroundColor: value === name ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
							}}
						>
							{name}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

interface TagDropdownProps {
	value: string | null
	onChange: (v: string | null) => void
	tags: string[]
}

export function TagDropdown({ value, onChange, tags }: TagDropdownProps) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const selected = tags.find((t) => t === value)

	return (
		<div ref={ref} className="relative">
			<button
				onClick={() => setOpen(!open)}
				className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
				style={{
					color: value ? 'var(--accent)' : 'var(--text-muted)',
					backgroundColor: value ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
				}}
			>
				<Tag className="w-3.5 h-3.5" strokeWidth={2} />
				<span className="max-w-[100px] truncate">{selected ?? 'Tag'}</span>
				<ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
			</button>
			{open && (
				<div
					className="absolute top-full left-0 mt-1 min-w-[180px] max-h-[300px] overflow-auto rounded-lg border shadow-xl z-[100]"
					style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
				>
					<button
						onClick={() => {
							onChange(null)
							setOpen(false)
						}}
						className="w-full flex items-center px-3 py-2 text-xs text-left transition-colors"
						style={{
							color: !value ? 'var(--accent)' : 'var(--text-muted)',
							backgroundColor: !value ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
						}}
					>
						All
					</button>
					{tags.map((tag) => (
						<button
							key={tag}
							onClick={() => {
								onChange(tag)
								setOpen(false)
							}}
							className="w-full px-3 py-2 text-xs text-left transition-colors truncate"
							style={{
								color: value === tag ? 'var(--accent)' : 'var(--text-muted)',
								backgroundColor: value === tag ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
							}}
						>
							{tag}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

export function ManageButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			onClick={onClick}
			className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:opacity-80"
			style={{ color: 'var(--text-muted)' }}
			title="Manage categories & tags"
		>
			<Settings className="w-3.5 h-3.5" strokeWidth={2} />
		</button>
	)
}

interface TrackerDropdownProps {
	value: string | null
	onChange: (v: string | null) => void
	trackers: string[]
}

export function TrackerDropdown({ value, onChange, trackers }: TrackerDropdownProps) {
	const options = trackers.map((t) => {
		try {
			const url = new URL(t)
			return { value: t, label: url.hostname }
		} catch {
			return { value: t, label: t }
		}
	})
	return <Dropdown value={value} onChange={onChange} options={options} placeholder="Tracker" Icon={Repeat} />
}

interface ColumnSelectorProps {
	columns: ColumnDef[]
	visible: Set<string>
	onChange: (visible: Set<string>) => void
	columnOrder: string[]
	onReorder: (order: string[]) => void
	onReset: () => void
}

export function ColumnSelector({ columns, visible, onChange, columnOrder, onReorder, onReset }: ColumnSelectorProps) {
	const [open, setOpen] = useState(false)
	const [draggedId, setDraggedId] = useState<string | null>(null)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	function toggle(id: string) {
		const next = new Set(visible)
		if (next.has(id)) next.delete(id)
		else next.add(id)
		onChange(next)
	}

	function handleDragStart(e: React.DragEvent, id: string) {
		setDraggedId(id)
		e.dataTransfer.effectAllowed = 'move'
	}

	function handleDragOver(e: React.DragEvent, targetId: string) {
		e.preventDefault()
		if (!draggedId || draggedId === targetId) return
		const dragIdx = columnOrder.indexOf(draggedId)
		const targetIdx = columnOrder.indexOf(targetId)
		if (dragIdx === -1 || targetIdx === -1) return
		const newOrder = [...columnOrder]
		newOrder.splice(dragIdx, 1)
		newOrder.splice(targetIdx, 0, draggedId)
		onReorder(newOrder)
	}

	function handleDragEnd() {
		setDraggedId(null)
	}

	const orderedColumns = columnOrder
		.map((id) => columns.find((c) => c.id === id))
		.filter((c): c is ColumnDef => c !== undefined)

	return (
		<div ref={ref} className="relative">
			<button
				onClick={() => setOpen(!open)}
				className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
				style={{ color: 'var(--text-muted)' }}
				title="Configure columns"
			>
				<Columns3 className="w-3.5 h-3.5" strokeWidth={2} />
				<ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
			</button>
			{open && (
				<div
					className="absolute top-full right-0 mt-1 min-w-[200px] max-h-[400px] overflow-auto rounded-lg border shadow-xl z-[100]"
					style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
				>
					<div
						className="flex items-center justify-between px-3 py-2 border-b"
						style={{ borderColor: 'var(--border)' }}
					>
						<span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: 'var(--text-muted)' }}>
							Columns
						</span>
						<button
							onClick={() => {
								onReset()
								setOpen(false)
							}}
							className="text-[10px] transition-colors hover:opacity-80"
							style={{ color: 'var(--accent)' }}
						>
							Reset
						</button>
					</div>
					{orderedColumns.map((col) => (
						<div
							key={col.id}
							draggable
							onDragStart={(e) => handleDragStart(e, col.id)}
							onDragOver={(e) => handleDragOver(e, col.id)}
							onDragEnd={handleDragEnd}
							className={`flex items-center gap-2 px-2 py-2 text-xs transition-colors hover:bg-white/5 cursor-move ${draggedId === col.id ? 'opacity-50' : ''}`}
							style={{ color: 'var(--text-primary)' }}
						>
							<GripHorizontal className="w-3 h-3 shrink-0" style={{ color: 'var(--text-muted)' }} strokeWidth={2} />
							<button onClick={() => toggle(col.id)} className="flex-1 flex items-center justify-between text-left">
								<span>{col.label}</span>
								{visible.has(col.id) && (
									<Check className="w-3 h-3" style={{ color: 'var(--accent)' }} strokeWidth={3} />
								)}
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
