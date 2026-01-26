import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json'

export default defineConfig(() => {
	return {
		plugins: [react(), tailwindcss()],
		define: {
			__APP_VERSION__: JSON.stringify(pkg.version),
		},
		build: {
			rollupOptions: {
				output: {
					manualChunks(id) {
						if (id.includes('node_modules')) {
							if (id.includes('react') || id.includes('scheduler')) return 'vendor'
							if (id.includes('@tanstack')) return 'vendor'
							if (
								id.includes('vaul') ||
								id.includes('react-remove-scroll') ||
								id.includes('use-callback-ref') ||
								id.includes('use-sidecar') ||
								id.includes('react-style-singleton') ||
								id.includes('aria-hidden') ||
								id.includes('@radix-ui')
							)
								return 'vendor'
							if (id.includes('jszip')) return 'jszip'
							const match = id.match(/node_modules\/(?:\.pnpm\/)?([^@/][^/]*)/)
							if (match) return `lib-${match[1]}`
						}
					},
				},
			},
		},
		server: {
			proxy: {
				'/api/instances': {
					target: 'http://localhost:3000',
					changeOrigin: true,
					timeout: 120000,
				},
				'/api': {
					target: 'http://localhost:3000',
					changeOrigin: true,
				},
			},
		},
	}
})
