/**
 * Lets `node --test` run the TypeScript sources directly (Node strips the types itself):
 *
 * - a relative `./x.js` import resolves to `./x.ts` when only the source exists, since nothing is built;
 * - the SDK resolves to the monorepo copy when the package is not installed, because the example extension
 *   is not part of the pnpm workspace (build the SDK first: `pnpm --filter @fastybird/smart-panel-extension-sdk build`).
 */
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const SDK = '@fastybird/smart-panel-extension-sdk';
const SDK_IN_MONOREPO = new URL('../../extension-sdk/dist/index.js', import.meta.url);

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier.endsWith('.js') && (specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
			const source = new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL);

			if (!existsSync(fileURLToPath(new URL(specifier, context.parentURL))) && existsSync(fileURLToPath(source))) {
				return nextResolve(source.href, context);
			}
		}

		if (specifier === SDK) {
			try {
				return nextResolve(specifier, context);
			} catch {
				return nextResolve(SDK_IN_MONOREPO.href, context);
			}
		}

		return nextResolve(specifier, context);
	},
});
