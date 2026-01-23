import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const env = loadEnv('', process.cwd(), '')
const isCI = env.CI === 'true' || process.env.CI === 'true'

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'bun:sqlite': resolve(__dirname, '__tests__/__mocks__/bun-sqlite.ts'),
		},
	},
	test: {
		globals: true,
		environment: 'jsdom',
		include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
		reporters: isCI ? ['default'] : ['./__tests__/reporter.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: ['src/**/*.{ts,tsx}'],
			exclude: ['src/**/*.d.ts', 'src/main.tsx'],
		},
	},
})
