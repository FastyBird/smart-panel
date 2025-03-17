import { defineConfig, presetUno } from 'unocss';

import transformerVariantGroup from '@unocss/transformer-variant-group';

export default defineConfig({
	theme: {
		colors: {
			brand: {
				primary: '#d9230f',
				secondary: '#444',
				// Dark mode colors
				darkPrimary: '#a91b0c',
				darkSecondary: '#444',
			},
			white: '#fff',
			menu: {
				background: '#222',
				color: '#a6a6a6',
				active: '#fff',
				// Dark mode colors
				darkBackground: '#0a0a0a',
				darkColor: '#a6a6a6',
				darkActive: '#fff',
			},
			success: '#67c23a',
			warning: '#e6a23c',
			danger: '#f56c6c',
			error: '#f56c6c',
			info: '#909399',
			shadow: 'rgba(0, 0, 0, 0.5)',
		},
		boxShadow: {
			top: '0 -3px 9px rgba(0, 0, 0, 0.5)',
		},
		breakpoints: {
			xs: '0px',
			sm: '576px',
			md: '768px',
			lg: '992px',
			xl: '1200px',
			xxl: '1400px',
		},
	},
	presets: [presetUno({ dark: 'class' })],
	transformers: [transformerVariantGroup()],
	content: {
		pipeline: {
			include: [/\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html|ts)($|\?)/],
		},
	},
});
