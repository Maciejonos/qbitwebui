import { CrossSeedDecisionType, BlocklistType, type BlocklistTypeValue } from '../db'
import { dirname } from 'path'

export interface FileInfo {
	name: string
	size: number
}

export interface Searchee {
	title: string
	files: FileInfo[]
	length: number
	infoHash?: string
	path?: string
	category?: string
	tags?: string[]
}

export interface MatchResult {
	decision: string
	matched: boolean
	confidence: number
	matchedFiles: number
	totalFiles: number
	details?: string
}

export interface PreFilterResult {
	pass: boolean
	reason?: string
}

const RESOLUTION_REGEX = /\b(2160p|1080p|1080i|720p|576p|576i|480p|480i|4k|uhd)\b/i
const RELEASE_GROUP_REGEX =
	/(?<=-)(?:\W|\b)(?!(?:\d{3,4}[ip]))(?!\d+\b)(?:\W|\b)(?<group>[\w .]+?)(?:\[.+\])?(?:\))?(?:\s\[.+\])?$/i
const ANIME_GROUP_REGEX = /^\s*\[(?<group>.+?)\]/i
const SOURCE_REGEX = /\b(AMZN|NF|NETFLIX|DSNP|HULU|ATVP|PCOK|PMTP|HBO|HMAX|IT|RED|STAN|CRAV|MA|VUDU|iT)\b/i
const PROPER_REPACK_REGEX = /\b(PROPER|REPACK|RERIP|REAL)\d?\b/i
const VIDEO_EXTENSIONS = /\.(mkv|mp4|avi|m4v|ts|wmv|webm)$/i
const SEASON_REGEX = /^(?<title>.+?)[[(_.\s-]+(?<season>S(?:eason)?\s*\d+)(?=\b(?![_.\s~-]*E\d+))/i
const EP_REGEX =
	/^(?<title>.+?)[_.\s-]+(?:(?<season>S\d+)?[_.\s-]{0,3}(?!(?:19|20)\d{2})(?<episode>(?:E|(?<=S\d+[_\s-]{1,3}))\d+(?:[\s-]?(?!(?:19|20)\d{2})E?\d+)?(?![pix]))(?!\d+[pix])|(?<date>(?<year>(?:19|20)\d{2})[_.\s-](?<month>\d{2})[_.\s-](?<day>\d{2})))/i
const VIDEO_EXTS = ['.mkv', '.mp4', '.avi', '.ts', '.m4v', '.mov', '.wmv', '.webm']
const BAD_GROUP_PARSE_REGEX =
	/^(?<badmatch>(?:dl|DDP?|aac|eac3|atmos|dts|ma|hd|[heav.c]{3,5}|[xh.]{1,2}[2456]|[0-9]+[ip]?|dxva|full|blu|ray|s(?:eason)?\W\d+|\W){3,})$/i
const PARSE_BLOCKLIST_REGEX = /^(?<blocklistType>.+?):(?<blocklistValue>.*)$/

export function extractResolution(name: string): string | null {
	const match = name.match(RESOLUTION_REGEX)
	if (!match) return null
	const res = match[1].toLowerCase()
	if (res === '4k' || res === 'uhd') return '2160p'
	return res
}

function stripExtension(name: string): string {
	return name.replace(VIDEO_EXTENSIONS, '')
}

export function extractReleaseGroup(name: string): string | null {
	const stem = stripExtension(name)
	const match = stem.match(RELEASE_GROUP_REGEX)
	if (!match?.groups?.group) return null
	const group = match.groups.group.trim()
	if (BAD_GROUP_PARSE_REGEX.test(group)) return null
	return group.toLowerCase()
}

function extractAnimeGroup(name: string): string | null {
	const match = name.match(ANIME_GROUP_REGEX)
	return match?.groups?.group?.trim()?.toLowerCase() ?? null
}

export function extractSource(name: string): string | null {
	const match = name.match(SOURCE_REGEX)
	if (!match) return null
	const source = match[1].toUpperCase()
	if (source === 'NETFLIX') return 'NF'
	if (source === 'IT') return 'ATVP'
	return source
}

export function hasProperRepack(name: string): boolean {
	return PROPER_REPACK_REGEX.test(name)
}

function checkMatch(
	sourceVal: string | null,
	candidateVal: string | null,
	label: string,
	prefixMatch = false
): PreFilterResult {
	if (!sourceVal || !candidateVal) return { pass: true }
	if (prefixMatch && (sourceVal.startsWith(candidateVal) || candidateVal.startsWith(sourceVal))) return { pass: true }
	if (sourceVal !== candidateVal) return { pass: false, reason: `${label} mismatch: ${sourceVal} vs ${candidateVal}` }
	return { pass: true }
}

export function resolutionMatches(sourceName: string, candidateName: string): PreFilterResult {
	return checkMatch(extractResolution(sourceName), extractResolution(candidateName), 'Resolution')
}

export function releaseGroupMatches(sourceName: string, candidateName: string): PreFilterResult {
	const sourceGroup = extractReleaseGroup(sourceName)
	const candidateGroup = extractReleaseGroup(candidateName)
	if (!sourceGroup || !candidateGroup) return { pass: true }

	const prefixMatch = sourceGroup.startsWith(candidateGroup) || candidateGroup.startsWith(sourceGroup)
	if (prefixMatch) return { pass: true }

	const sourceAnime = extractAnimeGroup(sourceName)
	const candidateAnime = extractAnimeGroup(candidateName)
	const animeMatch =
		(sourceAnime && (sourceAnime === candidateAnime || sourceAnime === candidateGroup)) ||
		(candidateAnime && sourceGroup === candidateAnime)
	if (animeMatch) return { pass: true }

	return { pass: false, reason: `Release group mismatch: ${sourceGroup} vs ${candidateGroup}` }
}

export function sourceMatches(sourceName: string, candidateName: string): PreFilterResult {
	return checkMatch(extractSource(sourceName), extractSource(candidateName), 'Source')
}

export function properRepackMatches(sourceName: string, candidateName: string): PreFilterResult {
	const sourceHas = hasProperRepack(sourceName)
	const candidateHas = hasProperRepack(candidateName)
	if (sourceHas === candidateHas) return { pass: true }
	return {
		pass: false,
		reason: sourceHas ? 'Source is PROPER/REPACK but candidate is not' : 'Candidate is PROPER/REPACK but source is not',
	}
}

function compareFileTrees(candidateFiles: FileInfo[], searcheeFiles: FileInfo[]): boolean {
	return candidateFiles.every((cf) => searcheeFiles.some((sf) => sf.size === cf.size && sf.name === cf.name))
}

function compareFileTreesIgnoringNames(candidateFiles: FileInfo[], searcheeFiles: FileInfo[]): boolean {
	const available = [...searcheeFiles]
	for (const cf of candidateFiles) {
		let matches = available.filter((sf) => sf.size === cf.size)
		if (matches.length > 1) {
			const nameMatch = matches.find((sf) => sf.name === cf.name)
			if (nameMatch) matches = [nameMatch]
		}
		if (matches.length === 0) return false
		available.splice(available.indexOf(matches[0]), 1)
	}
	return true
}

export function matchTorrentsBySizes(searcheeFiles: FileInfo[], candidateFiles: FileInfo[]): MatchResult {
	const total = candidateFiles.length
	const makeResult = (decision: string, matched: boolean, matchedFiles: number, details: string): MatchResult => ({
		decision,
		matched,
		confidence: total > 0 ? matchedFiles / total : 0,
		matchedFiles,
		totalFiles: total,
		details,
	})

	if (total === 0) return makeResult(CrossSeedDecisionType.SIZE_MISMATCH, false, 0, 'Candidate has no files')

	const perfectMatch = compareFileTrees(candidateFiles, searcheeFiles)
	if (perfectMatch) {
		return makeResult(CrossSeedDecisionType.MATCH, true, total, 'Perfect match (names + sizes)')
	}

	const sizeMatch = compareFileTreesIgnoringNames(candidateFiles, searcheeFiles)
	if (sizeMatch) {
		return makeResult(CrossSeedDecisionType.MATCH_SIZE_ONLY, true, total, 'Size-only match (names differ)')
	}

	const available = [...searcheeFiles]
	let matchedCount = 0
	for (const cf of candidateFiles) {
		let matches = available.filter((sf) => sf.size === cf.size)
		if (matches.length > 1) {
			const nameMatch = matches.find((sf) => sf.name === cf.name)
			if (nameMatch) matches = [nameMatch]
		}
		if (matches.length > 0) {
			matchedCount++
			available.splice(available.indexOf(matches[0]), 1)
		}
	}

	return makeResult(
		CrossSeedDecisionType.SIZE_MISMATCH,
		false,
		matchedCount,
		`Only ${matchedCount}/${total} candidate files matched in searchee`
	)
}

function fuzzySizeMatch(sourceSize: number, candidateSize: number, tolerance = 0.02): boolean {
	return candidateSize >= sourceSize * (1 - tolerance) && candidateSize <= sourceSize * (1 + tolerance)
}

export function preFilterCandidate(
	sourceName: string,
	sourceSize: number,
	candidateName: string,
	candidateSize: number | undefined,
	tolerance = 0.02
): PreFilterResult {
	for (const check of [
		resolutionMatches(sourceName, candidateName),
		releaseGroupMatches(sourceName, candidateName),
		sourceMatches(sourceName, candidateName),
		properRepackMatches(sourceName, candidateName),
	]) {
		if (!check.pass) return check
	}

	if (candidateSize !== undefined && !fuzzySizeMatch(sourceSize, candidateSize, tolerance)) {
		const diff = sourceSize > 0 ? Math.abs(candidateSize - sourceSize) / sourceSize : 1
		return {
			pass: false,
			reason: `Size mismatch: ${(diff * 100).toFixed(1)}% difference (tolerance: ${tolerance * 100}%)`,
		}
	}

	return { pass: true }
}

function isSeasonPack(title: string): boolean {
	return SEASON_REGEX.test(title)
}

function isSingleEpisode(title: string, files: FileInfo[]): boolean {
	if (EP_REGEX.test(title)) return true
	const videoFiles = files.filter((f) => VIDEO_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext)))
	return videoFiles.length === 1
}

