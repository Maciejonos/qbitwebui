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
	ChevronLeft,
	ChevronDown,
	ChevronUp,
} from 'lucide-react'
import type { Instance } from '../api/instances'
import { Select } from '../components/ui'
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
	onBack: () => void
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

export function MobileNetworkTools({ instances, onBack }: Props) {
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
	const [expandedCard, setExpandedCard] = useState<string | null>(null)

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

	const canRun = selectedInstance && agentOnline
	const serverOptions = [
		{ value: 0, label: loadingServers ? 'Loading...' : 'Auto (nearest)' },
		...speedtestServers.map((s) => ({ value: s.id, label: `${s.name} - ${s.location}` })),
	]

	if (agentInstances.length === 0) {
		return (
			<div className="flex flex-col h-full">
				<div className="p-4">
					<div className="flex items-center gap-3">
						<button onClick={onBack} className="p-2 -ml-2 rounded-xl active:bg-[var(--bg-tertiary)]">
							<ChevronLeft className="w-5 h-5" style={{ color: 'var(--text-primary)' }} strokeWidth={2} />
						</button>
						<div className="flex-1">
							<h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
								Network Tools
							</h2>
						</div>
					</div>
				</div>
				<div className="flex-1 flex flex-col items-center justify-center p-6">
					<div
						className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
						style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
					>
						<Network className="w-8 h-8" style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
					</div>
					<h3 className="text-base font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
						No Agent Configured
					</h3>
					<p className="text-sm text-center mb-6" style={{ color: 'var(--text-muted)' }}>
						Enable net-agent on an instance to run network diagnostics
					</p>
					<a
						href="https://maciejonos.github.io/qbitwebui/guide/network-agent/"
						target="_blank"
						rel="noopener noreferrer"
						className="px-5 py-2.5 rounded-xl text-sm font-medium"
						style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
					>
						Setup Guide
					</a>
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full">
			<div className="p-4 space-y-3">
				<div className="flex items-center gap-3">
					<button onClick={onBack} className="p-2 -ml-2 rounded-xl active:bg-[var(--bg-tertiary)]">
						<ChevronLeft className="w-5 h-5" style={{ color: 'var(--text-primary)' }} strokeWidth={2} />
					</button>
					<div className="flex-1">
						<h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
							Network Tools
						</h2>
						<p className="text-xs" style={{ color: 'var(--text-muted)' }}>
							Run tests from your instance
						</p>
					</div>
					{agentOnline !== null && (
						<div
							className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
							style={{ backgroundColor: 'var(--bg-tertiary)' }}
						>
							<div
								className="w-2 h-2 rounded-full"
								style={{ backgroundColor: agentOnline ? '#a6e3a1' : 'var(--error)' }}
							/>
							<span className="text-xs" style={{ color: agentOnline ? '#a6e3a1' : 'var(--error)' }}>
								{agentOnline ? 'Online' : 'Offline'}
							</span>
						</div>
					)}
				</div>

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
					/>
				)}

				{agentOnline === false && (
					<div
						className="px-4 py-3 rounded-xl text-sm flex items-center gap-3"
						style={{
							backgroundColor: 'color-mix(in srgb, var(--error) 8%, transparent)',
							border: '1px solid color-mix(in srgb, var(--error) 20%, transparent)',
						}}
					>
						<Activity className="w-4 h-4 shrink-0" style={{ color: 'var(--error)' }} />
						<span className="text-xs" style={{ color: 'var(--error)' }}>
							Agent not reachable. Ensure net-agent is running.
						</span>
					</div>
				)}
			</div>

			<div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
				<div
					className="rounded-xl overflow-hidden"
					style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
				>
					<button
						onClick={() => setExpandedCard(expandedCard === 'ip' ? null : 'ip')}
						className="w-full px-4 py-3 flex items-center justify-between active:bg-[var(--bg-tertiary)]"
					>
						<div className="flex items-center gap-2.5">
							<Globe className="w-4 h-4" style={{ color: 'var(--accent)' }} strokeWidth={2} />
							<span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
								External IP
							</span>
							{ipInfo.data && (
								<span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>
									{ipInfo.data.ip}
								</span>
							)}
						</div>
						{expandedCard === 'ip' ? (
							<ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
						) : (
							<ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
						)}
					</button>
					{expandedCard === 'ip' && (
						<div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
							<button
								onClick={handleRunIpInfo}
								disabled={!canRun || ipInfo.status === 'loading'}
								className="w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
								style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
							>
								{ipInfo.status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch IP Info'}
							</button>
							{ipInfo.status === 'error' && (
								<p className="text-xs" style={{ color: 'var(--error)' }}>
									{ipInfo.error}
								</p>
							)}
							{ipInfo.data && (
								<div className="space-y-2 pt-2">
									<div className="text-xl font-mono font-semibold tracking-tight" style={{ color: 'var(--accent)' }}>
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
					)}
				</div>

				<div
					className="rounded-xl overflow-hidden"
					style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
				>
					<button
						onClick={() => setExpandedCard(expandedCard === 'dns' ? null : 'dns')}
						className="w-full px-4 py-3 flex items-center justify-between active:bg-[var(--bg-tertiary)]"
					>
						<div className="flex items-center gap-2.5">
							<Server className="w-4 h-4" style={{ color: 'var(--accent)' }} strokeWidth={2} />
							<span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
								DNS Servers
							</span>
							{dns.data && (
								<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
									{dns.data.servers.length} found
								</span>
							)}
						</div>
						{expandedCard === 'dns' ? (
							<ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
						) : (
							<ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
						)}
					</button>
					{expandedCard === 'dns' && (
						<div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
							<button
								onClick={handleRunDns}
								disabled={!canRun || dns.status === 'loading'}
								className="w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
								style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
							>
								{dns.status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch DNS'}
							</button>
							{dns.status === 'error' && (
								<p className="text-xs" style={{ color: 'var(--error)' }}>
									{dns.error}
								</p>
							)}
							{dns.data && (
								<div className="space-y-2 pt-2">
									{dns.data.servers.map((server, i) => (
										<div
											key={i}
											className="flex items-center gap-2 px-3 py-2 rounded-lg"
											style={{ backgroundColor: 'var(--bg-tertiary)' }}
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
					)}
				</div>

				<div
					className="rounded-xl overflow-hidden"
					style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
				>
					<button
						onClick={() => setExpandedCard(expandedCard === 'ifaces' ? null : 'ifaces')}
						className="w-full px-4 py-3 flex items-center justify-between active:bg-[var(--bg-tertiary)]"
					>
						<div className="flex items-center gap-2.5">
							<Network className="w-4 h-4" style={{ color: 'var(--accent)' }} strokeWidth={2} />
							<span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
								Interfaces
							</span>
							{ifaces.data && (
								<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
									{ifaces.data.filter((i) => i.addr_info?.some((a) => a.family === 'inet')).length} active
								</span>
							)}
						</div>
						{expandedCard === 'ifaces' ? (
							<ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
						) : (
							<ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
						)}
					</button>
					{expandedCard === 'ifaces' && (
						<div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
							<button
								onClick={handleRunInterfaces}
								disabled={!canRun || ifaces.status === 'loading'}
								className="w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
								style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
							>
								{ifaces.status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'List Interfaces'}
							</button>
							{ifaces.status === 'error' && (
								<p className="text-xs" style={{ color: 'var(--error)' }}>
									{ifaces.error}
								</p>
							)}
							{ifaces.data && (
								<div className="space-y-2 pt-2">
									{ifaces.data
										.filter((iface) => iface.addr_info?.some((a) => a.family === 'inet'))
										.map((iface) => (
											<div
												key={iface.ifname}
												className="flex items-center justify-between px-3 py-2 rounded-lg"
												style={{ backgroundColor: 'var(--bg-tertiary)' }}
											>
												<div className="flex items-center gap-2">
													<span
														className="w-2 h-2 rounded-full"
														style={{
															backgroundColor: iface.operstate === 'UP' ? '#a6e3a1' : 'var(--text-muted)',
														}}
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
					)}
				</div>

				<div
					className="rounded-xl overflow-hidden"
					style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
				>
					<button
						onClick={() => setExpandedCard(expandedCard === 'speedtest' ? null : 'speedtest')}
						className="w-full px-4 py-3 flex items-center justify-between active:bg-[var(--bg-tertiary)]"
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
						{expandedCard === 'speedtest' ? (
							<ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
						) : (
							<ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
						)}
					</button>
					{expandedCard === 'speedtest' && (
						<div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
							<Select
								value={selectedServer || 0}
								options={serverOptions}
								onChange={(v) => setSelectedServer(v || null)}
							/>
							<button
								onClick={handleRunSpeedtest}
								disabled={!canRun || speedtest.status === 'loading'}
								className="w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
								style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
							>
								{speedtest.status === 'loading' ? (
									<>
										<Loader2 className="w-4 h-4 animate-spin" />
										Running...
									</>
								) : (
									'Run Speedtest'
								)}
							</button>
							{speedtest.status === 'loading' && (
								<div className="flex items-center gap-3 pt-2">
									<div className="relative w-12 h-12">
										<svg className="w-12 h-12 -rotate-90">
											<circle cx="24" cy="24" r="20" fill="none" stroke="var(--border)" strokeWidth="4" />
											<circle
												cx="24"
												cy="24"
												r="20"
												fill="none"
												stroke="var(--accent)"
												strokeWidth="4"
												strokeDasharray="125"
												strokeDashoffset="30"
												strokeLinecap="round"
												className="animate-spin"
												style={{ transformOrigin: 'center', animationDuration: '1.5s' }}
											/>
										</svg>
										<Zap
											className="w-4 h-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
											style={{ color: 'var(--accent)' }}
										/>
									</div>
									<p className="text-xs" style={{ color: 'var(--text-muted)' }}>
										This typically takes 30-60 seconds
									</p>
								</div>
							)}
							{speedtest.status === 'error' && (
								<p className="text-xs" style={{ color: 'var(--error)' }}>
									{speedtest.error}
								</p>
							)}
							{speedtest.status === 'success' && speedtest.data && (
								<div className="grid grid-cols-2 gap-2 pt-2">
									<div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
										<div className="flex items-center gap-1.5 mb-1">
											<ArrowDown className="w-3 h-3" style={{ color: 'var(--accent)' }} />
											<span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
												Down
											</span>
										</div>
										<div className="flex items-baseline gap-1">
											<span className="text-2xl font-mono font-bold" style={{ color: 'var(--accent)' }}>
												{formatBandwidth(speedtest.data.download.bandwidth)}
											</span>
											<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
												Mbps
											</span>
										</div>
									</div>
									<div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
										<div className="flex items-center gap-1.5 mb-1">
											<ArrowUp className="w-3 h-3" style={{ color: '#a6e3a1' }} />
											<span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
												Up
											</span>
										</div>
										<div className="flex items-baseline gap-1">
											<span className="text-2xl font-mono font-bold" style={{ color: '#a6e3a1' }}>
												{formatBandwidth(speedtest.data.upload.bandwidth)}
											</span>
											<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
												Mbps
											</span>
										</div>
									</div>
									<div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
										<div className="flex items-center gap-1.5 mb-1">
											<Activity className="w-3 h-3" style={{ color: 'var(--warning)' }} />
											<span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
												Ping
											</span>
										</div>
										<div className="flex items-baseline gap-1">
											<span className="text-2xl font-mono font-bold" style={{ color: 'var(--warning)' }}>
												{speedtest.data.ping.latency.toFixed(0)}
											</span>
											<span className="text-xs" style={{ color: 'var(--text-muted)' }}>
												ms
											</span>
										</div>
									</div>
									<div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
										<div className="flex items-center gap-1.5 mb-1">
											<Server className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
											<span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
												Server
											</span>
										</div>
										<div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
											{speedtest.data.server.name}
										</div>
										<div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
											{speedtest.data.server.location}
										</div>
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				<div
					className="rounded-xl overflow-hidden"
					style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
				>
					<button
						onClick={() => setExpandedCard(expandedCard === 'terminal' ? null : 'terminal')}
						className="w-full px-4 py-3 flex items-center justify-between active:bg-[var(--bg-tertiary)]"
					>
						<div className="flex items-center gap-2.5">
							<Terminal className="w-4 h-4" style={{ color: 'var(--accent)' }} strokeWidth={2} />
							<span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
								Terminal
							</span>
						</div>
						{expandedCard === 'terminal' ? (
							<ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
						) : (
							<ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
						)}
					</button>
					{expandedCard === 'terminal' && (
						<div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
							<div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
								{['ping', 'dig', 'traceroute', 'curl'].map((cmd) => (
									<button
										key={cmd}
										onClick={() => setCommand(cmd + ' ')}
										className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
										style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
									>
										{cmd}
									</button>
								))}
							</div>
							<form
								onSubmit={(e) => {
									e.preventDefault()
									handleRunCommand()
								}}
								className="space-y-2"
							>
								<div className="relative">
									<span
										className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
										style={{ color: 'var(--text-muted)' }}
									>
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
											backgroundColor: 'var(--bg-tertiary)',
											border: '1px solid var(--border)',
											color: 'var(--text-primary)',
											fontSize: '16px',
										}}
										list="cmd-history-mobile"
									/>
									{commandHistory.length > 0 && (
										<datalist id="cmd-history-mobile">
											{commandHistory.map((c, i) => (
												<option key={i} value={c} />
											))}
										</datalist>
									)}
								</div>
								<button
									type="submit"
									disabled={!canRun || commandResult.status === 'loading' || !command.trim()}
									className="w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
									style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
								>
									{commandResult.status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Execute'}
								</button>
							</form>
							<div
								className="rounded-lg p-3 max-h-[300px] overflow-auto font-mono text-xs leading-relaxed"
								style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
							>
								{commandResult.status === 'idle' && (
									<span style={{ color: 'var(--text-muted)' }}>ping, dig, nslookup, traceroute, curl, wget</span>
								)}
								{commandResult.status === 'loading' && (
									<div className="flex items-center gap-2">
										<Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--accent)' }} />
										<span style={{ color: 'var(--text-muted)' }}>Executing...</span>
									</div>
								)}
								{commandResult.status === 'error' && (
									<span style={{ color: 'var(--error)' }}>{commandResult.error}</span>
								)}
								{commandResult.status === 'success' && commandResult.data && (
									<>
										<pre className="whitespace-pre-wrap break-all" style={{ color: 'var(--text-secondary)' }}>
											{commandResult.data.output || '(no output)'}
										</pre>
										{commandResult.data.error && (
											<div
												className="mt-2 pt-2"
												style={{ borderTop: '1px solid var(--border)', color: 'var(--warning)' }}
											>
												Exit: {commandResult.data.error}
											</div>
										)}
									</>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
