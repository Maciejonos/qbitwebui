export interface Instance {
	id: number
	label: string
	url: string
	qbt_username: string | null
	skip_auth: boolean
	agent_enabled: boolean
	created_at: number
}

export interface CreateInstanceData {
	label: string
	url: string
	qbt_username?: string
	qbt_password?: string
	skip_auth?: boolean
	agent_enabled?: boolean
}

export interface UpdateInstanceData {
	label?: string
	url?: string
	qbt_username?: string
	qbt_password?: string
	skip_auth?: boolean
	agent_enabled?: boolean
}

export async function getInstances(): Promise<Instance[]> {
	const res = await fetch('/api/instances', {
		credentials: 'include',
	})
	if (!res.ok) throw new Error('Failed to fetch instances')
	return res.json()
}

export async function createInstance(data: CreateInstanceData): Promise<Instance> {
	const res = await fetch('/api/instances', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(data),
	})
	if (!res.ok) {
		const error = await res.json()
		throw new Error(error.error || 'Failed to create instance')
	}
	return res.json()
}

export async function updateInstance(id: number, data: UpdateInstanceData): Promise<Instance> {
	const res = await fetch(`/api/instances/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(data),
	})
	if (!res.ok) {
		const error = await res.json()
		throw new Error(error.error || 'Failed to update instance')
	}
	return res.json()
}

export async function deleteInstance(id: number): Promise<void> {
	const res = await fetch(`/api/instances/${id}`, {
		method: 'DELETE',
		credentials: 'include',
	})
	if (!res.ok) throw new Error('Failed to delete instance')
}
