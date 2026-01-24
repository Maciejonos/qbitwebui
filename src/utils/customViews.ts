import type { CustomView, CustomViewsStorage } from '../types/views'
import type { TorrentFilter } from '../types/qbittorrent'
import type { SortKey } from '../components/columns'
import { COLUMNS } from '../components/columns'

const STORAGE_KEY = 'customViews'

const DEFAULT_STORAGE: CustomViewsStorage = {
	views: [],
	activeViewId: null,
}

export function loadCustomViews(): CustomViewsStorage {
	const stored = localStorage.getItem(STORAGE_KEY)
	if (!stored) return DEFAULT_STORAGE
	try {
		const parsed = JSON.parse(stored) as CustomViewsStorage
		const knownColumns = new Set(COLUMNS.map((c) => c.id))
		parsed.views = parsed.views.map((view) => ({
			...view,
			visibleColumns: view.visibleColumns.filter((id) => knownColumns.has(id)),
			columnOrder: view.columnOrder.filter((id) => knownColumns.has(id)),
		}))
		return parsed
	} catch {
		return DEFAULT_STORAGE
	}
}

export function saveCustomViews(storage: CustomViewsStorage): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(storage))
}

export function createView(
	name: string,
	config: {
		sortKey: SortKey
		sortAsc: boolean
		visibleColumns: Set<string>
		columnOrder: string[]
		columnWidths: Record<string, number>
		filter: TorrentFilter
		categoryFilter: string | null
		tagFilter: string | null
		trackerFilter: string | null
		search: string
	}
): CustomView {
	return {
		id: crypto.randomUUID(),
		name: name.trim(),
		sortKey: config.sortKey,
		sortAsc: config.sortAsc,
		visibleColumns: [...config.visibleColumns],
		columnOrder: config.columnOrder,
		columnWidths: config.columnWidths,
		filter: config.filter,
		categoryFilter: config.categoryFilter,
		tagFilter: config.tagFilter,
		trackerFilter: config.trackerFilter,
		search: config.search,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	}
}

export function viewsAreEqual(
	view: CustomView,
	current: {
		sortKey: SortKey
		sortAsc: boolean
		visibleColumns: Set<string>
		columnOrder: string[]
		columnWidths: Record<string, number>
		filter: TorrentFilter
		categoryFilter: string | null
		tagFilter: string | null
		trackerFilter: string | null
		search: string
	}
): boolean {
	if (view.sortKey !== current.sortKey) return false
	if (view.sortAsc !== current.sortAsc) return false
	if (view.filter !== current.filter) return false
	if (view.categoryFilter !== current.categoryFilter) return false
	if (view.tagFilter !== current.tagFilter) return false
	if (view.trackerFilter !== current.trackerFilter) return false
	if (view.search !== current.search) return false
	if (view.visibleColumns.length !== current.visibleColumns.size) return false
	if (!view.visibleColumns.every((c) => current.visibleColumns.has(c))) return false
	if (JSON.stringify(view.columnOrder) !== JSON.stringify(current.columnOrder)) return false
	if (JSON.stringify(view.columnWidths) !== JSON.stringify(current.columnWidths)) return false
	return true
}
