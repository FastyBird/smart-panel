/*
eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment,
@typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { execSync } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';

import { discoverExtensions } from './extensions.discovery';

jest.mock('child_process', () => ({
	execSync: jest.fn(() => Buffer.from('/usr/local', 'utf8')),
}));

type DirLike = {
	name: string;
	isDir?: boolean;
	isLink?: boolean;
};

const makeDirent = (e: DirLike): fs.Dirent =>
	({
		name: e.name,
		isDirectory: () => !!e.isDir,
		isSymbolicLink: () => !!e.isLink,
	}) as unknown as fs.Dirent;

describe('discoverExtensions', () => {
	const CWD = '/repo/apps/backend';
	const LOCAL_NM = path.join(CWD, 'node_modules'); // rank 5
	const PARENT_NM = path.join(CWD, '..', 'node_modules'); // rank 3 in our rankDir

	const PKG_BACKEND_LOCAL = path.join(LOCAL_NM, 'acme-backend');
	const PKG_ADMIN_LOCAL = path.join(LOCAL_NM, 'acme-admin');
	const PKG_BACKEND_PARENT = path.join(PARENT_NM, 'acme-backend'); // duplicate backend (lower rank)

	const BACKEND_NAME = '@fastybird/smart-panel-module-acme';
	const ADMIN_NAME = '@fastybird/smart-panel-extension-acme-admin';

	let existsSpy: jest.SpyInstance;
	let readdirSpy: jest.SpyInstance;
	let readFileSpy: jest.SpyInstance;

	beforeEach(() => {
		// Fake current working dir
		jest.spyOn(process, 'cwd').mockReturnValue(CWD as unknown as string);

		// FS mocks
		existsSpy = jest.spyOn(fs, 'existsSync');
		readdirSpy = jest.spyOn(fs, 'readdirSync');
		readFileSpy = jest.spyOn(fs, 'readFileSync');

		// Default: nothing exists unless specified
		existsSpy.mockImplementation(() => false);

		// node_modules trees
		readdirSpy.mockImplementation((p: fs.PathLike) => {
			const dir = String(p);
			if (dir === LOCAL_NM) {
				return [makeDirent({ name: 'acme-backend', isDir: true }), makeDirent({ name: 'acme-admin', isDir: true })];
			}
			if (dir === PARENT_NM) {
				return [makeDirent({ name: 'acme-backend', isDir: true })];
			}
			// package root directories have no children enumerated by our code (we only read package.json)
			return [];
		});

		// readdir with withFileTypes true is used; the mock above ignores opts, fine for our tests.

		// Provide package.json and entry files existence
		existsSpy.mockImplementation((p: fs.PathLike) => {
			const s = String(p);

			// local node_modules dirs exist
			if (s === LOCAL_NM || s === PARENT_NM) return true;

			// package.json files
			if (s === path.join(PKG_BACKEND_LOCAL, 'package.json')) return true;
			if (s === path.join(PKG_ADMIN_LOCAL, 'package.json')) return true;
			if (s === path.join(PKG_BACKEND_PARENT, 'package.json')) return true;

			// backend entries
			if (s === path.join(PKG_BACKEND_LOCAL, 'dist/index.mjs')) return true; // ESM path
			if (s === path.join(PKG_BACKEND_PARENT, 'dist/index.mjs')) return true;

			// admin doesn’t need entry existence check for discover step, but its asset will be later served
			return false;
		});

		// Return package.json contents
		readFileSpy.mockImplementation((p: fs.PathLike) => {
			const s = String(p);

			if (s === path.join(PKG_BACKEND_LOCAL, 'package.json')) {
				return JSON.stringify({
					name: BACKEND_NAME,
					type: 'module', // ensures ESM path
					module: 'dist/index.mjs',
					fastybird: {
						smartPanelBackend: {
							kind: 'module',
							routePrefix: 'devices/acme',
							extensionExport: 'BackendModule',
							displayName: 'Acme Backend Local',
							description: 'Local backend ext',
						},
					},
				});
			}

			if (s === path.join(PKG_BACKEND_PARENT, 'package.json')) {
				return JSON.stringify({
					name: BACKEND_NAME, // duplicate package name (lower rank)
					type: 'module',
					module: 'dist/index.mjs',
					fastybird: {
						smartPanelBackend: {
							kind: 'module',
							routePrefix: 'devices/acme',
							extensionExport: 'BackendModule',
							displayName: 'Acme Backend Parent',
							description: 'Parent backend ext',
						},
					},
				});
			}

			if (s === path.join(PKG_ADMIN_LOCAL, 'package.json')) {
				return JSON.stringify({
					name: ADMIN_NAME,
					main: 'dist/index.js',
					fastybird: {
						smartPanelAdmin: {
							kind: 'plugin',
							importPath: '@fastybird/smart-panel-extension-acme-admin',
							extensionExport: 'AdminPlugin',
							extensionEntry: 'admin/index.js',
							displayName: 'Acme Admin',
							description: 'Admin ext',
						},
					},
				});
			}

			throw new Error(`Unexpected readFileSync: ${s}`);
		});

		jest.spyOn(global as any, 'Function').mockImplementation((...args: string[]) => {
			const body = args[args.length - 1];

			if (typeof body === 'string' && body.includes('return import(u)')) {
				return (() =>
					Promise.resolve({
						BackendModule: class {},
					})) as any;
			}

			return (Function as any).originalImpl
				? (Function as any).originalImpl(...args)
				: (global as any).eval(`(function(${args.slice(0, -1).join(',')}){${body}})`);
		});

		(Function as any).originalImpl = undefined;
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	it('discovers backend (ESM) and admin extensions, deduping backend by rank', async () => {
		const discovered = await discoverExtensions();

		// backend: should include exactly one (the local rank-5 path wins over parent)
		expect(discovered.backend).toHaveLength(1);

		const be = discovered.backend[0];

		expect(be.pkgName).toBe(BACKEND_NAME);
		expect(be.routePrefix).toBe('devices/acme');
		expect(be.kind).toBe('module');
		expect(typeof be.extensionClass).toBe('function'); // from our shimmed import
		// our code also attaches packageDir; if it’s not in the DiscoveredBackendExtension type,
		// this still exists on the object instance (but we won’t assert on private fields).

		// admin: should include one item with admin-specific fields
		expect(discovered.admin).toHaveLength(1);

		const ad = discovered.admin[0];

		expect(ad.pkgName).toBe(ADMIN_NAME);
		expect(ad.importPath).toBe('@fastybird/smart-panel-extension-acme-admin');
		expect(ad.extensionExport).toBe('AdminPlugin');
		expect(ad.extensionEntry).toBe('admin/index.js');
		expect(ad.kind).toBe('plugin');
	});

	it('skips packages without matching prefixes', async () => {
		// Change admin pkg name to a non-matching prefix
		readFileSpy.mockImplementationOnce((p: fs.PathLike) => {
			// First call in this test will be backend-local (keep same as previous test)
			const s = String(p);

			if (s === path.join(PKG_BACKEND_LOCAL, 'package.json')) {
				return JSON.stringify({
					name: BACKEND_NAME,
					type: 'module',
					module: 'dist/index.mjs',
					fastybird: {
						smartPanelBackend: {
							kind: 'module',
							routePrefix: 'devices/acme',
							extensionExport: 'BackendModule',
						},
					},
				});
			}

			throw new Error('unexpected');
		});

		// Next call for backend parent
		readFileSpy.mockImplementationOnce((p: fs.PathLike) => {
			const s = String(p);

			if (s === path.join(PKG_BACKEND_PARENT, 'package.json')) {
				return JSON.stringify({
					name: BACKEND_NAME,
					type: 'module',
					module: 'dist/index.mjs',
					fastybird: {
						smartPanelBackend: {
							kind: 'module',
							routePrefix: 'devices/acme',
							extensionExport: 'BackendModule',
						},
					},
				});
			}

			throw new Error('unexpected');
		});

		// Then admin local but with a name that won't match allowed prefixes
		readFileSpy.mockImplementationOnce((p: fs.PathLike) => {
			const s = String(p);

			if (s === path.join(PKG_ADMIN_LOCAL, 'package.json')) {
				return JSON.stringify({
					name: 'random-pkg', // <— no allowed prefix
					main: 'dist/index.js',
					fastybird: {
						smartPanelAdmin: {
							kind: 'plugin',
							importPath: 'random-pkg',
							extensionExport: 'AdminPlugin',
							extensionEntry: 'admin/index.js',
						},
					},
				});
			}

			throw new Error('unexpected');
		});

		const discovered = await discoverExtensions();

		expect(discovered.backend).toHaveLength(1);
		expect(discovered.admin).toHaveLength(0); // filtered out by prefix
	});

	it('honors custom namePrefixes and extraDirs', async () => {
		const discovered = await discoverExtensions({
			namePrefixes: ['@fastybird/smart-panel-module-', '@fastybird/smart-panel-extension-'], // subset
			extraDirs: ['/opt/custom-extensions'],
		});

		// Our mock FS doesn’t expose anything under /opt/custom-extensions, but call shouldn’t throw.
		expect(Array.isArray(discovered.backend)).toBe(true);
		expect(Array.isArray(discovered.admin)).toBe(true);
	});

	it('skips backend package when entry missing or export not found', async () => {
		// Make backend-local entry missing
		existsSpy.mockImplementation((p: fs.PathLike) => {
			const s = String(p);

			if (s === LOCAL_NM || s === PARENT_NM) {
				return true;
			}

			if (s.endsWith('package.json')) {
				return true;
			}

			if (s === path.join(PKG_BACKEND_LOCAL, 'dist/index.mjs')) {
				return false; // missing
			}

			return false;
		});

		const discovered = await discoverExtensions();

		expect(discovered.backend).toHaveLength(0);
		expect(discovered.admin).toHaveLength(1);
	});

	it('prefers higher-ranked duplicate backend package locations', async () => {
		// Both locations exist (already configured). Our ranking should select LOCAL_NM (rank 5) over PARENT_NM (rank 3)
		const discovered = await discoverExtensions();

		expect(discovered.backend).toHaveLength(1);

		// We can’t assert packageDir directly if not in the exported type, but we can infer via displayName set in JSON
		// Local JSON had "Acme Backend Local", parent had "Acme Backend Parent".
		const be = discovered.backend[0] as any;

		expect(be.displayName).toBe('Acme Backend Local');
	});

	it('does not throw when buildPaths runs and NODE_PATH is unset', async () => {
		const origNodePath = process.env.NODE_PATH;

		try {
			// simulate unset NODE_PATH
			delete process.env.NODE_PATH;

			// still return something from `npm -g prefix`
			(execSync as jest.Mock).mockReturnValue(Buffer.from('/usr/local', 'utf8'));

			const discovered = await discoverExtensions();

			expect(discovered).toBeDefined();
		} finally {
			// restore env
			if (typeof origNodePath === 'undefined') {
				delete process.env.NODE_PATH;
			} else {
				process.env.NODE_PATH = origNodePath;
			}
		}
	});
});
