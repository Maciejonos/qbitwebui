export interface AppConfig {
	bypassAuth: boolean
}

declare global {
	interface Window {
		__CONFIG__?: AppConfig
	}
}

export function getConfig(): AppConfig {
	return window.__CONFIG__ ?? {
		bypassAuth: false,
	}
}
