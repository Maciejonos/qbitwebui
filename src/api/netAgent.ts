export interface IpInfo {
	ip: string
	city: string
	region: string
	country: string
	loc: string
	org: string
	postal: string
	timezone: string
}

export interface SpeedtestResult {
	type: string
	timestamp: string
	ping: { jitter: number; latency: number; low: number; high: number }
	download: { bandwidth: number; bytes: number; elapsed: number }
	upload: { bandwidth: number; bytes: number; elapsed: number }
	isp: string
	interface: { internalIp: string; name: string; externalIp: string; isVpn: boolean }
	server: { id: number; host: string; name: string; location: string; country: string }
	result: { url: string }
}

export interface SpeedtestServer {
	id: number
	host: string
	port: number
	name: string
	location: string
	country: string
}

export interface DnsInfo {
	servers: string[]
	raw: string
}

export interface NetworkInterface {
	ifindex: number
	ifname: string
	flags: string[]
	mtu: number
	operstate: string
	address: string
	addr_info: { family: string; local: string; prefixlen: number; scope: string }[]
}

async function agentRequest<T>(instanceId: number, endpoint: string): Promise<T> {
	const res = await fetch(`/api/instances/${instanceId}/agent${endpoint}`, {
		credentials: 'include',
	})
	if (!res.ok) {
		const text = await res.text()
		throw new Error(text || `Agent error: ${res.status}`)
	}
	return res.json()
}

export async function getIpInfo(instanceId: number): Promise<IpInfo> {
	return agentRequest<IpInfo>(instanceId, '/ip')
}

export async function runSpeedtest(instanceId: number, serverId?: number): Promise<SpeedtestResult> {
	const endpoint = serverId ? `/speedtest?server=${serverId}` : '/speedtest'
	return agentRequest<SpeedtestResult>(instanceId, endpoint)
}

export async function getSpeedtestServers(instanceId: number): Promise<{ servers: SpeedtestServer[] }> {
	return agentRequest<{ servers: SpeedtestServer[] }>(instanceId, '/speedtest/servers')
}

export async function getDnsInfo(instanceId: number): Promise<DnsInfo> {
	return agentRequest<DnsInfo>(instanceId, '/dns')
}

export async function getInterfaces(instanceId: number): Promise<NetworkInterface[]> {
	return agentRequest<NetworkInterface[]>(instanceId, '/interfaces')
}

export async function execCommand(instanceId: number, cmd: string): Promise<{ output: string; error?: string }> {
	return agentRequest<{ output: string; error?: string }>(instanceId, `/exec?cmd=${encodeURIComponent(cmd)}`)
}

export async function checkAgentHealth(instanceId: number): Promise<boolean> {
	try {
		const res = await fetch(`/api/instances/${instanceId}/agent/health`, {
			credentials: 'include',
		})
		return res.ok
	} catch {
		return false
	}
}
