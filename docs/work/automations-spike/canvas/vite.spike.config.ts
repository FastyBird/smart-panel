// THROWAWAY SPIKE (AU-0): reuses vite.config.ts unchanged and only swaps the HTML entry and output folder,
// so the spike page is built by exactly the admin's plugin chain.
//   SPIKE_ENTRY=spike   -> spike.html only (default)
//   SPIKE_ENTRY=admin   -> index.html only (baseline for size comparison)
//   SPIKE_BASE=/prefix/ -> non-root base (Home Assistant ingress check)
//   SPIKE_STUB_CANVAS=f -> replace automation-canvas.vue with a stub (A/B size measurement)
//   SPIKE_SPLIT=1       -> put the canvas library into its own chunk so its size can be read off the build output
import { resolve } from 'path';
import { type UserConfig, defineConfig, mergeConfig } from 'vite';

import baseConfig from './vite.config';

export default defineConfig((env): UserConfig => {
	const base = typeof baseConfig === 'function' ? (baseConfig as (config: unknown) => UserConfig)(env) : (baseConfig as UserConfig);
	const entry = process.env.SPIKE_ENTRY === 'admin' ? 'index.html' : 'spike.html';

	return mergeConfig(base, {
		base: process.env.SPIKE_BASE || base.base,
		resolve: {
			// Size measurement only: SPIKE_STUB_CANVAS=<file> swaps the wrapper for a stub, so (normal build - stub build) = canvas library + wrapper.
			alias: process.env.SPIKE_STUB_CANVAS ? [{ find: /^.*\/automation-canvas\.vue$/, replacement: process.env.SPIKE_STUB_CANVAS }] : [],
		},
		build: {
			outDir: process.env.SPIKE_OUT_DIR || 'node_modules/.spike-dist',
			emptyOutDir: true,
			rolldownOptions: {
				input: resolve(__dirname, entry),
				output:
					process.env.SPIKE_SPLIT === '1'
						? {
								// Size measurement only: isolate the canvas library and everything only it pulls in.
								codeSplitting: {
									groups: [
										{
											name: 'vendor-vue-flow',
											test: /node_modules[\\/](\.pnpm[\\/])?(@vue-flow|d3-[a-z]+@|@vueuse\+(core|shared)@10|vue-demi)/,
											priority: 20,
										},
										{ name: 'spike-app', test: /automations-spike/, priority: 10 },
									],
								},
							}
						: {},
			},
		},
	});
});
