import { useState, useRef, useEffect } from 'react'
import { Palette, Settings, Check } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { MobileThemeManager } from './MobileThemeManager'

export function MobileThemeSwitcher() {
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
					className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
					style={{ backgroundColor: 'var(--bg-secondary)' }}
				>
					<Palette className="w-5 h-5" style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
				</button>
				{open && (
					<>
						<div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
						<div
							className="absolute right-0 top-full mt-2 z-50 min-w-[180px] rounded-xl border shadow-xl overflow-hidden"
							style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
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
									<div className="border-t border-[var(--border)]" />
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
							<div className="border-t border-[var(--border)]" />
							<button
								onClick={() => {
									setOpen(false)
									setShowManager(true)
								}}
								className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-medium active:bg-[var(--bg-tertiary)] transition-colors"
								style={{ color: 'var(--text-secondary)' }}
							>
								<Settings className="w-4 h-4" strokeWidth={2} />
								Manage Themes
							</button>
						</div>
					</>
				)}
			</div>

			{showManager && <MobileThemeManager onClose={() => setShowManager(false)} />}
		</>
	)
}

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
			className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[var(--bg-tertiary)]"
			style={{ color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}
		>
			<div className="flex gap-1">
				<div
					className="w-3 h-3 rounded-full"
					style={{ backgroundColor: t.colors.bgPrimary, border: '1px solid var(--border)' }}
				/>
				<div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.colors.accent }} />
				<div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.colors.warning }} />
			</div>
			<span className="text-sm font-medium flex-1">{t.name}</span>
			{isActive && <Check className="w-4 h-4" style={{ color: 'var(--accent)' }} strokeWidth={2.5} />}
		</button>
	)
}
