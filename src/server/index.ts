import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'
import { AUTH_DISABLED, REGISTRATION_DISABLED, defaultCredentials, clearDefaultCredentials } from './db'
import auth from './routes/auth'
import instances from './routes/instances'
import proxy from './routes/proxy'
import integrations from './routes/integrations'
import files from './routes/files'
import tools from './routes/tools'
import { crossSeed, startScheduler } from './routes/crossSeed'
import { log } from './utils/logger'

const banner = `
   ___  ____ ___ _______        _______ ____  _   _ ___
  / _ \\| __ )_ _|_   _\\ \\      / / ____| __ )| | | |_ _|
 | | | |  _ \\| |  | |  \\ \\ /\\ / /|  _| |  _ \\| | | || |
 | |_| | |_) | |  | |   \\ V  V / | |___| |_) | |_| || |
  \\__\\_\\____/___| |_|    \\_/\\_/  |_____|____/ \\___/|___|
`
const app = new Hono()

app.use(
	'*',
	cors({
		origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
		credentials: true,
	})
)

app.get('/api/config', (c) =>
	c.json({
		authDisabled: AUTH_DISABLED,
		registrationDisabled: REGISTRATION_DISABLED,
		filesEnabled: !!process.env.DOWNLOADS_PATH,
	})
)

app.route('/api/auth', auth)
app.route('/api/instances', instances)
app.route('/api/instances', proxy)
app.route('/api/integrations', integrations)
app.route('/api/files', files)
app.route('/api/tools', tools)
app.route('/api/cross-seed', crossSeed)

if (process.env.NODE_ENV === 'production') {
	app.use('/*', serveStatic({ root: './dist' }))
	app.get('*', serveStatic({ path: './dist/index.html' }))
}

const port = Number(process.env.PORT) || 3000
const env = process.env.NODE_ENV || 'development'

console.log(banner)
log.info(`Server running on port ${port} (${env})`)

if (defaultCredentials) {
	log.info('='.repeat(50))
	log.info('Default admin account created:')
	log.info(`  Username: ${defaultCredentials.username}`)
	log.info(`  Password: ${defaultCredentials.password}`)
	log.info('Please change your password after first login!')
	log.info('='.repeat(50))
	clearDefaultCredentials()
}

startScheduler()

export default {
	port,
	fetch: app.fetch,
}
