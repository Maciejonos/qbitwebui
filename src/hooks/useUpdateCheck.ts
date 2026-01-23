import { useQuery } from '@tanstack/react-query'

declare const __APP_VERSION__: string

interface GitHubRelease {
	tag_name: string
	body?: string
	html_url?: string
}

function compareVersions(current: string, latest: string): number {
	const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number)
	const [c, l] = [parse(current), parse(latest)]
	for (let i = 0; i < Math.max(c.length, l.length); i++) {
		const diff = (l[i] ?? 0) - (c[i] ?? 0)
		if (diff !== 0) return diff
	}
	return 0
}

export function useUpdateCheck() {
	const { data, isLoading, error } = useQuery({
		queryKey: ['update-check'],
		queryFn: async (): Promise<GitHubRelease> => {
			const res = await fetch('https://api.github.com/repos/Maciejonos/qbitwebui/releases/latest')
			if (!res.ok) throw new Error('Failed to fetch')
			return res.json()
		},
		staleTime: 1000 * 60 * 60,
		refetchOnWindowFocus: false,
	})

	const latestVersion = data?.tag_name?.replace(/^v/, '')
	const hasUpdate = latestVersion ? compareVersions(__APP_VERSION__, latestVersion) > 0 : false

	return {
		hasUpdate,
		latestVersion,
		releaseNotes: data?.body ?? '',
		releaseUrl: data?.html_url ?? '',
		isLoading,
		error,
	}
}
