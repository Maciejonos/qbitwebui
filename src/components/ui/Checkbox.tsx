import { Check } from 'lucide-react'

export function Checkbox({
	checked,
	onChange,
	label,
}: {
	checked: boolean
	onChange: (v: boolean) => void
	label: string
}) {
	return (
		<button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 text-left">
			<div
				className="w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0"
				style={{
					backgroundColor: checked ? 'var(--accent)' : 'transparent',
					borderColor: checked ? 'var(--accent)' : 'var(--border)',
				}}
			>
				{checked && <Check className="w-2.5 h-2.5" style={{ color: 'white' }} strokeWidth={3} />}
			</div>
			{label && (
				<span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
					{label}
				</span>
			)}
		</button>
	)
}
