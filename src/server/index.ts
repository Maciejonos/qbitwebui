import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'
import { AUTH_DISABLED } from './db'
import auth from './routes/auth'
import instances from './routes/instances'
import proxy from './routes/proxy'
import integrations from './routes/integrations'
import files from './routes/files'
import tools from './routes/tools'
import { log } from './utils/logger'

const banner = `
   ___  ____ ___ _______        _______ ____  _   _ ___
  / _ \\| __ )_ _|_   _\\ \\      / / ____| __ )| | | |_ _|
 | | | |  _ \\| |  | |  \\ \\ /\\ / /|  _| |  _ \\| | | || |
 | |_| | |_) | |  | |   \\ V  V / | |___| |_) | |_| || |
  \\__\\_\\____/___| |_|    \\_/\\_/  |_____|____/ \\___/|___|
`
const app = new Hono()

app.use('*', cors({
	origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
	credentials: true,
}))

app.get('/api/config', (c) => c.json({ authDisabled: AUTH_DISABLED, filesEnabled: !!process.env.DOWNLOADS_PATH }))

app.route('/api/auth', auth)
app.route('/api/instances', instances)
app.route('/api/instances', proxy)
app.route('/api/integrations', integrations)
app.route('/api/files', files)
app.route('/api/tools', tools)

if (process.env.NODE_ENV === 'production') {
	app.use('/*', serveStatic({ root: './dist' }))
	app.get('*', serveStatic({ path: './dist/index.html' }))
}

const port = Number(process.env.PORT) || 3000
const env = process.env.NODE_ENV || 'development'

console.log(banner)
log.info(`Server running on port ${port} (${env})`)

export default {
	port,
	fetch: app.fetch,
}
