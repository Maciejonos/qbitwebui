import { useState } from 'react'
import { ChevronDown, LayoutGrid, Server, Check } from 'lucide-react'
import type { Instance } from '../api/instances'

interface Props {
	instances: Instance[]
	current: Instance | 'all'
	onChange: (instance: Instance | 'all') => void
}

export function MobileInstancePicker({ instances, current, onChange }: Props) {
	const [open, setOpen] = useState(false)
	const currentLabel = current === 'all' ? 'All Instances' : current.label

	if (instances.length === 1) {
		return (
			<div className="flex items-center gap-2">
				<span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
					{instances[0].label}
				</span>
			</div>
		)
	}

	return (
		<div className="relative">
			<button
				onClick={() => setOpen(!open)}
				className="flex items-center gap-2 px-3 py-1.5 rounded-lg active:scale-98 transition-transform"
				style={{ backgroundColor: 'var(--bg-secondary)' }}
			>
				<span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
					{currentLabel}
				</span>
				<ChevronDown
					className="w-4 h-4 transition-transform"
					style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
					strokeWidth={2}
				/>
			</button>

			{open && (
				<>
					<div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
					<div
						className="absolute left-0 top-full mt-2 z-50 min-w-[200px] rounded-xl border shadow-xl overflow-hidden"
						style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
					>
						<button
							onClick={() => {
								onChange('all')
								setOpen(false)
							}}
							className="w-full text-left px-4 py-3 flex items-center justify-between active:bg-[var(--bg-tertiary)] transition-colors border-b"
							style={{ borderColor: 'var(--border)' }}
						>
							<div className="flex items-center gap-3">
								<div
									className="w-8 h-8 rounded-lg flex items-center justify-center"
									style={{ backgroundColor: 'var(--bg-tertiary)' }}
								>
									<LayoutGrid className="w-4 h-4" style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
								</div>
								<div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
									All Instances
								</div>
							</div>
							{current === 'all' && <Check className="w-5 h-5" style={{ color: 'var(--accent)' }} strokeWidth={2.5} />}
						</button>
						{instances.map((instance) => (
							<button
								key={instance.id}
								onClick={() => {
									onChange(instance)
									setOpen(false)
								}}
								className="w-full text-left px-4 py-3 flex items-center justify-between active:bg-[var(--bg-tertiary)] transition-colors"
							>
								<div className="flex items-center gap-3">
									<div
										className="w-8 h-8 rounded-lg flex items-center justify-center"
										style={{ backgroundColor: 'var(--bg-tertiary)' }}
									>
										<Server className="w-4 h-4" style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
									</div>
									<div>
										<div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
											{instance.label}
										</div>
										<div className="text-xs" style={{ color: 'var(--text-muted)' }}>
											{instance.url}
										</div>
									</div>
								</div>
								{current !== 'all' && instance.id === current.id && (
									<Check className="w-5 h-5" style={{ color: 'var(--accent)' }} strokeWidth={2.5} />
								)}
							</button>
						))}
					</div>
				</>
			)}
		</div>
	)
}
