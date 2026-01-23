import { AlertTriangle } from 'lucide-react'
import type { QBittorrentPreferences } from '../../types/preferences'
import { Toggle, Select } from '../ui'

interface Props {
	preferences: Partial<QBittorrentPreferences>
	onChange: (updates: Partial<QBittorrentPreferences>) => void
}

const RESUME_DATA_STORAGE_TYPES = [
	{ value: 'Legacy', label: 'Fastresume files' },
	{ value: 'SQLite', label: 'SQLite database' },
]

const TORRENT_CONTENT_REMOVE_OPTIONS = [
	{ value: 'Delete', label: 'Delete permanently' },
	{ value: 'MoveToTrash', label: 'Move to trash' },
]

const DISK_IO_TYPES = [
	{ value: 0, label: 'Default' },
	{ value: 1, label: 'Memory mapped' },
	{ value: 2, label: 'POSIX-compliant' },
]

const DISK_IO_MODES = [
	{ value: 0, label: 'Disable OS cache' },
	{ value: 1, label: 'Enable OS cache' },
]

const UTP_TCP_MIXED_MODES = [
	{ value: 0, label: 'Prefer TCP' },
	{ value: 1, label: 'Peer proportional' },
]

const UPLOAD_SLOTS_BEHAVIORS = [
	{ value: 0, label: 'Fixed slots' },
	{ value: 1, label: 'Upload rate based' },
]

const UPLOAD_CHOKING_ALGORITHMS = [
	{ value: 0, label: 'Round robin' },
	{ value: 1, label: 'Fastest upload' },
	{ value: 2, label: 'Anti-leech' },
]

