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
					manualChunks: {
						vendor: ['react', 'react-dom', '@tanstack/react-query'],
					},
				},
			},
		},
		server: {
			proxy: {
				'/api': {
					target: 'http://localhost:3000',
					changeOrigin: true,
				},
			},
		},
	}
})
