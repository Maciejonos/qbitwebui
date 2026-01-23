import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { Checkbox } from './Checkbox'

interface Option {
	value: number
	label: string
}

interface MultiSelectProps {
	options: Option[]
	selected: number[]
	onChange: (selected: number[]) => void
	placeholder?: string
}

export function MultiSelect({ options, selected, onChange, placeholder = 'Select...' }: MultiSelectProps) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const sorted = [...options].sort((a, b) => a.label.localeCompare(b.label))
	const allSelected = selected.length === options.length && options.length > 0

	function handleSelectAll() {
		if (allSelected) {
			onChange([])
		} else {
			onChange(options.map((o) => o.value))
		}
	}

	function handleToggle(value: number) {
		if (selected.includes(value)) {
			onChange(selected.filter((v) => v !== value))
		} else {
			onChange([...selected, value])
		}
	}

	const displayText = selected.length === 0 ? placeholder : `${selected.length} selected`

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				data-dropdown
				onClick={() => setOpen(!open)}
				className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm"
				style={{
					backgroundColor: 'var(--bg-tertiary)',
					borderColor: 'var(--border)',
					color: selected.length ? 'var(--text-primary)' : 'var(--text-muted)',
				}}
			>
				<span className="truncate">{displayText}</span>
				<ChevronDown
					className={`w-3 h-3 shrink-0 ${open ? 'rotate-180' : ''}`}
					style={{ color: 'var(--text-muted)' }}
					strokeWidth={2}
				/>
			</button>
			{open && (
				<div
					className="absolute top-full left-0 mt-1 w-full max-h-64 overflow-auto rounded-lg border shadow-lg z-50"
					style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
				>
					<div
						className="px-3 py-2 border-b cursor-pointer hover:bg-[var(--bg-tertiary)]"
						style={{ borderColor: 'var(--border)' }}
						onClick={handleSelectAll}
					>
						<Checkbox
							checked={allSelected}
							onChange={handleSelectAll}
							label={allSelected ? 'Deselect All' : 'Select All'}
						/>
					</div>
					{sorted.map((option) => (
						<div
							key={option.value}
							className="px-3 py-2 cursor-pointer hover:bg-[var(--bg-tertiary)]"
							onClick={() => handleToggle(option.value)}
						>
							<Checkbox
								checked={selected.includes(option.value)}
								onChange={() => handleToggle(option.value)}
								label={option.label}
							/>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
