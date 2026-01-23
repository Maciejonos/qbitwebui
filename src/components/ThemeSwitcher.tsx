import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Settings, Check } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { ThemeManager } from './ThemeManager'

export function ThemeSwitcher() {
	const { theme, setTheme, themes, customThemes } = useTheme()
	const [open, setOpen] = useState(false)
	const [showManager, setShowManager] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	return (
		<>
			<div ref={ref} className="relative">
				<button
					onClick={() => setOpen(!open)}
					className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors"
					style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
				>
					<div className="w-3 h-3 rounded-full ring-1 ring-white/20" style={{ backgroundColor: theme.colors.accent }} />
					<span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
						{theme.name}
					</span>
					<ChevronDown
						className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
						style={{ color: 'var(--text-muted)' }}
						strokeWidth={2}
					/>
				</button>

				{open && (
					<div
						className="absolute top-full right-0 mt-2 w-48 py-1 rounded-lg border shadow-xl z-[100] max-h-[80vh] overflow-y-auto"
						style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
					>
						{/* Official Themes */}
						<div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider opacity-50 select-none text-[var(--text-muted)]">
							Official
						</div>
						{themes.map((t) => (
							<ThemeRow
								key={t.id}
								t={t}
								isActive={theme.id === t.id}
								onSelect={() => {
									setTheme(t.id)
									setOpen(false)
								}}
							/>
						))}

						{/* Custom Themes */}
						{customThemes.length > 0 && (
							<>
								<div className="my-1 border-t border-[var(--border)]" />
								<div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider opacity-50 select-none text-[var(--text-muted)]">
									Custom
								</div>
								{customThemes.map((t) => (
									<ThemeRow
										key={t.id}
										t={t}
										isActive={theme.id === t.id}
										onSelect={() => {
											setTheme(t.id)
											setOpen(false)
										}}
									/>
								))}
							</>
						)}

						{/* Manage Themes */}
						<div className="my-1 border-t border-[var(--border)]" />
						<button
							onClick={() => {
								setOpen(false)
								setShowManager(true)
							}}
							className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition-colors"
						>
							<Settings className="w-3 h-3" strokeWidth={2} />
							Manage Themes
						</button>
					</div>
				)}
			</div>

			{showManager && <ThemeManager onClose={() => setShowManager(false)} />}
		</>
	)
}

// Simple theme row component
function ThemeRow({
	t,
	isActive,
	onSelect,
}: {
	t: { id: string; name: string; colors: { bgPrimary: string; accent: string; warning: string } }
	isActive: boolean
	onSelect: () => void
}) {
	return (
		<button
			onClick={onSelect}
			className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
			style={{
				backgroundColor: isActive ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
				color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
			}}
		>
			<div className="flex gap-1 shrink-0">
				<div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.colors.bgPrimary }} />
				<div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.colors.accent }} />
				<div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.colors.warning }} />
			</div>
			<span className="text-xs font-medium truncate">{t.name}</span>
			{isActive && <Check className="w-3 h-3 ml-auto shrink-0" strokeWidth={3} />}
		</button>
	)
}
