import { ArrowDown, ArrowUp, Clock } from 'lucide-react'
import type { QBittorrentPreferences } from '../../types/preferences'
import { Toggle, Checkbox, Select } from '../ui'

const SCHEDULER_DAYS = [
	{ value: 0, label: 'Every day' },
	{ value: 1, label: 'Weekdays' },
	{ value: 2, label: 'Weekend' },
	{ value: 3, label: 'Monday' },
	{ value: 4, label: 'Tuesday' },
	{ value: 5, label: 'Wednesday' },
	{ value: 6, label: 'Thursday' },
	{ value: 7, label: 'Friday' },
	{ value: 8, label: 'Saturday' },
	{ value: 9, label: 'Sunday' },
]

interface Props {
	preferences: Partial<QBittorrentPreferences>
	onChange: (updates: Partial<QBittorrentPreferences>) => void
}

function bytesToKB(bytes: number | undefined): string {
	if (bytes === undefined) return '0'
	return bytes === 0 ? '0' : Math.round(bytes / 1024).toString()
}

function kbToBytes(kb: string): number {
	const val = parseInt(kb, 10)
	return isNaN(val) || val < 0 ? 0 : val * 1024
}

export function SpeedTab({ preferences, onChange }: Props) {
	return (
		<div className="space-y-4">
			<div className="flex justify-end">
				<span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
					0 = unlimited
				</span>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div>
					<div
						className="text-[10px] font-semibold uppercase tracking-wider mb-2"
						style={{ color: 'var(--text-muted)' }}
					>
						Global Limits
					</div>
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<ArrowDown className="w-3 h-3 shrink-0" style={{ color: 'var(--accent)' }} strokeWidth={2} />
							<input
								type="text"
								inputMode="numeric"
								value={bytesToKB(preferences.dl_limit)}
								onChange={(e) => onChange({ dl_limit: kbToBytes(e.target.value) })}
								className="w-24 px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
							<span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
								KiB/s
							</span>
						</div>
						<div className="flex items-center gap-2">
							<ArrowUp className="w-3 h-3 shrink-0" style={{ color: '#a6e3a1' }} strokeWidth={2} />
							<input
								type="text"
								inputMode="numeric"
								value={bytesToKB(preferences.up_limit)}
								onChange={(e) => onChange({ up_limit: kbToBytes(e.target.value) })}
								className="w-24 px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
							<span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
								KiB/s
							</span>
						</div>
					</div>
				</div>

				<div>
					<div
						className="text-[10px] font-semibold uppercase tracking-wider mb-2"
						style={{ color: 'var(--text-muted)' }}
					>
						Alternative Limits
					</div>
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<ArrowDown className="w-3 h-3 shrink-0" style={{ color: 'var(--accent)' }} strokeWidth={2} />
							<input
								type="text"
								inputMode="numeric"
								value={bytesToKB(preferences.alt_dl_limit)}
								onChange={(e) => onChange({ alt_dl_limit: kbToBytes(e.target.value) })}
								className="w-24 px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
							<span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
								KiB/s
							</span>
						</div>
						<div className="flex items-center gap-2">
							<ArrowUp className="w-3 h-3 shrink-0" style={{ color: '#a6e3a1' }} strokeWidth={2} />
							<input
								type="text"
								inputMode="numeric"
								value={bytesToKB(preferences.alt_up_limit)}
								onChange={(e) => onChange({ alt_up_limit: kbToBytes(e.target.value) })}
								className="w-24 px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
							<span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
								KiB/s
							</span>
						</div>
					</div>
				</div>
			</div>

			<div className="h-px" style={{ backgroundColor: 'var(--border)' }} />

			<div>
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-2">
						<Clock
							className="w-3.5 h-3.5"
							style={{ color: preferences.scheduler_enabled ? 'var(--accent)' : 'var(--text-muted)' }}
							strokeWidth={1.5}
						/>
						<span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
							Schedule alternative limits
						</span>
					</div>
					<Toggle
						checked={preferences.scheduler_enabled ?? false}
						onChange={(v) => onChange({ scheduler_enabled: v })}
					/>
				</div>

				{preferences.scheduler_enabled && (
					<div className="flex items-center gap-4 pl-5">
						<div className="flex items-center gap-1">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								From
							</span>
							<Select
								value={preferences.schedule_from_hour ?? 8}
								onChange={(v) => onChange({ schedule_from_hour: v })}
								options={Array.from({ length: 24 }, (_, i) => ({ value: i, label: i.toString().padStart(2, '0') }))}
								minWidth="50px"
							/>
							<span style={{ color: 'var(--text-muted)' }}>:</span>
							<Select
								value={preferences.schedule_from_min ?? 0}
								onChange={(v) => onChange({ schedule_from_min: v })}
								options={[0, 15, 30, 45].map((m) => ({ value: m, label: m.toString().padStart(2, '0') }))}
								minWidth="50px"
							/>
						</div>
						<div className="flex items-center gap-1">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								To
							</span>
							<Select
								value={preferences.schedule_to_hour ?? 20}
								onChange={(v) => onChange({ schedule_to_hour: v })}
								options={Array.from({ length: 24 }, (_, i) => ({ value: i, label: i.toString().padStart(2, '0') }))}
								minWidth="50px"
							/>
							<span style={{ color: 'var(--text-muted)' }}>:</span>
							<Select
								value={preferences.schedule_to_min ?? 0}
								onChange={(v) => onChange({ schedule_to_min: v })}
								options={[0, 15, 30, 45].map((m) => ({ value: m, label: m.toString().padStart(2, '0') }))}
								minWidth="50px"
							/>
						</div>
						<Select
							value={preferences.scheduler_days ?? 0}
							onChange={(v) => onChange({ scheduler_days: v })}
							options={SCHEDULER_DAYS}
							minWidth="100px"
						/>
					</div>
				)}
			</div>

			<div className="h-px" style={{ backgroundColor: 'var(--border)' }} />

			<div>
				<div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
					Rate Limit Settings
				</div>
				<div className="grid grid-cols-2 gap-2">
					<Checkbox
						checked={preferences.limit_utp_rate ?? true}
						onChange={(v) => onChange({ limit_utp_rate: v })}
						label="Apply to µTP protocol"
					/>
					<Checkbox
						checked={preferences.limit_tcp_overhead ?? false}
						onChange={(v) => onChange({ limit_tcp_overhead: v })}
						label="Apply to transport overhead"
					/>
					<Checkbox
						checked={preferences.limit_lan_peers ?? true}
						onChange={(v) => onChange({ limit_lan_peers: v })}
						label="Apply to LAN peers"
					/>
				</div>
			</div>
		</div>
	)
}
