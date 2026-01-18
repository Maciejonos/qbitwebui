import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/qbittorrent'
import { useInstance } from './useInstance'

export function useTorrentProperties(hash: string | null) {
	const instance = useInstance()
	return useQuery({
		queryKey: ['torrent-properties', instance.id, hash],
		queryFn: () => api.getTorrentProperties(instance.id, hash!),
		enabled: !!hash,
		refetchInterval: 2000,
	})
}

export function useTorrentTrackers(hash: string | null) {
	const instance = useInstance()
	return useQuery({
		queryKey: ['torrent-trackers', instance.id, hash],
		queryFn: () => api.getTorrentTrackers(instance.id, hash!),
		enabled: !!hash,
		refetchInterval: 5000,
	})
}

export function useTorrentPeers(hash: string | null) {
	const instance = useInstance()
	return useQuery({
		queryKey: ['torrent-peers', instance.id, hash],
		queryFn: () => api.getTorrentPeers(instance.id, hash!),
		enabled: !!hash,
		refetchInterval: 2000,
	})
}

export function useTorrentFiles(hash: string | null) {
	const instance = useInstance()
	return useQuery({
		queryKey: ['torrent-files', instance.id, hash],
		queryFn: () => api.getTorrentFiles(instance.id, hash!),
		enabled: !!hash,
	})
}

export function useTorrentWebSeeds(hash: string | null) {
	const instance = useInstance()
	return useQuery({
		queryKey: ['torrent-webseeds', instance.id, hash],
		queryFn: () => api.getTorrentWebSeeds(instance.id, hash!),
		enabled: !!hash,
	})
}

export function useSetFilePriority() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ hash, ids, priority }: { hash: string; ids: number[]; priority: number }) =>
			api.setFilePriority(instance.id, hash, ids, priority),
		onMutate: async ({ hash, ids, priority }) => {
			await queryClient.cancelQueries({ queryKey: ['torrent-files', instance.id, hash] })
			const previous = queryClient.getQueryData(['torrent-files', instance.id, hash])
			queryClient.setQueryData(['torrent-files', instance.id, hash], (old: unknown) => {
				if (!Array.isArray(old)) return old
				return old.map((file, idx) => ids.includes(idx) ? { ...file, priority } : file)
			})
			return { previous, hash }
		},
		onError: (_, __, context) => {
			if (context?.previous) {
				queryClient.setQueryData(['torrent-files', instance.id, context.hash], context.previous)
			}
		},
		onSettled: (_, __, { hash }) => queryClient.invalidateQueries({ queryKey: ['torrent-files', instance.id, hash] }),
	})
}

export function useAddTrackers() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ hash, urls }: { hash: string; urls: string[] }) =>
			api.addTrackers(instance.id, hash, urls),
		onSuccess: (_, { hash }) => queryClient.invalidateQueries({ queryKey: ['torrent-trackers', instance.id, hash] }),
	})
}

export function useRemoveTrackers() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ hash, urls }: { hash: string; urls: string[] }) =>
			api.removeTrackers(instance.id, hash, urls),
		onSuccess: (_, { hash }) => queryClient.invalidateQueries({ queryKey: ['torrent-trackers', instance.id, hash] }),
	})
}
