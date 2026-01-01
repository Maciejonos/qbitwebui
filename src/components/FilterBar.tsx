import { useState, useRef, useEffect, type ReactNode } from 'react'
import type { TorrentFilter } from '../types/qbittorrent'
import type { Category } from '../api/qbittorrent'

const filters: { value: TorrentFilter; label: string; icon: ReactNode }[] = [
	{
		value: 'all',
		label: 'All',
		icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />,
	},
	{
		value: 'downloading',
		label: 'Downloading',
		icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />,
	},
	{
		value: 'seeding',
		label: 'Seeding',
		icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />,
	},
	{
		value: 'completed',
		label: 'Completed',
		icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
	},
	{
		value: 'stopped',
		label: 'Stopped',
		icon: <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />,
	},
	{
		value: 'active',
		label: 'Active',
		icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />,
	},
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
					className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
						filter === f.value
							? 'text-[#07070a]'
							: 'text-[#9090a0] hover:text-[#c0c0cc] hover:bg-white/[0.04]'
					}`}
				>
					{filter === f.value && (
						<div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#00d4aa] to-[#00a884] shadow-lg shadow-[#00d4aa]/20" />
					)}
					<svg className="relative w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						{f.icon}
					</svg>
					<span className="relative">{f.label}</span>
				</button>
			))}
		</>
	)
}

export function SearchInput({ value, onChange }: { value: string; onChange: (s: string) => void }) {
	return (
		<div className="relative">
			<svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e6e82]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
				<path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
			</svg>
			<input
				type="text"
				placeholder="Search torrents..."
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="w-64 pl-10 pr-4 py-2.5 bg-[#13131a] rounded-xl border border-white/[0.08] text-sm text-[#e8e8ed] placeholder-[#6e6e82] transition-all duration-200 focus:border-[#00d4aa]/40 focus:bg-[#16161f]"
			/>
		</div>
	)
}

interface DropdownProps<T extends string> {
	value: T | null
	onChange: (v: T | null) => void
	options: { value: T; label: string; count?: number }[]
	placeholder: string
	icon: ReactNode
}

function Dropdown<T extends string>({ value, onChange, options, placeholder, icon }: DropdownProps<T>) {
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
				className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
					value ? 'text-[#00d4aa] bg-[#00d4aa]/10' : 'text-[#9090a0] hover:text-[#c0c0cc] hover:bg-white/[0.04]'
				}`}
			>
				<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
					{icon}
				</svg>
				<span className="max-w-[100px] truncate">{selected?.label ?? placeholder}</span>
				<svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
					<path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
				</svg>
			</button>
			{open && (
				<div className="absolute top-full left-0 mt-1 min-w-[180px] max-h-[300px] overflow-auto bg-[#13131a] rounded-lg border border-white/[0.08] shadow-xl z-50">
					<button
						onClick={() => { onChange(null); setOpen(false) }}
						className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
							!value ? 'text-[#00d4aa] bg-[#00d4aa]/10' : 'text-[#9090a0] hover:text-[#c0c0cc] hover:bg-white/[0.04]'
						}`}
					>
						<span>All</span>
					</button>
					{options.map((o) => (
						<button
							key={o.value}
							onClick={() => { onChange(o.value); setOpen(false) }}
							className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
								value === o.value ? 'text-[#00d4aa] bg-[#00d4aa]/10' : 'text-[#9090a0] hover:text-[#c0c0cc] hover:bg-white/[0.04]'
							}`}
						>
							<span className="truncate">{o.label}</span>
							{o.count !== undefined && <span className="text-[#6e6e82] ml-2">{o.count}</span>}
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
	const options = Object.keys(categories).map((name) => ({ value: name, label: name }))
	return (
		<Dropdown
			value={value}
			onChange={onChange}
			options={options}
			placeholder="Category"
			icon={<path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />}
		/>
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
	return (
		<Dropdown
			value={value}
			onChange={onChange}
			options={options}
			placeholder="Tracker"
			icon={<path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />}
		/>
	)
}