export function AdvancedTab({ preferences, onChange }: Props) {
	return (
		<div className="space-y-4">
			<div
				className="px-3 py-2 rounded flex items-start gap-2"
				style={{
					backgroundColor: 'color-mix(in srgb, var(--warning) 15%, transparent)',
					border: '1px solid var(--warning)',
				}}
			>
				<AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} strokeWidth={1.5} />
				<p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
					Incorrect values may affect performance or stability.
				</p>
			</div>

			<div>
				<div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
					qBittorrent
				</div>
				<div className="space-y-2">
					<div className="grid grid-cols-2 gap-2">
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Resume data storage
							</label>
							<Select
								value={preferences.resume_data_storage_type ?? 'SQLite'}
								onChange={(v) => onChange({ resume_data_storage_type: v })}
								options={RESUME_DATA_STORAGE_TYPES}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Content removing mode
							</label>
							<Select
								value={preferences.torrent_content_remove_option ?? 'Delete'}
								onChange={(v) => onChange({ torrent_content_remove_option: v })}
								options={TORRENT_CONTENT_REMOVE_OPTIONS}
							/>
						</div>
					</div>
					<div className="grid grid-cols-3 gap-2">
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Memory limit (MiB)
							</label>
							<input
								type="number"
								value={preferences.memory_working_set_limit ?? 512}
								onChange={(e) => onChange({ memory_working_set_limit: parseInt(e.target.value) || 512 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Network interface
							</label>
							<input
								type="text"
								value={preferences.current_network_interface ?? ''}
								onChange={(e) => onChange({ current_network_interface: e.target.value })}
								placeholder="Any"
								className="w-full px-2 py-1.5 rounded border text-xs"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								IP to bind
							</label>
							<input
								type="text"
								value={preferences.current_interface_address ?? ''}
								onChange={(e) => onChange({ current_interface_address: e.target.value })}
								placeholder="All"
								className="w-full px-2 py-1.5 rounded border text-xs"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
					</div>
					<div className="grid grid-cols-4 gap-2">
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Resume interval (min)
							</label>
							<input
								type="number"
								value={preferences.save_resume_data_interval ?? 60}
								onChange={(e) => onChange({ save_resume_data_interval: parseInt(e.target.value) || 60 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Stats interval (min)
							</label>
							<input
								type="number"
								value={preferences.save_statistics_interval ?? 15}
								onChange={(e) => onChange({ save_statistics_interval: parseInt(e.target.value) || 15 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								.torrent size (MiB)
							</label>
							<input
								type="number"
								value={Math.round((preferences.torrent_file_size_limit ?? 104857600) / 1024 / 1024)}
								onChange={(e) => onChange({ torrent_file_size_limit: (parseInt(e.target.value) || 100) * 1024 * 1024 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Refresh (ms)
							</label>
							<input
								type="number"
								value={preferences.refresh_interval ?? 1500}
								onChange={(e) => onChange({ refresh_interval: parseInt(e.target.value) || 1500 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
					</div>
					<div>
						<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
							Instance name
						</label>
						<input
							type="text"
							value={preferences.app_instance_name ?? ''}
							onChange={(e) => onChange({ app_instance_name: e.target.value })}
							placeholder="qBittorrent"
							className="w-full px-2 py-1.5 rounded border text-xs"
							style={{
								backgroundColor: 'var(--bg-tertiary)',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
						/>
					</div>
					<div className="grid grid-cols-2 gap-x-4 gap-y-1">
						<div className="flex items-center justify-between">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								Confirm recheck
							</span>
							<Toggle
								checked={preferences.confirm_torrent_recheck ?? true}
								onChange={(v) => onChange({ confirm_torrent_recheck: v })}
							/>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								Recheck on completion
							</span>
							<Toggle
								checked={preferences.recheck_completed_torrents ?? false}
								onChange={(v) => onChange({ recheck_completed_torrents: v })}
							/>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								Resolve peer countries
							</span>
							<Toggle
								checked={preferences.resolve_peer_countries ?? true}
								onChange={(v) => onChange({ resolve_peer_countries: v })}
							/>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								Reannounce on IP change
							</span>
							<Toggle
								checked={preferences.reannounce_when_address_changed ?? false}
								onChange={(v) => onChange({ reannounce_when_address_changed: v })}
							/>
						</div>
					</div>
					<div className="p-2 rounded space-y-2" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
						<div className="flex items-center justify-between">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								Embedded tracker
							</span>
							<Toggle
								checked={preferences.enable_embedded_tracker ?? false}
								onChange={(v) => onChange({ enable_embedded_tracker: v })}
							/>
						</div>
						{preferences.enable_embedded_tracker && (
							<div className="flex items-center gap-4 pl-4">
								<div className="flex items-center gap-2">
									<label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
										Port
									</label>
									<input
										type="number"
										value={preferences.embedded_tracker_port ?? 9000}
										onChange={(e) => onChange({ embedded_tracker_port: parseInt(e.target.value) || 9000 })}
										className="w-16 px-2 py-1 rounded border text-xs font-mono"
										style={{
											backgroundColor: 'var(--bg-secondary)',
											borderColor: 'var(--border)',
											color: 'var(--text-primary)',
										}}
									/>
								</div>
								<div className="flex items-center justify-between flex-1">
									<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
										Port forwarding
									</span>
									<Toggle
										checked={preferences.embedded_tracker_port_forwarding ?? false}
										onChange={(v) => onChange({ embedded_tracker_port_forwarding: v })}
									/>
								</div>
							</div>
						)}
					</div>
					<div className="flex items-center justify-between">
						<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
							Ignore SSL errors
						</span>
						<Toggle
							checked={preferences.ignore_ssl_errors ?? false}
							onChange={(v) => onChange({ ignore_ssl_errors: v })}
						/>
					</div>
					<div>
						<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
							Python executable path
						</label>
						<input
							type="text"
							value={preferences.python_executable_path ?? ''}
							onChange={(e) => onChange({ python_executable_path: e.target.value })}
							placeholder="Auto detect"
							className="w-full px-2 py-1.5 rounded border text-xs"
							style={{
								backgroundColor: 'var(--bg-tertiary)',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
						/>
					</div>
				</div>
			</div>

			<div className="h-px" style={{ backgroundColor: 'var(--border)' }} />

			<div>
				<div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
					libtorrent
				</div>
				<div className="space-y-2">
					<div className="grid grid-cols-4 gap-2">
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Bdecode depth
							</label>
							<input
								type="number"
								value={preferences.bdecode_depth_limit ?? 100}
								onChange={(e) => onChange({ bdecode_depth_limit: parseInt(e.target.value) || 100 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Bdecode tokens
							</label>
							<input
								type="number"
								value={preferences.bdecode_token_limit ?? 10000000}
								onChange={(e) => onChange({ bdecode_token_limit: parseInt(e.target.value) || 10000000 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Async I/O threads
							</label>
							<input
								type="number"
								value={preferences.async_io_threads ?? 10}
								onChange={(e) => onChange({ async_io_threads: parseInt(e.target.value) || 10 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Hashing threads
							</label>
							<input
								type="number"
								value={preferences.hashing_threads ?? 1}
								onChange={(e) => onChange({ hashing_threads: parseInt(e.target.value) || 1 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
					</div>
					<div className="grid grid-cols-4 gap-2">
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								File pool size
							</label>
							<input
								type="number"
								value={preferences.file_pool_size ?? 100}
								onChange={(e) => onChange({ file_pool_size: parseInt(e.target.value) || 100 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Check mem (MiB)
							</label>
							<input
								type="number"
								value={preferences.checking_memory_use ?? 32}
								onChange={(e) => onChange({ checking_memory_use: parseInt(e.target.value) || 32 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Disk queue (KiB)
							</label>
							<input
								type="number"
								value={preferences.disk_queue_size ?? 1024}
								onChange={(e) => onChange({ disk_queue_size: parseInt(e.target.value) || 1024 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Disk IO type
							</label>
							<Select
								value={preferences.disk_io_type ?? 0}
								onChange={(v) => onChange({ disk_io_type: v })}
								options={DISK_IO_TYPES}
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-2">
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Disk IO read mode
							</label>
							<Select
								value={preferences.disk_io_read_mode ?? 0}
								onChange={(v) => onChange({ disk_io_read_mode: v })}
								options={DISK_IO_MODES}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Disk IO write mode
							</label>
							<Select
								value={preferences.disk_io_write_mode ?? 0}
								onChange={(v) => onChange({ disk_io_write_mode: v })}
								options={DISK_IO_MODES}
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-x-4 gap-y-1">
						<div className="flex items-center justify-between">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								Piece extent affinity
							</span>
							<Toggle
								checked={preferences.enable_piece_extent_affinity ?? false}
								onChange={(v) => onChange({ enable_piece_extent_affinity: v })}
							/>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								Upload piece suggestions
							</span>
							<Toggle
								checked={preferences.enable_upload_suggestions ?? false}
								onChange={(v) => onChange({ enable_upload_suggestions: v })}
							/>
						</div>
					</div>
					<div className="grid grid-cols-3 gap-2">
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Send buffer (KiB)
							</label>
							<input
								type="number"
								value={preferences.send_buffer_watermark ?? 500}
								onChange={(e) => onChange({ send_buffer_watermark: parseInt(e.target.value) || 500 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Low watermark (KiB)
							</label>
							<input
								type="number"
								value={preferences.send_buffer_low_watermark ?? 10}
								onChange={(e) => onChange({ send_buffer_low_watermark: parseInt(e.target.value) || 10 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Watermark factor (%)
							</label>
							<input
								type="number"
								value={preferences.send_buffer_watermark_factor ?? 50}
								onChange={(e) => onChange({ send_buffer_watermark_factor: parseInt(e.target.value) || 50 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
					</div>
					<div className="grid grid-cols-3 gap-2">
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Connections/sec
							</label>
							<input
								type="number"
								value={preferences.connection_speed ?? 30}
								onChange={(e) => onChange({ connection_speed: parseInt(e.target.value) || 30 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Send buffer (KiB)
							</label>
							<input
								type="number"
								value={preferences.socket_send_buffer_size ?? 0}
								onChange={(e) => onChange({ socket_send_buffer_size: parseInt(e.target.value) || 0 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Recv buffer (KiB)
							</label>
							<input
								type="number"
								value={preferences.socket_receive_buffer_size ?? 0}
								onChange={(e) => onChange({ socket_receive_buffer_size: parseInt(e.target.value) || 0 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
					</div>
					<div className="grid grid-cols-4 gap-2">
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Socket backlog
							</label>
							<input
								type="number"
								value={preferences.socket_backlog_size ?? 30}
								onChange={(e) => onChange({ socket_backlog_size: parseInt(e.target.value) || 30 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								UPnP lease
							</label>
							<input
								type="number"
								value={preferences.upnp_lease_duration ?? 0}
								onChange={(e) => onChange({ upnp_lease_duration: parseInt(e.target.value) || 0 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Out ports min
							</label>
							<input
								type="number"
								value={preferences.outgoing_ports_min ?? 0}
								onChange={(e) => onChange({ outgoing_ports_min: parseInt(e.target.value) || 0 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Out ports max
							</label>
							<input
								type="number"
								value={preferences.outgoing_ports_max ?? 0}
								onChange={(e) => onChange({ outgoing_ports_max: parseInt(e.target.value) || 0 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-2">
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Peer ToS
							</label>
							<input
								type="number"
								value={preferences.peer_tos ?? 4}
								onChange={(e) => onChange({ peer_tos: parseInt(e.target.value) || 0 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								µTP-TCP mixed mode
							</label>
							<Select
								value={preferences.utp_tcp_mixed_mode ?? 0}
								onChange={(v) => onChange({ utp_tcp_mixed_mode: v })}
								options={UTP_TCP_MIXED_MODES}
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-x-4 gap-y-1">
						<div className="flex items-center justify-between">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								IDN support
							</span>
							<Toggle
								checked={preferences.idn_support_enabled ?? false}
								onChange={(v) => onChange({ idn_support_enabled: v })}
							/>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								Multi connections same IP
							</span>
							<Toggle
								checked={preferences.enable_multi_connections_from_same_ip ?? false}
								onChange={(v) => onChange({ enable_multi_connections_from_same_ip: v })}
							/>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								Validate HTTPS tracker cert
							</span>
							<Toggle
								checked={preferences.validate_https_tracker_certificate ?? true}
								onChange={(v) => onChange({ validate_https_tracker_certificate: v })}
							/>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								SSRF mitigation
							</span>
							<Toggle
								checked={preferences.ssrf_mitigation ?? true}
								onChange={(v) => onChange({ ssrf_mitigation: v })}
							/>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								Block privileged ports
							</span>
							<Toggle
								checked={preferences.block_peers_on_privileged_ports ?? false}
								onChange={(v) => onChange({ block_peers_on_privileged_ports: v })}
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-2">
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Upload slots behavior
							</label>
							<Select
								value={preferences.upload_slots_behavior ?? 0}
								onChange={(v) => onChange({ upload_slots_behavior: v })}
								options={UPLOAD_SLOTS_BEHAVIORS}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Upload choking algorithm
							</label>
							<Select
								value={preferences.upload_choking_algorithm ?? 1}
								onChange={(v) => onChange({ upload_choking_algorithm: v })}
								options={UPLOAD_CHOKING_ALGORITHMS}
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-x-4 gap-y-1">
						<div className="flex items-center justify-between">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								Announce to all trackers in tier
							</span>
							<Toggle
								checked={preferences.announce_to_all_tiers ?? true}
								onChange={(v) => onChange({ announce_to_all_tiers: v })}
							/>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
								Announce to all tiers
							</span>
							<Toggle
								checked={preferences.announce_to_all_trackers ?? false}
								onChange={(v) => onChange({ announce_to_all_trackers: v })}
							/>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-2">
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Announce IP
							</label>
							<input
								type="text"
								value={preferences.announce_ip ?? ''}
								onChange={(e) => onChange({ announce_ip: e.target.value })}
								placeholder="(restart req)"
								className="w-full px-2 py-1.5 rounded border text-xs"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Announce port (0=listen)
							</label>
							<input
								type="number"
								value={preferences.announce_port ?? 0}
								onChange={(e) => onChange({ announce_port: parseInt(e.target.value) || 0 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
					</div>
					<div className="grid grid-cols-3 gap-2">
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Max HTTP announces
							</label>
							<input
								type="number"
								value={preferences.max_concurrent_http_announces ?? 50}
								onChange={(e) => onChange({ max_concurrent_http_announces: parseInt(e.target.value) || 50 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Stop tracker timeout
							</label>
							<input
								type="number"
								value={preferences.stop_tracker_timeout ?? 2}
								onChange={(e) => onChange({ stop_tracker_timeout: parseInt(e.target.value) || 0 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Request queue
							</label>
							<input
								type="number"
								value={preferences.request_queue_size ?? 500}
								onChange={(e) => onChange({ request_queue_size: parseInt(e.target.value) || 500 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
					</div>
					<div className="grid grid-cols-3 gap-2">
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Peer turnover (%)
							</label>
							<input
								type="number"
								value={preferences.peer_turnover ?? 4}
								onChange={(e) => onChange({ peer_turnover: parseInt(e.target.value) || 4 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Turnover cutoff (%)
							</label>
							<input
								type="number"
								value={preferences.peer_turnover_cutoff ?? 90}
								onChange={(e) => onChange({ peer_turnover_cutoff: parseInt(e.target.value) || 90 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
						<div>
							<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
								Turnover interval (s)
							</label>
							<input
								type="number"
								value={preferences.peer_turnover_interval ?? 300}
								onChange={(e) => onChange({ peer_turnover_interval: parseInt(e.target.value) || 300 })}
								className="w-full px-2 py-1.5 rounded border text-xs font-mono"
								style={{
									backgroundColor: 'var(--bg-tertiary)',
									borderColor: 'var(--border)',
									color: 'var(--text-primary)',
								}}
							/>
						</div>
					</div>
					<div>
						<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
							DHT bootstrap nodes
						</label>
						<input
							type="text"
							value={
								preferences.dht_bootstrap_nodes ??
								'dht.libtorrent.org:25401, dht.transmissionbt.com:6881, router.bittorrent.com:6881'
							}
							onChange={(e) => onChange({ dht_bootstrap_nodes: e.target.value })}
							className="w-full px-2 py-1.5 rounded border text-xs"
							style={{
								backgroundColor: 'var(--bg-tertiary)',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
						/>
					</div>
				</div>
			</div>

			<div className="h-px" style={{ backgroundColor: 'var(--border)' }} />

			<div>
				<div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
					I2P
				</div>
				<div className="grid grid-cols-4 gap-2">
					<div>
						<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
							Inbound qty
						</label>
						<input
							type="number"
							value={preferences.i2p_inbound_quantity ?? 3}
							onChange={(e) => onChange({ i2p_inbound_quantity: parseInt(e.target.value) || 3 })}
							className="w-full px-2 py-1.5 rounded border text-xs font-mono"
							style={{
								backgroundColor: 'var(--bg-tertiary)',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
						/>
					</div>
					<div>
						<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
							Outbound qty
						</label>
						<input
							type="number"
							value={preferences.i2p_outbound_quantity ?? 3}
							onChange={(e) => onChange({ i2p_outbound_quantity: parseInt(e.target.value) || 3 })}
							className="w-full px-2 py-1.5 rounded border text-xs font-mono"
							style={{
								backgroundColor: 'var(--bg-tertiary)',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
						/>
					</div>
					<div>
						<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
							Inbound len
						</label>
						<input
							type="number"
							value={preferences.i2p_inbound_length ?? 3}
							onChange={(e) => onChange({ i2p_inbound_length: parseInt(e.target.value) || 3 })}
							className="w-full px-2 py-1.5 rounded border text-xs font-mono"
							style={{
								backgroundColor: 'var(--bg-tertiary)',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
						/>
					</div>
					<div>
						<label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
							Outbound len
						</label>
						<input
							type="number"
							value={preferences.i2p_outbound_length ?? 3}
							onChange={(e) => onChange({ i2p_outbound_length: parseInt(e.target.value) || 3 })}
							className="w-full px-2 py-1.5 rounded border text-xs font-mono"
							style={{
								backgroundColor: 'var(--bg-tertiary)',
								borderColor: 'var(--border)',
								color: 'var(--text-primary)',
							}}
						/>
					</div>
				</div>
			</div>
		</div>
	)
}
