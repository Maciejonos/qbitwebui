const PATTERNS = [
	/\b(2160p|1080p|720p|480p|4K|UHD)\b/gi,
	/\b(x264|x265|HEVC|AVC|H\.?264|H\.?265|AV1)\b/gi,
	/\b(BluRay|BDRip|WEB-DL|WEBRip|HDRip|DVDRip|HDTV|WEB)\b/gi,
	/\b(REMUX|HDR|HDR10|DV|Dolby\.?Vision|ATMOS)\b/gi,
	/\b(MKV|MP4|AVI|ISO|FLAC|MP3|AAC)\b/gi,
]

export function extractTags(titles: string[]): { tag: string; count: number }[] {
	const counts = new Map<string, number>()
	for (const title of titles) {
		const found = new Set<string>()
		for (const pattern of PATTERNS) {
			const matches = title.match(pattern)
			if (matches) {
				for (const m of matches) {
					found.add(m.toUpperCase())
				}
			}
		}
		for (const tag of found) {
			counts.set(tag, (counts.get(tag) || 0) + 1)
		}
	}
	return Array.from(counts.entries())
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count)
}

export type SortKey = 'seeders' | 'size' | 'age'

export function sortResults<T extends { seeders?: number; size: number; publishDate: string }>(
	results: T[],
	sortKey: SortKey,
	sortAsc: boolean
): T[] {
	return [...results].sort((a, b) => {
		let cmp = 0
		if (sortKey === 'seeders') {
			cmp = (b.seeders || 0) - (a.seeders || 0)
		} else if (sortKey === 'size') {
			cmp = b.size - a.size
		} else if (sortKey === 'age') {
			cmp = new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
		}
		return sortAsc ? -cmp : cmp
	})
}

export function filterResults<T extends { title: string }>(results: T[], filter: string): T[] {
	if (!filter) return results
	return results.filter(r => r.title.toLowerCase().includes(filter.toLowerCase()))
}
