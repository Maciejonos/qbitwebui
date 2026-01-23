import { Hono } from 'hono'
import {
	db,
	type CrossSeedConfig,
	type CrossSeedSearchee,
	type CrossSeedDecision,
	type User,
	type Integration,
	MatchMode,
} from '../db'
import { existsSync, accessSync, constants as fsConstants } from 'fs'
import { authMiddleware } from '../middleware/auth'
import {
	startScheduler,
	stopScheduler,
	updateInstanceSchedule,
	triggerManualScan,
	getSchedulerStatus,
	getInstanceStatus,
	isInstanceRunning,
	stopScan,
} from '../utils/crossSeedScheduler'
import { getLogs } from '../utils/logger'
import { clearCacheForInstance, clearOutputForInstance, getCacheStats, getOutputStats } from '../utils/crossSeedCache'
import { getTorznabIndexers } from '../utils/torznab'
import { decrypt } from '../utils/crypto'

const crossSeed = new Hono<{ Variables: { user: User } }>()

crossSeed.use('*', authMiddleware)

function userOwnsInstance(userId: number, instanceId: number): boolean {
	const instance = db
		.query<{ id: number }, [number, number]>('SELECT id FROM instances WHERE id = ? AND user_id = ?')
		.get(instanceId, userId)
	return !!instance
}

function parseJsonArray<T>(json: string | null, guard: (v: unknown) => v is T): T[] {
	if (!json) return []
	try {
		const parsed = JSON.parse(json)
		return Array.isArray(parsed) ? parsed.filter(guard) : []
	} catch {
		return []
	}
}

function parseIndexerIds(json: string | null): number[] {
	return parseJsonArray(json, (v): v is number => typeof v === 'number')
}

function parseBlocklist(json: string | null): string[] {
	return parseJsonArray(json, (v): v is string => typeof v === 'string')
}

crossSeed.get('/config/:instanceId', (c) => {
	const user = c.get('user')
	const instanceId = parseInt(c.req.param('instanceId'))
	if (!userOwnsInstance(user.id, instanceId)) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	const config = db
		.query<CrossSeedConfig, [number]>('SELECT * FROM cross_seed_config WHERE instance_id = ?')
		.get(instanceId)

	if (!config) {
		return c.json({
			instance_id: instanceId,
			enabled: false,
			interval_hours: 24,
			delay_seconds: 30,
			dry_run: true,
			category_suffix: '_cross-seed',
			tag: 'cross-seed',
			skip_recheck: false,
			integration_id: null,
			indexer_ids: [],
			match_mode: MatchMode.STRICT,
			link_dir: null,
			blocklist: [],
			include_single_episodes: false,
			last_run: null,
			next_run: null,
		})
	}

	return c.json({
		...config,
		enabled: !!config.enabled,
		dry_run: !!config.dry_run,
		skip_recheck: !!config.skip_recheck,
		delay_seconds: config.delay_seconds ?? 30,
		indexer_ids: parseIndexerIds(config.indexer_ids),
		match_mode: config.match_mode ?? MatchMode.STRICT,
		link_dir: config.link_dir ?? null,
		blocklist: parseBlocklist(config.blocklist),
		include_single_episodes: !!config.include_single_episodes,
	})
})

function validateLinkDir(dir: string): { valid: boolean; writable: boolean } {
	if (!existsSync(dir)) return { valid: false, writable: false }
	try {
		accessSync(dir, fsConstants.W_OK)
		return { valid: true, writable: true }
	} catch {
		return { valid: true, writable: false }
	}
}

function validateConfig(body: Record<string, unknown>): { valid: boolean; error?: string } {
	const {
		interval_hours,
		delay_seconds,
		category_suffix,
		tag,
		integration_id,
		indexer_ids,
		match_mode,
		link_dir,
		blocklist,
	} = body
	if (interval_hours !== undefined) {
		const hours = Number(interval_hours)
		if (isNaN(hours) || hours < 1 || hours > 168) {
			return { valid: false, error: 'interval_hours must be between 1 and 168' }
		}
	}
	if (delay_seconds !== undefined) {
		const secs = Number(delay_seconds)
		if (isNaN(secs) || secs < 30 || secs > 3600) {
			return { valid: false, error: 'delay_seconds must be between 30 and 3600' }
		}
	}
	if (category_suffix !== undefined && typeof category_suffix !== 'string') {
		return { valid: false, error: 'category_suffix must be a string' }
	}
	if (category_suffix && category_suffix.length > 50) {
		return { valid: false, error: 'category_suffix too long (max 50)' }
	}
	if (tag !== undefined && typeof tag !== 'string') {
		return { valid: false, error: 'tag must be a string' }
	}
	if (tag && tag.length > 100) {
		return { valid: false, error: 'tag too long (max 100)' }
	}
	if (integration_id !== undefined && integration_id !== null && typeof integration_id !== 'number') {
		return { valid: false, error: 'integration_id must be a number or null' }
	}
	if (indexer_ids !== undefined && !Array.isArray(indexer_ids)) {
		return { valid: false, error: 'indexer_ids must be an array' }
	}
	if (indexer_ids && !indexer_ids.every((id: unknown) => typeof id === 'number')) {
		return { valid: false, error: 'indexer_ids must contain only numbers' }
	}
	if (match_mode !== undefined && match_mode !== MatchMode.STRICT && match_mode !== MatchMode.FLEXIBLE) {
		return { valid: false, error: 'match_mode must be strict or flexible' }
	}
	if (link_dir !== undefined && link_dir !== null && typeof link_dir !== 'string') {
		return { valid: false, error: 'link_dir must be a string or null' }
	}
	if (link_dir && link_dir.length > 500) {
		return { valid: false, error: 'link_dir too long (max 500)' }
	}
	if (blocklist !== undefined && !Array.isArray(blocklist)) {
		return { valid: false, error: 'blocklist must be an array' }
	}
	if (blocklist && !blocklist.every((s: unknown) => typeof s === 'string')) {
		return { valid: false, error: 'blocklist must contain only strings' }
	}
	return { valid: true }
}

