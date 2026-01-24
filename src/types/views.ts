import type { TorrentFilter } from './qbittorrent'
import type { SortKey } from '../components/columns'

export interface CustomView {
	id: string
	name: string
	sortKey: SortKey
	sortAsc: boolean
	visibleColumns: string[]
	columnOrder: string[]
	columnWidths: Record<string, number>
	filter: TorrentFilter
	categoryFilter: string | null
	tagFilter: string | null
	trackerFilter: string | null
	search: string
	createdAt: number
	updatedAt: number
}

export interface CustomViewsStorage {
	views: CustomView[]
	activeViewId: string | null
}
