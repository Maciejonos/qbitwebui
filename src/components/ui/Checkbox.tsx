import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

export function Checkbox({
	checked,
	onChange,
	label,
	disabled,
}: {
	checked: boolean
	onChange: (v: boolean) => void
	label: ReactNode
	disabled?: boolean
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className="flex items-center gap-2 text-left disabled:opacity-50 disabled:cursor-wait"
		>
			<div
				className="w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0"
				style={{
					backgroundColor: checked ? 'var(--accent)' : 'transparent',
					borderColor: checked ? 'var(--accent)' : 'var(--border)',
				}}
			>
				{checked && <Check className="w-2.5 h-2.5" style={{ color: 'var(--accent-contrast)' }} strokeWidth={3} />}
			</div>
			{label && (
				<span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
					{label}
				</span>
			)}
		</button>
	)
}
