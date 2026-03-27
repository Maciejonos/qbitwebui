export interface TorrentProperties {
	save_path: string
	download_path: string
	creation_date: number
	piece_size: number
	comment: string
	total_wasted: number
	total_uploaded: number
	total_uploaded_session: number
	total_downloaded: number
	total_downloaded_session: number
	up_limit: number
	dl_limit: number
	time_elapsed: number
	seeding_time: number
	nb_connections: number
	nb_connections_limit: number
	share_ratio: number
	addition_date: number
	completion_date: number
	created_by: string
	dl_speed_avg: number
	dl_speed: number
	eta: number
	last_seen: number
	peers: number
	peers_total: number
	pieces_have: number
	pieces_num: number
	reannounce: number
	seeds: number
	seeds_total: number
	total_size: number
	up_speed_avg: number
	up_speed: number
	is_private?: boolean
	infohash_v1?: string
	infohash_v2?: string
	popularity?: number
}

export interface Tracker {
	url: string
	status: number
	tier: number
	num_peers: number
	num_seeds: number
	num_leeches: number
	num_downloaded: number
	msg: string
}

export interface Peer {
	ip: string
	port: number
	client: string
	progress: number
	dl_speed: number
	up_speed: number
	downloaded: number
	uploaded: number
	connection: string
	flags: string
	flags_desc: string
	relevance: number
	files: string
	country?: string
	country_code?: string
}

export interface PeersResponse {
	full_update: boolean
	peers: Record<string, Peer>
	rid: number
	show_flags: boolean
}

export interface TorrentFile {
	index: number
	name: string
	size: number
	progress: number
	priority: number
	is_seed: boolean
	availability: number
	piece_range: [number, number]
}

export interface WebSeed {
	url: string
}
