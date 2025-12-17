import { execSync } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	type ClassType,
	type DiscoveredAdminExtension,
	type DiscoveredBackendExtension,
	type SmartPanelAdminExtensionManifest,
	type SmartPanelBackendExtensionManifest,
	isSmartPanelAdminExtensionManifest,
	isSmartPanelBackendExtensionManifest,
	normalizeRoutePrefix,
} from '@fastybird/smart-panel-extension-sdk';

interface DiscoverOptions {
	extraDirs?: string[];
	// e.g. ["@fastybird/smart-panel-module-", "fastybird-smart-panel-plugin-", ...]
	namePrefixes?: string[];
}

interface PackageJsonLite {
	name?: string;
	type?: string;
	main?: string;
	module?: string;
	exports?: string | Record<string, unknown>;
	fastybird?: {
		smartPanelBackend?: SmartPanelBackendExtensionManifest & {
			displayName?: string;
			description?: string;
		};
		smartPanelAdmin?: SmartPanelAdminExtensionManifest & {
			displayName?: string;
			description?: string;
		};
	};
}

function readJsonSafe<T = unknown>(p: string): T | null {
	try {
		return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
	} catch {
		return null;
	}
}

function safeStat(p: string): fs.Stats | null {
	try {
		return fs.statSync(p);
	} catch {
		return null;
	}
}

function* walkNodeModules(root: string): Generator<string> {
	if (!fs.existsSync(root)) {
		return;
	}

	let dirents: fs.Dirent[];

	try {
		dirents = fs.readdirSync(root, { withFileTypes: true });
	} catch {
		return;
	}

	for (const d of dirents) {
		if (d.name.startsWith('.')) {
			continue;
		}

		const full = path.join(root, d.name);

		// Handle scopes like "@types"
		if (d.isDirectory() && d.name.startsWith('@')) {
			yield* walkNodeModules(full);

			continue;
		}

		// Non-scoped: only yield real packages (have package.json)
		if (d.isDirectory()) {
			const pkgJson = path.join(full, 'package.json');

			if (fs.existsSync(pkgJson)) {
				yield full;
			}

			continue;
		}

		// PNPM symlink case
		if (d.isSymbolicLink()) {
			const stat = safeStat(full);

			if (!stat || !stat.isDirectory()) {
				continue;
			}

			const pkgJson = path.join(full, 'package.json');

			if (fs.existsSync(pkgJson)) {
				yield full;
			}

			continue;
		}
	}
}

function* walkDirOnce(dir: string): Generator<string> {
	if (!fs.existsSync(dir)) {
		return;
	}

	let dirents: fs.Dirent[];

	try {
		dirents = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}

	for (const d of dirents) {
		const full = path.join(dir, d.name);

		if (d.isDirectory()) {
			const pkgJson = path.join(full, 'package.json');

			if (fs.existsSync(pkgJson)) {
				yield full;
			}

			continue;
		}

		if (d.isSymbolicLink()) {
			const stat = safeStat(full);

			if (!stat || !stat.isDirectory()) {
				continue;
			}

			const pkgJson = path.join(full, 'package.json');

			if (fs.existsSync(pkgJson)) {
				yield full;
			}

			continue;
		}
	}
}

function looksLikeExtensionName(name: string, prefixes: string[]) {
	return prefixes.some((p) => name.startsWith(p));
}

function isEsmPackage(pkg: PackageJsonLite, entryAbs: string): boolean {
	// mark as ESM if package has "type":"module" or entry is .mjs
	return pkg.type === 'module' || entryAbs.endsWith('.mjs');
}

function resolveEntry(pkg: PackageJsonLite): string | undefined {
	if (typeof pkg.module === 'string') {
		return pkg.module; // often ESM
	}

	if (typeof pkg.main === 'string') {
		return pkg.main; // often CJS
	}

	if (typeof pkg.exports === 'string') {
		return pkg.exports;
	}

	return undefined;
}

/**
 * Load a backend module entry:
 *  - ESM → force native dynamic import (file:// URL) to avoid TS downlevel to require()
 *  - CJS → `await import(absPath)` (TS downlevels to require(absPath) in CJS targets)
 */
async function loadBackendModule(pkg: PackageJsonLite, entryAbs: string): Promise<Record<string, unknown>> {
	if (!fs.existsSync(entryAbs)) {
		const pkgName = pkg.name ?? '<unknown>';

		throw new Error(
			`Extension entry not found: ${entryAbs}. Did you build the extension? (e.g. "pnpm -F ${pkgName} build")`,
		);
	}

	if (isEsmPackage(pkg, entryAbs)) {
		const fileUrl = pathToFileURL(entryAbs).href;
		// eslint-disable-next-line @typescript-eslint/no-implied-eval
		const nativeImport = new Function('u', 'return import(u)') as (u: string) => Promise<Record<string, unknown>>;

		return await nativeImport(fileUrl);
	}

	// CJS path – absolute import; TS will downlevel to require(absPath) in CJS
	return (await import(entryAbs)) as unknown as Record<string, unknown>;
}

