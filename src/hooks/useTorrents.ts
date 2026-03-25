import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/qbittorrent'
import type { AddTorrentOptions, TorrentFilterOptions } from '../api/qbittorrent'
import { useInstance } from './useInstance'

export function useTorrents(options: TorrentFilterOptions = {}) {
	const instance = useInstance()
	return useQuery({
		queryKey: ['torrents', instance.id, options],
		queryFn: () => api.getTorrents(instance.id, options),
		refetchInterval: 2000,
	})
}

export function useStopTorrents() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (hashes: string[]) => api.stopTorrents(instance.id, hashes),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['torrents', instance.id] }),
	})
}

export function useStartTorrents() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (hashes: string[]) => api.startTorrents(instance.id, hashes),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['torrents', instance.id] }),
	})
}

export function useRecheckTorrents() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (hashes: string[]) => api.recheckTorrents(instance.id, hashes),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['torrents', instance.id] }),
	})
}

export function useReannounceTorrents() {
	const instance = useInstance()
	return useMutation({
		mutationFn: (hashes: string[]) => api.reannounceTorrents(instance.id, hashes),
	})
}

export function useDeleteTorrents() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ hashes, deleteFiles }: { hashes: string[]; deleteFiles?: boolean }) =>
			api.deleteTorrents(instance.id, hashes, deleteFiles),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['torrents', instance.id] }),
	})
}

export function useAddTorrent() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ options, files }: { options: AddTorrentOptions; files?: File[] }) =>
			api.addTorrent(instance.id, options, files),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['torrents', instance.id] }),
	})
}

export function useCategories() {
	const instance = useInstance()
	return useQuery({
		queryKey: ['categories', instance.id],
		queryFn: () => api.getCategories(instance.id),
	})
}

export function useTags() {
	const instance = useInstance()
	return useQuery({
		queryKey: ['tags', instance.id],
		queryFn: () => api.getTags(instance.id),
	})
}

export function useSetCategory() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ hashes, category }: { hashes: string[]; category: string }) =>
			api.setCategory(instance.id, hashes, category),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['torrents', instance.id] }),
	})
}

export function useAddTags() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ hashes, tags }: { hashes: string[]; tags: string }) => api.addTags(instance.id, hashes, tags),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['torrents', instance.id] })
			queryClient.invalidateQueries({ queryKey: ['tags', instance.id] })
		},
	})
}

export function useRemoveTags() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ hashes, tags }: { hashes: string[]; tags: string }) => api.removeTags(instance.id, hashes, tags),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['torrents', instance.id] })
			queryClient.invalidateQueries({ queryKey: ['tags', instance.id] })
		},
	})
}

export function useRenameTorrent() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ hash, name }: { hash: string; name: string }) => api.renameTorrent(instance.id, hash, name),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['torrents', instance.id] }),
	})
}

export function useSetTorrentLocation() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ hashes, location }: { hashes: string[]; location: string }) =>
			api.setTorrentLocation(instance.id, hashes, location),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['torrents', instance.id] })
			queryClient.invalidateQueries({ queryKey: ['torrent-properties', instance.id] })
		},
	})
}

export function useSetTorrentDownloadPath() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ hashes, downloadPath }: { hashes: string[]; downloadPath: string }) =>
			api.setTorrentDownloadPath(instance.id, hashes, downloadPath),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['torrents', instance.id] })
			queryClient.invalidateQueries({ queryKey: ['torrent-properties', instance.id] })
		},
	})
}

export function useCreateTag() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (tag: string) => api.createTags(instance.id, tag),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags', instance.id] }),
	})
}

export function useDeleteTag() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (tag: string) => api.deleteTags(instance.id, tag),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['tags', instance.id] })
			queryClient.invalidateQueries({ queryKey: ['torrents', instance.id] })
		},
	})
}

export function useCreateCategory() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ name, savePath }: { name: string; savePath?: string }) =>
			api.createCategory(instance.id, name, savePath),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories', instance.id] }),
	})
}

export function useEditCategory() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ name, savePath }: { name: string; savePath: string }) =>
			api.editCategory(instance.id, name, savePath),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories', instance.id] }),
	})
}

export function useDeleteCategory() {
	const instance = useInstance()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (name: string) => api.removeCategories(instance.id, [name]),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['categories', instance.id] })
			queryClient.invalidateQueries({ queryKey: ['torrents', instance.id] })
		},
	})
}

export function useExportTorrents() {
	const instance = useInstance()
	return useMutation({
		mutationFn: (torrents: { hash: string; name: string }[]) => api.exportTorrents(instance.id, torrents),
	})
}
