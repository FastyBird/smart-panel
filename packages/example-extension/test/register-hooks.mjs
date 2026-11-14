/**
 * Lets `node --test` run the TypeScript sources directly (Node strips the types itself):
 *
 * - a relative `./x.js` import resolves to `./x.ts` when only the source exists, since nothing is built;
 * - the SDK resolves to the monorepo copy when the package is not installed, because the example extension
 *   is not part of the pnpm workspace (build the SDK first: `pnpm --filter @fastybird/smart-panel-extension-sdk build`).
 *
 * Both need Node.js 22.18 or newer (`module.registerHooks` and type stripping without a flag); the monorepo
 * itself uses Node.js 24. The extension's own `engines` range is about where its built output runs, not this.
 */
import { existsSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { fileURLToPath } from 'node:url';

const SDK = '@fastybird/smart-panel-extension-sdk';
const SDK_IN_MONOREPO = new URL('../../extension-sdk/dist/index.js', import.meta.url);

const [major, minor] = process.versions.node.split('.').map(Number);

if (major < 22 || (major === 22 && minor < 18) || typeof nodeModule.registerHooks !== 'function') {
	console.error(
		`The example extension tests need Node.js 22.18 or newer (the monorepo uses 24); this is ${process.version}.`,
	);
	process.exit(1);
}

nodeModule.registerHooks({
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
