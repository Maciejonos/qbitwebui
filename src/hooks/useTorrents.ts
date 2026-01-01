import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/qbittorrent'
import type { AddTorrentOptions, TorrentFilterOptions } from '../api/qbittorrent'

export function useTorrents(options: TorrentFilterOptions = {}) {
	return useQuery({
		queryKey: ['torrents', options],
		queryFn: () => api.getTorrents(options),
		refetchInterval: 2000,
	})
}

export function useStopTorrents() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: api.stopTorrents,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['torrents'] }),
	})
}

export function useStartTorrents() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: api.startTorrents,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['torrents'] }),
	})
}

export function useDeleteTorrents() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ hashes, deleteFiles }: { hashes: string[]; deleteFiles?: boolean }) =>
			api.deleteTorrents(hashes, deleteFiles),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['torrents'] }),
	})
}

export function useAddTorrent() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ options, file }: { options: AddTorrentOptions; file?: File }) =>
			api.addTorrent(options, file),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['torrents'] }),
	})
}

export function useCategories() {
	return useQuery({
		queryKey: ['categories'],
		queryFn: api.getCategories,
	})
}