export function shouldRejectSeasonEpisodeMismatch(
	searcheeTitle: string,
	candidateTitle: string,
	candidateFiles: FileInfo[],
	includeSingleEpisodes: boolean
): boolean {
	if (includeSingleEpisodes) return false
	if (!isSeasonPack(searcheeTitle)) return false
	return isSingleEpisode(candidateTitle, candidateFiles)
}

function parseBlocklistEntry(entry: string): { blocklistType: BlocklistTypeValue; blocklistValue: string } {
	const match = entry.match(PARSE_BLOCKLIST_REGEX)
	if (match?.groups) {
		return {
			blocklistType: match.groups.blocklistType as BlocklistTypeValue,
			blocklistValue: match.groups.blocklistValue,
		}
	}
	return {
		blocklistType: BlocklistType.LEGACY,
		blocklistValue: entry,
	}
}

export function findBlockedStringInRelease(searchee: Searchee, blocklist: string[]): string | undefined {
	return blocklist.find((entry) => {
		const { blocklistType, blocklistValue } = parseBlocklistEntry(entry)
		switch (blocklistType) {
			case BlocklistType.NAME:
				return searchee.title.includes(blocklistValue)
			case BlocklistType.NAME_REGEX:
				try {
					return new RegExp(blocklistValue).test(searchee.title)
				} catch {
					return false
				}
			case BlocklistType.FOLDER:
				return searchee.path && dirname(searchee.path).includes(blocklistValue)
			case BlocklistType.FOLDER_REGEX:
				try {
					return searchee.path && new RegExp(blocklistValue).test(dirname(searchee.path))
				} catch {
					return false
				}
			case BlocklistType.CATEGORY:
				return blocklistValue === searchee.category
			case BlocklistType.TAG:
				if (!searchee.tags) return false
				return blocklistValue.length ? searchee.tags.includes(blocklistValue) : !searchee.tags.length
			case BlocklistType.INFOHASH:
				return blocklistValue === searchee.infoHash
			case BlocklistType.SIZE_BELOW: {
				const sizeBelow = parseInt(blocklistValue, 10)
				return !Number.isNaN(sizeBelow) && searchee.length < sizeBelow
			}
			case BlocklistType.SIZE_ABOVE: {
				const sizeAbove = parseInt(blocklistValue, 10)
				return !Number.isNaN(sizeAbove) && searchee.length > sizeAbove
			}
			case BlocklistType.TRACKER:
				return false
			case BlocklistType.LEGACY:
				if (searchee.title.includes(entry)) return true
				if (entry === searchee.infoHash) return true
				if (searchee.path && dirname(searchee.path).includes(entry)) return true
				return false
			default:
				return false
		}
	})
}
