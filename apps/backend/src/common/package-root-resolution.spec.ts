import { readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';

/**
 * Guard against reading the wrong `package.json`.
 *
 * Several services read this package's own `package.json` to report the running version.
 * They do it with a relative walk up from `__dirname`, which is evaluated against the
 * *compiled* location under `dist/`. Two layouts have to agree:
 *
 *   dev     <repo>/apps/backend/dist/modules/system/services
 *   deployed /opt/smart-panel/v<version>/dist/modules/system/services
 *
 * In a dev checkout an over-long walk still lands on a real file — the monorepo root
 * `package.json` — so the mistake is invisible locally and in CI. Deployed, the same walk
 * escapes the install directory entirely (`/opt/package.json`) and throws ENOENT. Where the
 * read happens at module scope that ENOENT is fatal: it fires during `require` and the app
 * never reaches `listen`, which is exactly how v1.0.0-beta bricked image installs.
 *
 * The invariant these call sites must satisfy: the walk resolves to *this* package's root,
 * identified by name rather than by mere existence.
 */
describe('package.json resolution', () => {
	// This spec lives at src/common, so two levels up is the backend package root.
	const BACKEND_ROOT = resolve(__dirname, '../..');
	const EXPECTED_NAME = '@fastybird/smart-panel-backend';

	/** Source files that resolve this package's own package.json from __dirname. */
	const CALL_SITES = [
		'modules/system/services/backup.service.ts',
		'modules/system/services/update.service.ts',
		'modules/system/controllers/system.controller.ts',
		'modules/mdns/services/mdns.service.ts',
	];

	/**
	 * Pull the relative package.json path out of the source, tolerating both spellings in
	 * use: resolve(__dirname, '../../../../package.json') and
	 * join(__dirname, '..', '..', '..', '..', 'package.json').
	 */
	const extractRelativePath = (source: string): string => {
		const singleLiteral = /(?:resolve|join)\(\s*__dirname\s*,\s*'((?:\.\.\/)+package\.json)'\s*\)/.exec(source);

		if (singleLiteral) {
			return singleLiteral[1];
		}

		const segmented = /(?:resolve|join)\(\s*__dirname\s*,\s*((?:'\.\.'\s*,\s*)+)'package\.json'\s*\)/.exec(source);

		if (segmented) {
			const depth = (segmented[1].match(/'\.\.'/g) ?? []).length;

			return `${'../'.repeat(depth)}package.json`;
		}

		throw new Error('No __dirname-relative package.json resolution found');
	};

	it.each(CALL_SITES)('%s resolves to this package root once compiled', (relativeSource) => {
		const source = readFileSync(join(BACKEND_ROOT, 'src', relativeSource), 'utf-8');
		const relativePath = extractRelativePath(source);

		// Mirror the compiled layout: src/<path>.ts -> dist/<path>.js
		const compiledDir = join(BACKEND_ROOT, 'dist', dirname(relativeSource));
		const resolved = resolve(compiledDir, relativePath);

		expect(resolved).toBe(join(BACKEND_ROOT, 'package.json'));

		const pkg = JSON.parse(readFileSync(resolved, 'utf-8')) as { name: string };

		expect(pkg.name).toBe(EXPECTED_NAME);
	});
});
