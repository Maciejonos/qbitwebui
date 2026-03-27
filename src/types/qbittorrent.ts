export type TorrentState =
	| 'error'
	| 'missingFiles'
	| 'uploading'
	| 'pausedUP'
	| 'stoppedUP'
	| 'queuedUP'
	| 'stalledUP'
	| 'checkingUP'
	| 'forcedUP'
	| 'allocating'
	| 'downloading'
	| 'metaDL'
	| 'pausedDL'
	| 'stoppedDL'
	| 'queuedDL'
	| 'stalledDL'
	| 'checkingDL'
	| 'forcedDL'
	| 'checkingResumeData'
	| 'moving'
	| 'unknown'

export interface Torrent {
	hash: string
	name: string
	size: number
	progress: number
	dlspeed: number
	upspeed: number
	priority: number
	num_seeds: number
	num_leechs: number
	ratio: number
	eta: number
	state: TorrentState
	category: string
	tags: string
	added_on: number
	completion_on: number
	last_activity: number
	save_path: string
	download_path: string
	downloaded: number
	uploaded: number
	tracker: string
	seeding_time: number
}

export interface TransferInfo {
	dl_info_speed: number
	dl_info_data: number
	up_info_speed: number
	up_info_data: number
	dl_rate_limit: number
	up_rate_limit: number
	dht_nodes: number
	connection_status: 'connected' | 'firewalled' | 'disconnected'
}

export interface SyncServerState {
	alltime_dl: number
	alltime_ul: number
	dl_info_speed: number
	up_info_speed: number
	free_space_on_disk: number
}

export interface SyncMaindata {
	server_state: SyncServerState
}

export type TorrentFilter =
	| 'all'
	| 'downloading'
	| 'seeding'
	| 'completed'
	| 'stopped'
	| 'active'
	| 'inactive'
	| 'resumed'
	| 'stalled'
	| 'errored'
