import { useState, useEffect, useRef } from 'react'
import {
	Globe,
	Gauge,
	Server,
	Network,
	Loader2,
	MapPin,
	Building2,
	Terminal,
	ArrowDown,
	ArrowUp,
	Clock,
	Zap,
	Activity,
} from 'lucide-react'
import type { Instance } from '../api/instances'
import { Select } from './ui'
import {
	getIpInfo,
	runSpeedtest,
	getSpeedtestServers,
	getDnsInfo,
	getInterfaces,
	execCommand,
	checkAgentHealth,
	type IpInfo,
	type SpeedtestResult,
	type SpeedtestServer,
	type DnsInfo,
	type NetworkInterface,
} from '../api/netAgent'

interface Props {
	instances: Instance[]
}

type CardStatus = 'idle' | 'loading' | 'success' | 'error'

interface CardState<T> {
	status: CardStatus
	data: T | null
	error: string | null
}

function formatBandwidth(bps: number): string {
	const mbps = (bps * 8) / 1_000_000
	return mbps.toFixed(1)
}

function RunButton({ onClick, disabled, loading }: { onClick: () => void; disabled: boolean; loading: boolean }) {
	return (
		<button
			onClick={onClick}
			disabled={disabled || loading}
			className="w-12 h-7 rounded text-xs font-medium transition-all disabled:opacity-40 flex items-center justify-center"
			style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
		>
			{loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Run'}
		</button>
	)
}

export function NetworkTools({ instances }: Props) {
	const agentInstances = instances.filter((i) => i.agent_enabled)
	const [selectedInstance, setSelectedInstance] = useState<Instance | null>(agentInstances[0] || null)
	const [agentOnline, setAgentOnline] = useState<boolean | null>(null)

	useEffect(() => {
		const current = instances.filter((i) => i.agent_enabled)
		setSelectedInstance((prev) => {
			if (prev && current.some((i) => i.id === prev.id)) {
				return current.find((i) => i.id === prev.id) || null
			}
			return current[0] || null
		})
	}, [instances])

	const [ipInfo, setIpInfo] = useState<CardState<IpInfo>>({ status: 'idle', data: null, error: null })
	const [speedtest, setSpeedtest] = useState<CardState<SpeedtestResult>>({ status: 'idle', data: null, error: null })
	const [speedtestServers, setSpeedtestServers] = useState<SpeedtestServer[]>([])
	const [selectedServer, setSelectedServer] = useState<number | null>(null)
	const [loadingServers, setLoadingServers] = useState(false)
	const lastLoadedInstanceId = useRef<number | null>(null)
	const [dns, setDns] = useState<CardState<DnsInfo>>({ status: 'idle', data: null, error: null })
	const [ifaces, setIfaces] = useState<CardState<NetworkInterface[]>>({ status: 'idle', data: null, error: null })
	const [command, setCommand] = useState('')
	const [commandHistory, setCommandHistory] = useState<string[]>([])
	const [commandResult, setCommandResult] = useState<CardState<{ output: string; error?: string }>>({
		status: 'idle',
		data: null,
		error: null,
	})

	useEffect(() => {
		if (!selectedInstance) {
			setAgentOnline(null)
			return
		}
		checkAgentHealth(selectedInstance.id).then(setAgentOnline)
	}, [selectedInstance])

	useEffect(() => {
		if (!selectedInstance || !agentOnline || loadingServers || speedtestServers.length !== 0) return
		if (lastLoadedInstanceId.current === selectedInstance.id) return
		lastLoadedInstanceId.current = selectedInstance.id

		let cancelled = false
		setLoadingServers(true)
		void (async () => {
			try {
				const data = await getSpeedtestServers(selectedInstance.id)
				if (!cancelled) setSpeedtestServers(data.servers || [])
			} catch {
				if (!cancelled) setSpeedtestServers([])
			} finally {
				if (!cancelled) setLoadingServers(false)
			}
		})()

		return () => {
			cancelled = true
		}
	}, [selectedInstance, agentOnline, loadingServers, speedtestServers.length])

	async function handleRunIpInfo() {
		if (!selectedInstance) return
		setIpInfo((prev) => ({ ...prev, status: 'loading', error: null }))
		try {
			const data = await getIpInfo(selectedInstance.id)
			setIpInfo({ status: 'success', data, error: null })
		} catch (e) {
			setIpInfo((prev) => ({ ...prev, status: 'error', error: e instanceof Error ? e.message : 'Failed' }))
		}
	}

	async function handleRunSpeedtest() {
		if (!selectedInstance) return
		setSpeedtest({ status: 'loading', data: null, error: null })
		try {
			const data = await runSpeedtest(selectedInstance.id, selectedServer || undefined)
			setSpeedtest({ status: 'success', data, error: null })
		} catch (e) {
			setSpeedtest({ status: 'error', data: null, error: e instanceof Error ? e.message : 'Failed' })
		}
	}

	async function handleRunDns() {
		if (!selectedInstance) return
		setDns((prev) => ({ ...prev, status: 'loading', error: null }))
		try {
			const data = await getDnsInfo(selectedInstance.id)
			setDns({ status: 'success', data, error: null })
		} catch (e) {
			setDns((prev) => ({ ...prev, status: 'error', error: e instanceof Error ? e.message : 'Failed' }))
		}
	}

	async function handleRunInterfaces() {
		if (!selectedInstance) return
		setIfaces((prev) => ({ ...prev, status: 'loading', error: null }))
		try {
			const data = await getInterfaces(selectedInstance.id)
			setIfaces({ status: 'success', data, error: null })
		} catch (e) {
			setIfaces((prev) => ({ ...prev, status: 'error', error: e instanceof Error ? e.message : 'Failed' }))
		}
	}

	async function handleRunCommand() {
		if (!selectedInstance || !command.trim()) return
		const cmd = command.trim()
		setCommandResult({ status: 'loading', data: null, error: null })
		setCommandHistory((h) => [cmd, ...h.filter((c) => c !== cmd)].slice(0, 10))
		try {
			const data = await execCommand(selectedInstance.id, cmd)
			setCommandResult({ status: 'success', data, error: null })
		} catch (e) {
			setCommandResult({ status: 'error', data: null, error: e instanceof Error ? e.message : 'Failed' })
		}
	}

	if (agentInstances.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-20">
				<div
					className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
					style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
				>
					<Network className="w-8 h-8" style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
				</div>
				<h2 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
					No Agent Configured
				</h2>
				<p className="text-sm mb-6 text-center max-w-md" style={{ color: 'var(--text-muted)' }}>
					Enable net-agent on an instance to run network diagnostics from your qBittorrent host
				</p>
				<a
					href="https://maciejonos.github.io/qbitwebui/guide/network-agent/"
					target="_blank"
					rel="noopener noreferrer"
					className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
					style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
				>
					Setup Guide
				</a>
			</div>
		)
	}

	const canRun = selectedInstance && agentOnline
	const serverOptions = [
		{ value: 0, label: loadingServers ? 'Loading...' : 'Auto (nearest)' },
		...speedtestServers.map((s) => ({ value: s.id, label: `${s.name} - ${s.location}` })),
	]

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
						Network Diagnostics
					</h1>
					<p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
						Run tests from your qBittorrent instance's network
					</p>
				</div>
				<div className="flex items-center gap-3">
					{agentOnline !== null && (
						<div
							className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
							style={{ backgroundColor: 'var(--bg-tertiary)' }}
						>
							<div
								className="w-2 h-2 rounded-full"
								style={{ backgroundColor: agentOnline ? '#a6e3a1' : 'var(--error)' }}
							/>
							<span className="text-xs" style={{ color: agentOnline ? '#a6e3a1' : 'var(--error)' }}>
								{agentOnline ? 'Agent Online' : 'Agent Offline'}
							</span>
						</div>
					)}
					{agentInstances.length > 1 && (
						<Select
							value={selectedInstance?.id || 0}
							options={agentInstances.map((i) => ({ value: i.id, label: i.label }))}
							onChange={(v) => {
								const inst = agentInstances.find((i) => i.id === v)
								setSelectedInstance(inst || null)
								setAgentOnline(null)
								setSpeedtestServers([])
							}}
							minWidth="160px"
						/>
					)}
				</div>
			</div>

			{agentOnline === false && (
				<div
					className="px-4 py-3 rounded-lg text-sm flex items-center gap-3"
					style={{
						backgroundColor: 'color-mix(in srgb, var(--error) 8%, transparent)',
						border: '1px solid color-mix(in srgb, var(--error) 20%, transparent)',
					}}
				>
					<Activity className="w-4 h-4 shrink-0" style={{ color: 'var(--error)' }} />
					<span style={{ color: 'var(--error)' }}>
						Cannot connect to agent on port 9999. Ensure net-agent is running on the qBittorrent host.
					</span>
				</div>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
				<div
					className="rounded-xl"
					style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
				>
					<div
						className="px-4 py-3 flex items-center justify-between rounded-t-xl"
						style={{ borderBottom: '1px solid var(--border)' }}
					>
						<div className="flex items-center gap-2.5">
							<Globe className="w-4 h-4" style={{ color: 'var(--accent)' }} strokeWidth={2} />
							<span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
								External IP
							</span>
						</div>
						<RunButton onClick={handleRunIpInfo} disabled={!canRun} loading={ipInfo.status === 'loading'} />
					</div>
					<div className="p-4 min-h-[140px] rounded-b-xl" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
						{!ipInfo.data && ipInfo.status !== 'error' && (
							<p className="text-xs" style={{ color: 'var(--text-muted)' }}>
								Click Run to fetch IP information
							</p>
						)}
						{ipInfo.status === 'error' && !ipInfo.data && (
							<p className="text-xs" style={{ color: 'var(--error)' }}>
								{ipInfo.error}
							</p>
						)}
						{ipInfo.data && (
							<div className="space-y-3">
								<div className="text-2xl font-mono font-semibold tracking-tight" style={{ color: 'var(--accent)' }}>
									{ipInfo.data.ip}
								</div>
								<div className="space-y-1.5">
									<div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
										<MapPin className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
										{ipInfo.data.city}, {ipInfo.data.region}, {ipInfo.data.country}
									</div>
									<div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
										<Building2 className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
										{ipInfo.data.org}
									</div>
									<div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
										<Clock className="w-3 h-3" />
										{ipInfo.data.timezone}
									</div>
								</div>
							</div>
						)}
					</div>
				</div>

				<div
					className="rounded-xl"
					style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
				>
					<div
						className="px-4 py-3 flex items-center justify-between rounded-t-xl"
						style={{ borderBottom: '1px solid var(--border)' }}
					>
						<div className="flex items-center gap-2.5">
							<Server className="w-4 h-4" style={{ color: 'var(--accent)' }} strokeWidth={2} />
							<span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
								DNS
							</span>
						</div>
						<RunButton onClick={handleRunDns} disabled={!canRun} loading={dns.status === 'loading'} />
					</div>
					<div className="p-4 min-h-[140px] rounded-b-xl" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
						{!dns.data && dns.status !== 'error' && (
							<p className="text-xs" style={{ color: 'var(--text-muted)' }}>
								Click Run to show DNS servers
							</p>
						)}
						{dns.status === 'error' && !dns.data && (
							<p className="text-xs" style={{ color: 'var(--error)' }}>
								{dns.error}
							</p>
						)}
						{dns.data && (
							<div className="space-y-2">
								{dns.data.servers.map((server, i) => (
									<div
										key={i}
										className="flex items-center gap-2 px-3 py-2 rounded-lg"
										style={{ backgroundColor: 'var(--bg-secondary)' }}
									>
										<div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
										<span className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
											{server}
										</span>
									</div>
								))}
								{dns.data.servers.length === 0 && (
									<p className="text-xs" style={{ color: 'var(--text-muted)' }}>
										No DNS servers found
									</p>
								)}
							</div>
						)}
					</div>
				</div>

				<div
					className="rounded-xl"
					style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
				>
					<div
						className="px-4 py-3 flex items-center justify-between rounded-t-xl"
						style={{ borderBottom: '1px solid var(--border)' }}
					>
						<div className="flex items-center gap-2.5">
							<Network className="w-4 h-4" style={{ color: 'var(--accent)' }} strokeWidth={2} />
							<span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
								Interfaces
							</span>
						</div>
						<RunButton onClick={handleRunInterfaces} disabled={!canRun} loading={ifaces.status === 'loading'} />
					</div>
					<div className="p-4 min-h-[140px] rounded-b-xl" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
						{!ifaces.data && ifaces.status !== 'error' && (
							<p className="text-xs" style={{ color: 'var(--text-muted)' }}>
								Click Run to list network interfaces
							</p>
						)}
						{ifaces.status === 'error' && !ifaces.data && (
							<p className="text-xs" style={{ color: 'var(--error)' }}>
								{ifaces.error}
							</p>
						)}
						{ifaces.data && (
							<div className="space-y-2">
								{ifaces.data
									.filter((iface) => iface.addr_info?.some((a) => a.family === 'inet'))
									.map((iface) => (
										<div
											key={iface.ifname}
											className="flex items-center justify-between px-3 py-2 rounded-lg"
											style={{ backgroundColor: 'var(--bg-secondary)' }}
										>
											<div className="flex items-center gap-2">
												<span
													className="w-2 h-2 rounded-full"
													style={{ backgroundColor: iface.operstate === 'UP' ? '#a6e3a1' : 'var(--text-muted)' }}
												/>
												<span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
													{iface.ifname}
												</span>
											</div>
											<span className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
												{iface.addr_info?.find((a) => a.family === 'inet')?.local}
											</span>
										</div>
									))}
							</div>
						)}
					</div>
				</div>
			</div>

			<div className="rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
				<div
					className="px-4 py-3 flex items-center justify-between relative z-10 rounded-t-xl"
					style={{ borderBottom: '1px solid var(--border)' }}
				>
					<div className="flex items-center gap-2.5">
						<Gauge className="w-4 h-4" style={{ color: 'var(--accent)' }} strokeWidth={2} />
						<span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
							Speedtest
						</span>
						<span
							className="text-xs px-1.5 py-0.5 rounded"
							style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
						>
							Ookla
						</span>
					</div>
					<div className="flex items-center gap-2">
						<Select
							value={selectedServer || 0}
							options={serverOptions}
							onChange={(v) => setSelectedServer(v || null)}
							minWidth="180px"
						/>
						<RunButton onClick={handleRunSpeedtest} disabled={!canRun} loading={speedtest.status === 'loading'} />
					</div>
				</div>
				<div className="p-4 min-h-[140px] rounded-b-xl" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
					{speedtest.status === 'idle' && (
						<p className="text-xs" style={{ color: 'var(--text-muted)' }}>
							Select a server or use auto-detection, then click Run
						</p>
					)}
					{speedtest.status === 'loading' && (
						<div className="flex items-center gap-4">
							<div className="relative w-20 h-20">
								<svg className="w-20 h-20 -rotate-90">
									<circle cx="40" cy="40" r="36" fill="none" stroke="var(--border)" strokeWidth="6" />
									<circle
										cx="40"
										cy="40"
										r="36"
										fill="none"
										stroke="var(--accent)"
										strokeWidth="6"
										strokeDasharray="226"
										strokeDashoffset="56"
										strokeLinecap="round"
										className="animate-spin"
										style={{ transformOrigin: 'center', animationDuration: '1.5s' }}
									/>
								</svg>
								<Zap
									className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
									style={{ color: 'var(--accent)' }}
								/>
							</div>
							<div>
								<p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
									Running speedtest...
								</p>
								<p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
									This typically takes 30-60 seconds
								</p>
							</div>
						</div>
					)}
					{speedtest.status === 'error' && (
						<p className="text-xs" style={{ color: 'var(--error)' }}>
							{speedtest.error}
						</p>
					)}
					{speedtest.status === 'success' && speedtest.data && (
						<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
							<div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
								<div className="flex items-center gap-2 mb-2">
									<ArrowDown className="w-4 h-4" style={{ color: 'var(--accent)' }} />
									<span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
										Download
									</span>
								</div>
								<div className="flex items-baseline gap-1">
									<span className="text-3xl font-mono font-bold" style={{ color: 'var(--accent)' }}>
										{formatBandwidth(speedtest.data.download.bandwidth)}
									</span>
									<span className="text-sm" style={{ color: 'var(--text-muted)' }}>
										Mbps
									</span>
								</div>
							</div>
							<div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
								<div className="flex items-center gap-2 mb-2">
									<ArrowUp className="w-4 h-4" style={{ color: '#a6e3a1' }} />
									<span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
										Upload
									</span>
								</div>
								<div className="flex items-baseline gap-1">
									<span className="text-3xl font-mono font-bold" style={{ color: '#a6e3a1' }}>
										{formatBandwidth(speedtest.data.upload.bandwidth)}
									</span>
									<span className="text-sm" style={{ color: 'var(--text-muted)' }}>
										Mbps
									</span>
								</div>
							</div>
							<div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
								<div className="flex items-center gap-2 mb-2">
									<Activity className="w-4 h-4" style={{ color: 'var(--warning)' }} />
									<span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
										Ping
									</span>
								</div>
								<div className="flex items-baseline gap-1">
									<span className="text-3xl font-mono font-bold" style={{ color: 'var(--warning)' }}>
										{speedtest.data.ping.latency.toFixed(0)}
									</span>
									<span className="text-sm" style={{ color: 'var(--text-muted)' }}>
										ms
									</span>
								</div>
							</div>
							<div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
								<div className="flex items-center gap-2 mb-2">
									<Server className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
									<span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
										Server
									</span>
								</div>
								<div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
									{speedtest.data.server.name}
								</div>
								<div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
									{speedtest.data.server.location} · {speedtest.data.isp}
								</div>
							</div>
						</div>
					)}
				</div>
			</div>

			<div className="rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
				<div
					className="px-4 py-3 flex items-center justify-between rounded-t-xl"
					style={{ borderBottom: '1px solid var(--border)' }}
				>
					<div className="flex items-center gap-2.5">
						<Terminal className="w-4 h-4" style={{ color: 'var(--accent)' }} strokeWidth={2} />
						<span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
							Terminal
						</span>
					</div>
					<div className="flex items-center gap-2">
						{['ping', 'dig', 'traceroute', 'curl'].map((cmd) => (
							<button
								key={cmd}
								onClick={() => setCommand(cmd + ' ')}
								className="px-2 py-1 rounded text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
								style={{ color: 'var(--text-muted)' }}
							>
								{cmd}
							</button>
						))}
					</div>
				</div>
				<div className="p-4 rounded-b-xl" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
					<form
						onSubmit={(e) => {
							e.preventDefault()
							handleRunCommand()
						}}
						className="flex gap-2 mb-3"
					>
						<div className="flex-1 relative">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }}>
								$
							</span>
							<input
								type="text"
								value={command}
								onChange={(e) => setCommand(e.target.value)}
								placeholder="ping 8.8.8.8 -c 4"
								disabled={!canRun || commandResult.status === 'loading'}
								className="w-full pl-7 pr-3 py-2.5 rounded-lg text-sm font-mono"
								style={{
									backgroundColor: 'var(--bg-primary)',
									border: '1px solid var(--border)',
									color: 'var(--text-primary)',
								}}
								list="cmd-history"
							/>
							{commandHistory.length > 0 && (
								<datalist id="cmd-history">
									{commandHistory.map((c, i) => (
										<option key={i} value={c} />
									))}
								</datalist>
							)}
						</div>
						<button
							type="submit"
							disabled={!canRun || commandResult.status === 'loading' || !command.trim()}
							className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40 flex items-center gap-2"
							style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
						>
							{commandResult.status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Execute'}
						</button>
					</form>
					<div
						className="rounded-lg p-4 min-h-[120px] max-h-[400px] overflow-auto font-mono text-xs leading-relaxed"
						style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}
					>
						{commandResult.status === 'idle' && (
							<span style={{ color: 'var(--text-muted)' }}>
								Allowed commands: ping, dig, nslookup, traceroute, curl, wget
							</span>
						)}
						{commandResult.status === 'loading' && (
							<div className="flex items-center gap-2">
								<Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--accent)' }} />
								<span style={{ color: 'var(--text-muted)' }}>Executing...</span>
							</div>
						)}
						{commandResult.status === 'error' && <span style={{ color: 'var(--error)' }}>{commandResult.error}</span>}
						{commandResult.status === 'success' && commandResult.data && (
							<>
								<pre className="whitespace-pre-wrap break-all" style={{ color: 'var(--text-secondary)' }}>
									{commandResult.data.output || '(no output)'}
								</pre>
								{commandResult.data.error && (
									<div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)', color: 'var(--warning)' }}>
										Exit: {commandResult.data.error}
									</div>
								)}
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