export async function discoverExtensions(
	options?: DiscoverOptions,
): Promise<{ backend: DiscoveredBackendExtension[]; admin: DiscoveredAdminExtension[] }> {
	const prefixes = options?.namePrefixes ?? [
		'@fastybird/smart-panel-module-',
		'fastybird-smart-panel-module-',
		'@fastybird/smart-panel-plugin-',
		'fastybird-smart-panel-plugin-',
		'@fastybird/smart-panel-extension-',
		'fastybird-smart-panel-extension-',
	];

	const root = process.cwd();

	// Collect candidate package dirs
	const candidates = new Set<string>();

	for (const dir of [
		path.join(root, 'node_modules'),
		path.join(root, '..', 'node_modules'),
		...buildPaths().values(),
		...(options?.extraDirs ?? []),
	]) {
		for (const pkgDir of walkNodeModules(dir)) {
			candidates.add(pkgDir);
		}
	}

	for (const devDir of options?.extraDirs ?? []) {
		for (const pkgDir of walkDirOnce(devDir)) {
			candidates.add(pkgDir);
		}
	}

	const backendByKey = new Map<string, { item: DiscoveredBackendExtension; dir: string }>();
	const adminByKey = new Map<string, { item: DiscoveredAdminExtension & { packageDir: string }; dir: string }>();

	for (const pkgDir of candidates) {
		const pkgJsonPath = path.join(pkgDir, 'package.json');
		const pkg = readJsonSafe<PackageJsonLite>(pkgJsonPath);

		if (!pkg?.name || !looksLikeExtensionName(pkg.name, prefixes)) {
			continue;
		}

		const backendUnknown = pkg.fastybird?.smartPanelBackend;
		const adminUnknown = pkg.fastybird?.smartPanelAdmin;

		const hasBackend = isSmartPanelBackendExtensionManifest(backendUnknown);
		const hasAdmin = isSmartPanelAdminExtensionManifest(adminUnknown);

		if (!hasBackend && !hasAdmin) {
			continue;
		}

		// BACKEND: resolve & load only when backend manifest is present
		if (hasBackend) {
			const backendManifest = backendUnknown as SmartPanelBackendExtensionManifest;

			const entry = resolveEntry(pkg);

			if (entry) {
				const entryAbs = path.join(pkgDir, entry);

				if (fs.existsSync(entryAbs)) {
					const mod = await loadBackendModule(pkg, entryAbs);
					const extensionClass = mod[backendManifest.extensionExport] as ClassType<unknown>;

					if (typeof extensionClass === 'function') {
						const routePrefix = normalizeRoutePrefix(backendManifest.routePrefix);

						const key = backendKey(pkg.name, backendManifest.kind, routePrefix);

						const candidate = {
							item: {
								pkgName: pkg.name,
								routePrefix,
								extensionClass,
								kind: backendManifest.kind,
								packageDir: pkgDir,
								displayName: (backendManifest as { displayName?: string }).displayName,
								description: (backendManifest as { description?: string }).description,
							},
							dir: pkgDir,
						};

						const existing = backendByKey.get(key);

						if (!existing || rankDir(candidate.dir) > rankDir(existing.dir)) {
							backendByKey.set(key, candidate);
						}
					}
				}
			}
		}

		// ADMIN: no runtime import — just produce data for build-time or remote runtime
		if (hasAdmin) {
			const adminManifest = adminUnknown as SmartPanelAdminExtensionManifest;

			const importPath = adminManifest.importPath ?? pkg.name;

			const key = adminKey(pkg.name, adminManifest.kind, importPath, adminManifest.extensionEntry);

			const candidate = {
				item: {
					pkgName: pkg.name,
					importPath,
					extensionExport: adminManifest.extensionExport, // optional (default export otherwise)
					extensionEntry: adminManifest.extensionEntry, // optional (for remote/runtime)
					kind: adminManifest.kind,
					displayName: (adminManifest as { displayName?: string }).displayName,
					description: (adminManifest as { description?: string }).description,
					packageDir: pkgDir,
				},
				dir: pkgDir,
			};

			const existing = adminByKey.get(key);

			if (!existing || rankDir(candidate.dir) > rankDir(existing.dir)) {
				adminByKey.set(key, candidate);
			}
		}
	}

	return {
		backend: Array.from(backendByKey.values()).map((v) => v.item),
		admin: Array.from(adminByKey.values()).map((v) => v.item),
	};
}

const buildPaths = (): Set<string> => {
	const paths: Set<string> = new Set();

	if (process.env.NODE_PATH) {
		process.env.NODE_PATH.split(path.delimiter)
			.filter((path) => !!path) // trim out empty values
			.forEach((path) => paths.add(path));
	} else {
		// Default paths for non-windows systems
		if (process.platform !== 'win32') {
			paths.add('/usr/local/lib/node_modules');
			paths.add('/usr/lib/node_modules');
		}

		if (process.platform === 'win32') {
			paths.add(path.join(process.env.APPDATA, 'npm/node_modules'));
		} else {
			paths.add(
				execSync('/bin/echo -n "$(npm -g prefix)/lib/node_modules"', {
					env: Object.assign(
						{
							npm_config_loglevel: 'silent',
							npm_update_notifier: 'false',
						},
						process.env,
					),
				}).toString('utf8'),
			);
		}
	}

	return paths;
};

const rankDir = (p: string): number => {
	if (p.includes(`${path.sep}apps${path.sep}backend${path.sep}node_modules${path.sep}`)) {
		return 5;
	}

	if (p.includes(`${path.sep}apps${path.sep}`) && p.includes(`${path.sep}node_modules${path.sep}`)) {
		return 4;
	}

	if (p.includes(`${path.sep}node_modules${path.sep}`) && p.includes(`${path.sep}..${path.sep}`)) {
		return 3;
	}

	if (p.startsWith('/usr') || p.includes(`${path.sep}npm${path.sep}node_modules`)) {
		return 2;
	}

	return 1;
};

const backendKey = (pkgName: string, kind: string, routePrefix: string): string => {
	return `${pkgName}::${kind}::${routePrefix}`;
};

const adminKey = (pkgName: string, kind: string, importPath: string, entry?: string): string => {
	return `${pkgName}::${kind}::${importPath}::${entry ?? ''}`;
};
