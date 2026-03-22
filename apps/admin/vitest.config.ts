import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

const resolvedViteConfig = typeof viteConfig === 'function' ? viteConfig({ mode: 'test', command: 'serve' }) : viteConfig;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const openapiReal = path.resolve(__dirname, 'src', 'openapi.ts');
const openapiStub = path.resolve(__dirname, 'src', '__mocks__', 'openapi.ts');

export default mergeConfig(
	resolvedViteConfig,
	defineConfig({
		test: {
			globals: true,
			environment: 'jsdom',
			exclude: [...configDefaults.exclude, 'e2e/**'],
			root: fileURLToPath(new URL('./', import.meta.url)),
		},
		resolve: {
			alias: {
				// When the generated openapi.ts does not exist (it is gitignored),
				// fall back to a lightweight stub so transitive imports do not fail.
				...(existsSync(openapiReal) ? {} : { [openapiReal]: openapiStub }),
			},
		},
	})
);
