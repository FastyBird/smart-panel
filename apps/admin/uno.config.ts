import { defineConfig, presetUno } from 'unocss';
import type { Theme } from 'unocss/preset-uno';

import transformerVariantGroup from '@unocss/transformer-variant-group';

import { fbShortcuts, fbTheme } from './uno.theme';

export default defineConfig<Theme>({
	theme: fbTheme,
	shortcuts: [fbShortcuts],
	presets: [presetUno({ dark: 'class' })],
	transformers: [transformerVariantGroup()],
	content: {
		pipeline: {
			include: [/\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html|ts)($|\?)/],
		},
	},
});
