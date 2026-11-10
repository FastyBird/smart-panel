// THROWAWAY SPIKE (AU-0): reuses vite.config.ts unchanged and only swaps the HTML entry and output folder,
// so the spike page is built by exactly the admin's plugin chain.
//   SPIKE_ENTRY=spike   -> spike.html only (default)
//   SPIKE_ENTRY=admin   -> index.html only (baseline for size comparison)
//   SPIKE_BASE=/prefix/ -> non-root base (Home Assistant ingress check)
import { resolve } from 'path';
import { type UserConfig, defineConfig, mergeConfig } from 'vite';

import baseConfig from './vite.config';

export default defineConfig((env): UserConfig => {
	const base = typeof baseConfig === 'function' ? (baseConfig as (config: unknown) => UserConfig)(env) : (baseConfig as UserConfig);
	const entry = process.env.SPIKE_ENTRY === 'admin' ? 'index.html' : 'spike.html';

	return mergeConfig(base, {
		base: process.env.SPIKE_BASE || base.base,
		build: {
			outDir: process.env.SPIKE_OUT_DIR || 'dist-spike',
			emptyOutDir: true,
			rollupOptions: {
				input: resolve(__dirname, entry),
			},
		},
	});
});
