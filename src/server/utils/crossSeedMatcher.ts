import { CrossSeedDecisionType } from '../db'

export interface FileInfo {
	name: string
	size: number
}

export interface MatchResult {
	decision: string
	matched: boolean
	confidence: number
	matchedFiles: number
	totalFiles: number
	details?: string
}

export function matchTorrentsBySizes(
	sourceFiles: FileInfo[],
	candidateFiles: FileInfo[]
): MatchResult {
	if (candidateFiles.length === 0) {
		return {
			decision: CrossSeedDecisionType.SIZE_MISMATCH,
			matched: false,
			confidence: 0,
			matchedFiles: 0,
			totalFiles: 0,
			details: 'Candidate has no files',
		}
	}

	const sourceSizes = sourceFiles.map((f) => f.size).sort((a, b) => a - b)
	const candidateSizes = candidateFiles.map((f) => f.size).sort((a, b) => a - b)

	if (sourceSizes.length !== candidateSizes.length) {
		return {
			decision: CrossSeedDecisionType.FILE_COUNT_MISMATCH,
			matched: false,
			confidence: 0,
			matchedFiles: 0,
			totalFiles: candidateFiles.length,
			details: `File count mismatch: source=${sourceSizes.length}, candidate=${candidateSizes.length}`,
		}
	}

	const availableSourceFiles = [...sourceFiles]
	let matchedCount = 0

	for (const candidateFile of candidateFiles) {
		let matches = availableSourceFiles.filter((sf) => sf.size === candidateFile.size)
		if (matches.length > 1) {
			const nameMatch = matches.find((sf) => sf.name === candidateFile.name)
			if (nameMatch) matches = [nameMatch]
		}
		if (matches.length === 0) {
			continue
		}
		matchedCount++
		const idx = availableSourceFiles.indexOf(matches[0])
		availableSourceFiles.splice(idx, 1)
	}

	const confidence = matchedCount / candidateFiles.length

	if (matchedCount === candidateFiles.length) {
		const namesMatch = sourceFiles.every((sf) =>
			candidateFiles.some((cf) => cf.name === sf.name && cf.size === sf.size)
		)
		return {
			decision: namesMatch ? CrossSeedDecisionType.MATCH : CrossSeedDecisionType.MATCH_SIZE_ONLY,
			matched: true,
			confidence: 1,
			matchedFiles: matchedCount,
			totalFiles: candidateFiles.length,
			details: namesMatch ? 'Perfect match (names + sizes)' : 'Size-only match (names differ)',
		}
	}

	return {
		decision: CrossSeedDecisionType.SIZE_MISMATCH,
		matched: false,
		confidence,
		matchedFiles: matchedCount,
		totalFiles: candidateFiles.length,
		details: `Only ${matchedCount}/${candidateFiles.length} files matched`,
	}
}

export function fuzzySizeMatch(sourceSize: number, candidateSize: number, tolerance = 0.02): boolean {
	const lowerBound = sourceSize * (1 - tolerance)
	const upperBound = sourceSize * (1 + tolerance)
	return candidateSize >= lowerBound && candidateSize <= upperBound
}

export function preFilterCandidate(
	sourceName: string,
	sourceSize: number,
	candidateName: string,
	candidateSize: number | undefined,
	tolerance = 0.02
): { pass: boolean; reason?: string } {
	if (candidateSize === undefined) {
		return { pass: true }
	}

	if (!fuzzySizeMatch(sourceSize, candidateSize, tolerance)) {
		const diff = Math.abs(candidateSize - sourceSize) / sourceSize
		return {
			pass: false,
			reason: `Size mismatch: ${(diff * 100).toFixed(1)}% difference (tolerance: ${tolerance * 100}%)`,
		}
	}

	return { pass: true }
}
