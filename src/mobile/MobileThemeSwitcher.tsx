import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../hooks/useTheme'

export function MobileThemeSwitcher() {
	const { theme, setTheme, themes } = useTheme()
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	return (
		<div ref={ref} className="relative">
			<button
				onClick={() => setOpen(!open)}
				className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
				style={{ backgroundColor: 'var(--bg-secondary)' }}
			>
				<svg className="w-5 h-5" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
					<path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
				</svg>
			</button>
			{open && (
				<>
					<div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
					<div
						className="absolute right-0 top-full mt-2 z-50 min-w-[160px] rounded-xl border shadow-xl overflow-hidden"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						{themes.map((t) => (
							<button
								key={t.id}
								onClick={() => { setTheme(t.id); setOpen(false) }}
								className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[var(--bg-tertiary)]"
								style={{ color: theme.id === t.id ? 'var(--accent)' : 'var(--text-primary)' }}
							>
								<div className="flex gap-1">
									<div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.colors.bgPrimary, border: '1px solid var(--border)' }} />
									<div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.colors.accent }} />
									<div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.colors.warning }} />
								</div>
								<span className="text-sm font-medium flex-1">{t.name}</span>
								{theme.id === t.id && (
									<svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
									</svg>
								)}
							</button>
						))}
					</div>
				</>
			)}
		</div>
	)
}
