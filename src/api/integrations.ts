export interface Integration {
	id: number
	type: string
	label: string
	url: string
	created_at: number
}

export interface CreateIntegrationData {
	type: string
	label: string
	url: string
	api_key: string
}

export interface Indexer {
	id: number
	name: string
	enable: boolean
	protocol: string
}

export interface ProwlarrCategory {
	id: number
	name: string
	subCategories?: ProwlarrCategory[]
}

export interface SearchResult {
	guid: string
	indexerId: number
	indexer: string
	title: string
	size: number
	publishDate: string
	downloadUrl?: string
	magnetUrl?: string
	seeders?: number
	leechers?: number
	categories: { id: number; name: string }[]
	indexerFlags?: string[]
}

export async function getIntegrations(): Promise<Integration[]> {
	const res = await fetch('/api/integrations', { credentials: 'include' })
	if (!res.ok) throw new Error('Failed to fetch integrations')
	return res.json()
}

export async function createIntegration(data: CreateIntegrationData): Promise<Integration> {
	const res = await fetch('/api/integrations', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(data),
	})
	if (!res.ok) {
		const err = await res.json()
		throw new Error(err.error || 'Failed to create integration')
	}
	return res.json()
}

export async function deleteIntegration(id: number): Promise<void> {
	const res = await fetch(`/api/integrations/${id}`, {
		method: 'DELETE',
		credentials: 'include',
	})
	if (!res.ok) throw new Error('Failed to delete integration')
}

export async function testIntegrationConnection(
	url: string,
	apiKey: string
): Promise<{ success: boolean; version?: string; error?: string }> {
	const res = await fetch('/api/integrations/test', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({ url, api_key: apiKey }),
	})
	if (!res.ok) {
		const err = await res.json().catch(() => ({}))
		return { success: false, error: err.error || 'Connection test failed' }
	}
	return res.json()
}

export async function getIndexers(integrationId: number): Promise<Indexer[]> {
	const res = await fetch(`/api/integrations/${integrationId}/indexers`, { credentials: 'include' })
	if (!res.ok) throw new Error('Failed to fetch indexers')
	return res.json()
}

export async function getProwlarrCategories(integrationId: number): Promise<ProwlarrCategory[]> {
	const res = await fetch(`/api/integrations/${integrationId}/categories`, { credentials: 'include' })
	if (!res.ok) throw new Error('Failed to fetch categories')
	return res.json()
}

export async function search(
	integrationId: number,
	query: string,
	options: { indexerIds?: string; categories?: string; type?: string } = {}
): Promise<SearchResult[]> {
	const params = new URLSearchParams({ query })
	if (options.indexerIds) params.set('indexerIds', options.indexerIds)
	if (options.categories) params.set('categories', options.categories)
	if (options.type) params.set('type', options.type)

	const res = await fetch(`/api/integrations/${integrationId}/search?${params}`, { credentials: 'include' })
	if (!res.ok) {
		const err = await res.json()
		throw new Error(err.error || 'Search failed')
	}
	return res.json()
}

export async function grabRelease(
	integrationId: number,
	release: { guid: string; indexerId: number; downloadUrl?: string; magnetUrl?: string },
	instanceId: number,
	options?: { category?: string; savepath?: string }
): Promise<void> {
	const res = await fetch(`/api/integrations/${integrationId}/grab`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({ ...release, instanceId, ...options }),
	})
	if (!res.ok) {
		const err = await res.json()
		throw new Error(err.error || 'Failed to grab release')
	}
}
