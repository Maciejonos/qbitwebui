import { Hono } from 'hono'
import { db, type CrossSeedConfig, type CrossSeedSearchee, type CrossSeedDecision, type User } from '../db'
import { authMiddleware } from '../middleware/auth'
import {
	startScheduler,
	stopScheduler,
	updateInstanceSchedule,
	triggerManualScan,
	getSchedulerStatus,
	getInstanceStatus,
	isInstanceRunning,
} from '../utils/crossSeedScheduler'
import { clearCacheForInstance, clearOutputForInstance, getCacheStats, getOutputStats } from '../utils/crossSeedCache'

const crossSeed = new Hono<{ Variables: { user: User } }>()

crossSeed.use('*', authMiddleware)

function userOwnsInstance(userId: number, instanceId: number): boolean {
	const instance = db.query<{ id: number }, [number, number]>(
		'SELECT id FROM instances WHERE id = ? AND user_id = ?'
	).get(instanceId, userId)
	return !!instance
}

crossSeed.get('/config/:instanceId', (c) => {
	const user = c.get('user')
	const instanceId = parseInt(c.req.param('instanceId'))
	if (!userOwnsInstance(user.id, instanceId)) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	const config = db.query<CrossSeedConfig, [number]>(
		'SELECT * FROM cross_seed_config WHERE instance_id = ?'
	).get(instanceId)

	if (!config) {
		return c.json({
			instance_id: instanceId,
			enabled: false,
			interval_hours: 24,
			dry_run: true,
			category_suffix: '_cross-seed',
			tag: 'cross-seed',
			skip_recheck: false,
			integration_id: null,
			last_run: null,
			next_run: null,
		})
	}

	return c.json({
		...config,
		enabled: !!config.enabled,
		dry_run: !!config.dry_run,
		skip_recheck: !!config.skip_recheck,
	})
})

crossSeed.put('/config/:instanceId', async (c) => {
	const user = c.get('user')
	const instanceId = parseInt(c.req.param('instanceId'))
	if (!userOwnsInstance(user.id, instanceId)) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	const body = await c.req.json()
	const { enabled, interval_hours, dry_run, category_suffix, tag, skip_recheck, integration_id } = body

	const existing = db.query<{ instance_id: number }, [number]>(
		'SELECT instance_id FROM cross_seed_config WHERE instance_id = ?'
	).get(instanceId)

	if (existing) {
		db.run(
			`UPDATE cross_seed_config SET
				enabled = ?, interval_hours = ?, dry_run = ?, category_suffix = ?,
				tag = ?, skip_recheck = ?, integration_id = ?, updated_at = unixepoch()
			WHERE instance_id = ?`,
			[
				enabled ? 1 : 0,
				interval_hours ?? 24,
				dry_run ? 1 : 0,
				category_suffix ?? '_cross-seed',
				tag ?? 'cross-seed',
				skip_recheck ? 1 : 0,
				integration_id ?? null,
				instanceId,
			]
		)
	} else {
		db.run(
			`INSERT INTO cross_seed_config
				(instance_id, enabled, interval_hours, dry_run, category_suffix, tag, skip_recheck, integration_id)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				instanceId,
				enabled ? 1 : 0,
				interval_hours ?? 24,
				dry_run ? 1 : 0,
				category_suffix ?? '_cross-seed',
				tag ?? 'cross-seed',
				skip_recheck ? 1 : 0,
				integration_id ?? null,
			]
		)
	}

	updateInstanceSchedule(instanceId, !!enabled)

	return c.json({ success: true })
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

	const searchees = db.query<CrossSeedSearchee & { decision_count: number }, [number, number, number]>(`
		SELECT s.*, COUNT(d.id) as decision_count
		FROM cross_seed_searchee s
		LEFT JOIN cross_seed_decision d ON s.id = d.searchee_id
		WHERE s.instance_id = ?
		GROUP BY s.id
		ORDER BY s.last_searched DESC
		LIMIT ? OFFSET ?
	`).all(instanceId, limit, offset)

	const total = db.query<{ count: number }, [number]>(
		'SELECT COUNT(*) as count FROM cross_seed_searchee WHERE instance_id = ?'
	).get(instanceId)

	return c.json({ searchees, total: total?.count ?? 0 })
})

crossSeed.get('/history/:instanceId/:searcheeId/decisions', (c) => {
	const user = c.get('user')
	const instanceId = parseInt(c.req.param('instanceId'))
	const searcheeId = parseInt(c.req.param('searcheeId'))
	if (!userOwnsInstance(user.id, instanceId)) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	const searchee = db.query<{ id: number }, [number, number]>(
		'SELECT id FROM cross_seed_searchee WHERE id = ? AND instance_id = ?'
	).get(searcheeId, instanceId)
	if (!searchee) {
		return c.json({ error: 'Searchee not found' }, 404)
	}

	const decisions = db.query<CrossSeedDecision, [number]>(
		'SELECT * FROM cross_seed_decision WHERE searchee_id = ? ORDER BY last_seen DESC'
	).all(searcheeId)

	return c.json(decisions)
})

crossSeed.delete('/history/:instanceId', (c) => {
	const user = c.get('user')
	const instanceId = parseInt(c.req.param('instanceId'))
	if (!userOwnsInstance(user.id, instanceId)) {
		return c.json({ error: 'Instance not found' }, 404)
	}

	const result = db.run('DELETE FROM cross_seed_searchee WHERE instance_id = ?', [instanceId])
	return c.json({ deleted: result.changes })
})

export { crossSeed, startScheduler, stopScheduler }
