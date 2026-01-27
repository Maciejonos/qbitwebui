import { defineConfig } from 'vitepress'

export default defineConfig({
	title: 'qbitwebui',
	description: 'Modern web interface for qBittorrent',
	base: '/qbitwebui/',
	head: [
		['link', { rel: 'icon', href: '/qbitwebui/logo.svg' }]
	],
	themeConfig: {
		logo: '/logo.svg',
		nav: [
			{ text: 'Guide', link: '/guide/getting-started' },
			{ text: 'GitHub', link: 'https://github.com/Maciejonos/qbitwebui' },
		],
		sidebar: [
			{
				text: 'Guide',
				items: [
					{ text: 'Getting Started', link: '/guide/getting-started' },
					{ text: 'Configuration', link: '/guide/configuration' },
					{ text: 'Features', link: '/guide/features' },
					{ text: 'Docker', link: '/guide/docker' },
				],
			},
			{
				text: 'Add-ons',
				items: [{ text: 'Network Agent', link: '/guide/network-agent/' }],
			},
		],
		socialLinks: [{ icon: 'github', link: 'https://github.com/Maciejonos/qbitwebui' }],
		search: { provider: 'local' },
		footer: { message: 'Released under the MIT License.' },
	},
})
