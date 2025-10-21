import { resolve } from 'path';
import path from 'path';
import UnoCSS from 'unocss/vite';
import { type UserConfig, defineConfig, loadEnv } from 'vite';
import { viteVConsole } from 'vite-plugin-vconsole';
import vueDevTools from 'vite-plugin-vue-devtools';
import svgLoader from 'vite-svg-loader';

import vueI18n from '@intlify/unplugin-vue-i18n/vite';
import vue from '@vitejs/plugin-vue';
import pkg from './package.json' assert { type: 'json' }

// https://vite.dev/config/
export default defineConfig((config: UserConfig): UserConfig => {
	const env = loadEnv(config.mode ?? 'production', path.resolve(__dirname, '../../'), ['FB_APP_', 'FB_BACKEND_', 'FB_ADMIN_']);

	return {
		envPrefix: ['FB_APP_', 'FB_BACKEND_', 'FB_ADMIN_'],
		envDir: path.resolve(__dirname, '../../'),
		plugins: [
			vue(),
			vueI18n({
				include: [resolve(__dirname, './src/locales/**.json')],
			}),
			vueDevTools(),
			viteVConsole({
				entry: resolve('src/main.ts'), // entry file
				localEnabled: true, // dev environment
				enabled: false, // build production
				config: {
					theme: 'dark',
				},
			}),
			svgLoader(),
			UnoCSS(),
		],
		define: {
			__APP_VERSION__: JSON.stringify(pkg.version),
			__APP_COMMIT__: JSON.stringify(process.env.GITHUB_SHA || ''),
		},
		css: {
			modules: {
				localsConvention: 'camelCaseOnly',
			},
		},
		server: {
			proxy: {
				'/api': {
					target: `${env['FB_APP_HOST']}:${env['FB_BACKEND_PORT']}`,
					changeOrigin: true,
					secure: false,
				},
			},
			watch: {
				usePolling: true,
			},
			hmr: {
				host: 'localhost',
			},
			port: Number(env['FB_ADMIN_PORT']) || 3000,
		},
		preview: {
			port: Number(env['FB_ADMIN_PORT']) || 3000,
		},
	};
});