crossSeed.put('/config/:instanceId', async (c) => {
	const user = c.get('user')
	const instanceId = parseInt(c.req.param('instanceId'))
	if (!userOwnsInstance(user.id, instanceId)) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	const body = await c.req.json()
	const validation = validateConfig(body)
	if (!validation.valid) {
		return c.json({ error: validation.error }, 400)
	}

	const {
		enabled,
		interval_hours,
		delay_seconds,
		dry_run,
		category_suffix,
		tag,
		skip_recheck,
		integration_id,
		indexer_ids,
		match_mode,
		link_dir,
		blocklist,
		include_single_episodes,
	} = body
	const indexerIdsJson = indexer_ids ? JSON.stringify(indexer_ids) : null
	const blocklistJson = blocklist ? JSON.stringify(blocklist) : null
	const linkDirValue = link_dir?.trim() || null
	let linkDirValid: boolean | undefined

	if (linkDirValue) {
		const check = validateLinkDir(linkDirValue)
		linkDirValid = check.valid && check.writable
	}

	const existing = db
		.query<{ instance_id: number }, [number]>('SELECT instance_id FROM cross_seed_config WHERE instance_id = ?')
		.get(instanceId)

	if (existing) {
		db.run(
			`UPDATE cross_seed_config SET
				enabled = ?, interval_hours = ?, delay_seconds = ?, dry_run = ?, category_suffix = ?,
				tag = ?, skip_recheck = ?, integration_id = ?, indexer_ids = ?, match_mode = ?, link_dir = ?,
				blocklist = ?, include_single_episodes = ?, updated_at = unixepoch()
			WHERE instance_id = ?`,
			[
				enabled ? 1 : 0,
				interval_hours ?? 24,
				delay_seconds ?? 30,
				dry_run ? 1 : 0,
				category_suffix ?? '_cross-seed',
				tag ?? 'cross-seed',
				skip_recheck ? 1 : 0,
				integration_id ?? null,
				indexerIdsJson,
				match_mode ?? MatchMode.STRICT,
				linkDirValue,
				blocklistJson,
				include_single_episodes ? 1 : 0,
				instanceId,
			]
		)
	} else {
		db.run(
			`INSERT INTO cross_seed_config
				(instance_id, enabled, interval_hours, delay_seconds, dry_run, category_suffix, tag, skip_recheck, integration_id, indexer_ids, match_mode, link_dir, blocklist, include_single_episodes)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				instanceId,
				enabled ? 1 : 0,
				interval_hours ?? 24,
				delay_seconds ?? 30,
				dry_run ? 1 : 0,
				category_suffix ?? '_cross-seed',
				tag ?? 'cross-seed',
				skip_recheck ? 1 : 0,
				integration_id ?? null,
				indexerIdsJson,
				match_mode ?? MatchMode.STRICT,
				linkDirValue,
				blocklistJson,
				include_single_episodes ? 1 : 0,
			]
		)
	}

	updateInstanceSchedule(instanceId, !!enabled)

	return c.json({ success: true, linkDirValid })
})

crossSeed.get('/indexers/:instanceId', async (c) => {
	const user = c.get('user')
	const instanceId = parseInt(c.req.param('instanceId'))
	if (!userOwnsInstance(user.id, instanceId)) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	const integrationIdParam = c.req.query('integrationId')
	let integrationId: number | null = integrationIdParam ? parseInt(integrationIdParam) : null

	if (!integrationId) {
		const config = db
			.query<CrossSeedConfig, [number]>('SELECT * FROM cross_seed_config WHERE instance_id = ?')
			.get(instanceId)
		integrationId = config?.integration_id ?? null
	}

	if (!integrationId) {
		return c.json({ error: 'No Prowlarr integration configured' }, 400)
	}

	const integration = db
		.query<Integration, [number, number]>('SELECT * FROM integrations WHERE id = ? AND user_id = ?')
		.get(integrationId, user.id)

	if (!integration) {
		return c.json({ error: 'Integration not found' }, 404)
	}

	try {
		const apiKey = decrypt(integration.api_key_encrypted)
		const indexers = await getTorznabIndexers(integration.url, apiKey)
		return c.json(indexers)
	} catch (e) {
		return c.json({ error: e instanceof Error ? e.message : 'Failed to fetch indexers' }, 500)
	}
})

crossSeed.post('/scan/:instanceId', async (c) => {
	const user = c.get('user')
	const instanceId = parseInt(c.req.param('instanceId'))
	if (!userOwnsInstance(user.id, instanceId)) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	if (isInstanceRunning(instanceId)) {
		return c.json({ error: 'Scan already in progress' }, 409)
	}

	const body = await c.req.json().catch(() => ({}))
	const force = body.force === true

	try {
		const result = await triggerManualScan(instanceId, user.id, force)
		return c.json(result)
	} catch (e) {
		return c.json({ error: e instanceof Error ? e.message : 'Scan failed' }, 500)
	}
})

crossSeed.post('/stop/:instanceId', (c) => {
	const user = c.get('user')
	const instanceId = parseInt(c.req.param('instanceId'))
	if (!userOwnsInstance(user.id, instanceId)) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	if (!isInstanceRunning(instanceId)) {
		return c.json({ error: 'No scan running' }, 400)
	}

	const stopped = stopScan(instanceId)
	return c.json({ stopped })
})

crossSeed.get('/logs', (c) => {
	const limit = parseInt(c.req.query('limit') || '100')
	const logs = getLogs('[CrossSeed', limit)
	return c.json(logs)
})

crossSeed.get('/status', (c) => {
	const user = c.get('user')
	const statuses = getSchedulerStatus().filter((s) => userOwnsInstance(user.id, s.instanceId))
	return c.json(statuses)
})

crossSeed.get('/status/:instanceId', (c) => {
	const user = c.get('user')
	const instanceId = parseInt(c.req.param('instanceId'))
	if (!userOwnsInstance(user.id, instanceId)) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	const status = getInstanceStatus(instanceId)
	if (!status) {
		return c.json({
			instanceId,
			enabled: false,
			running: false,
			lastRun: null,
			nextRun: null,
			lastResult: null,
		})
	}
	return c.json(status)
})

crossSeed.post('/cache/:instanceId/clear', (c) => {
	const user = c.get('user')
	const instanceId = parseInt(c.req.param('instanceId'))
	if (!userOwnsInstance(user.id, instanceId)) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	const cacheCleared = clearCacheForInstance(instanceId)
	const outputCleared = clearOutputForInstance(instanceId)

	return c.json({ cacheCleared, outputCleared })
})

crossSeed.get('/cache/:instanceId/stats', (c) => {
	const user = c.get('user')
	const instanceId = parseInt(c.req.param('instanceId'))
	if (!userOwnsInstance(user.id, instanceId)) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	const cache = getCacheStats(instanceId)
	const output = getOutputStats(instanceId)

	return c.json({ cache, output })
})

crossSeed.get('/history/:instanceId', (c) => {
	const user = c.get('user')
	const instanceId = parseInt(c.req.param('instanceId'))
	if (!userOwnsInstance(user.id, instanceId)) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	const limit = parseInt(c.req.query('limit') || '100')
	const offset = parseInt(c.req.query('offset') || '0')

	const searchees = db
		.query<CrossSeedSearchee & { decision_count: number }, [number, number, number]>(
			`
		SELECT s.*, COUNT(d.id) as decision_count
		FROM cross_seed_searchee s
		LEFT JOIN cross_seed_decision d ON s.id = d.searchee_id
		WHERE s.instance_id = ?
		GROUP BY s.id
		ORDER BY s.last_searched DESC
		LIMIT ? OFFSET ?
	`
		)
		.all(instanceId, limit, offset)

	const total = db
		.query<{ count: number }, [number]>('SELECT COUNT(*) as count FROM cross_seed_searchee WHERE instance_id = ?')
		.get(instanceId)

	return c.json({ searchees, total: total?.count ?? 0 })
})

crossSeed.get('/history/:instanceId/:searcheeId/decisions', (c) => {
	const user = c.get('user')
	const instanceId = parseInt(c.req.param('instanceId'))
	const searcheeId = parseInt(c.req.param('searcheeId'))
	if (!userOwnsInstance(user.id, instanceId)) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	const searchee = db
		.query<{ id: number }, [number, number]>('SELECT id FROM cross_seed_searchee WHERE id = ? AND instance_id = ?')
		.get(searcheeId, instanceId)
	if (!searchee) {
		return c.json({ error: 'Searchee not found' }, 404)
	}

	const decisions = db
		.query<
			CrossSeedDecision,
			[number]
		>('SELECT * FROM cross_seed_decision WHERE searchee_id = ? ORDER BY last_seen DESC')
		.all(searcheeId)

	return c.json(decisions)
})

export { crossSeed, startScheduler, stopScheduler }
