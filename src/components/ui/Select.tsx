import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectProps<T extends string | number> {
	value: T
	options: { value: T; label: string }[]
	onChange: (v: T) => void
	className?: string
	minWidth?: string
}

export function Select<T extends string | number>({
	value,
	options,
	onChange,
	className,
	minWidth = '120px',
}: SelectProps<T>) {
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
		<div ref={ref} className={`relative ${className || ''}`} style={{ minWidth }}>
			<button
				type="button"
				data-dropdown
				onClick={() => setOpen(!open)}
				className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm"
				style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
			>
				<span className="truncate">{selected?.label}</span>
				<ChevronDown
					className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
					style={{ color: 'var(--text-muted)' }}
					strokeWidth={2}
				/>
			</button>
			{open && (
				<div
					className="absolute top-full left-0 mt-1 min-w-full max-h-48 overflow-auto rounded border shadow-lg z-50"
					style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
				>
					{options.map((o) => (
						<button
							key={o.value}
							type="button"
							onClick={() => {
								onChange(o.value)
								setOpen(false)
							}}
							className="w-full px-2.5 py-1.5 text-left text-xs whitespace-nowrap transition-colors hover:bg-[var(--bg-tertiary)]"
							style={{
								color: value === o.value ? 'var(--accent)' : 'var(--text-primary)',
								backgroundColor:
									value === o.value ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
							}}
						>
							{o.label}
						</button>
					))}
				</div>
			)}
		</div>
	)
}
