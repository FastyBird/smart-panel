/*
eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access,
@typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import fs from 'node:fs';
import type { ReadStream } from 'node:fs';
import path from 'node:path';

import type { DiscoveredAdminExtension, DiscoveredBackendExtension } from '@fastybird/smart-panel-extension-sdk';
import { Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { ExtensionSourceType, ExtensionSurfaceType, SYSTEM_MODULE_PREFIX } from '../system.constants';

import { ExtensionsController } from './extensions.controller';

jest.mock('../../../common/extensions/extensions.discovery-cache', () => ({
	getDiscoveredExtensions: jest.fn(),
}));

jest.mock('../../../common/utils/transform.utils', () => ({
	// make toInstance a simple passthrough for predictable assertions
	toInstance: <T>(_cls: new () => T, obj: T) => obj,
}));

jest.mock('mime-types', () => ({
	lookup: jest.fn().mockReturnValue('application/javascript'),
}));

const mockedGetDiscovered = require('../../../common/extensions/extensions.discovery-cache')
	.getDiscoveredExtensions as jest.Mock;

const mockedMimeLookup = require('mime-types').lookup as jest.Mock;

const createReply = () => {
	const headers: Record<string, string> = {};
	let statusCode: number | undefined;
	let sent: unknown;

	const reply = {
		header: (k: string, v: string) => {
			headers[k] = v;
		},
		status: (code: number) => {
			statusCode = code;

			return reply;
		},
		send: (val: unknown) => {
			sent = val;

			return val;
		},
		get _headers() {
			return headers;
		},
		get _status() {
			return statusCode;
		},
		get _sent() {
			return sent;
		},
	};

	return reply;
};

type ReplyStub = ReturnType<typeof createReply>;

const PKG_DIR_ADMIN = path.resolve('/tmp/pkg-admin');
const PKG_DIR_BACK = path.resolve('/tmp/pkg-backend');

const discoveredAdmin: DiscoveredAdminExtension = {
	pkgName: '@acme/admin-ext',
	importPath: '@acme/admin-ext',
	extensionExport: undefined,
	extensionEntry: 'admin/index.js',
	kind: 'plugin',
	displayName: 'Acme Admin',
	description: 'Admin demo',
	packageDir: PKG_DIR_ADMIN,
};

const discoveredBackend: DiscoveredBackendExtension = {
	pkgName: '@acme/backend-ext',
	routePrefix: 'devices/acme',
	extensionClass: class {},
	kind: 'module',
	displayName: 'Acme Backend',
	description: 'Backend demo',
	packageDir: PKG_DIR_BACK,
};

describe('ExtensionsController', () => {
	let controller: ExtensionsController;
	let reply: ReplyStub;

	const fsExistsSpy = jest.spyOn(fs, 'existsSync');
	const fsStatSpy = jest.spyOn(fs, 'statSync');
	const fsReadSpy = jest.spyOn(fs, 'readFileSync');
	const fsStreamSpy = jest.spyOn(fs, 'createReadStream');

	beforeAll(() => {
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined as any);
	});

	beforeEach(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [ExtensionsController],
			providers: [
				{
					provide: NestConfigService,
					useValue: {
						get: (key: string) => {
							if (key === 'FB_CONFIG_PATH') {
								return path.resolve('/tmp/config');
							}
							return undefined;
						},
					},
				},
			],
		}).compile();

		controller = moduleRef.get(ExtensionsController);
		reply = createReply();

		jest.clearAllMocks();

		mockedGetDiscovered.mockResolvedValue({
			admin: [discoveredAdmin],
			backend: [discoveredBackend],
		});

		fsExistsSpy.mockImplementation((p: fs.PathLike) => {
			const s = String(p);

			if (s === path.resolve('/tmp/config', 'extensions.manifest.json')) {
				return false;
			}

			if (s.endsWith('package.json') && (s.startsWith(PKG_DIR_ADMIN) || s.startsWith(PKG_DIR_BACK))) {
				return true;
			}

			if (s === path.join(PKG_DIR_ADMIN, 'admin/index.js')) {
				return true;
			}

			return false;
		});

		fsReadSpy.mockImplementation((p: fs.PathLike) => {
			const s = String(p);

			if (s.endsWith('package.json') && s.startsWith(PKG_DIR_ADMIN)) {
				return Buffer.from(JSON.stringify({ version: '1.2.3' }), 'utf8');
			}

			if (s.endsWith('package.json') && s.startsWith(PKG_DIR_BACK)) {
				return Buffer.from(JSON.stringify({ version: '9.9.9' }), 'utf8');
			}

			throw new Error(`Unexpected readFileSync: ${s}`);
		});

		fsStatSpy.mockImplementation((p: fs.PathLike) => {
			const s = String(p);
			return {
				isDirectory: () => s.endsWith('/dir'),
			} as unknown as fs.Stats;
		});

		fsStreamSpy.mockImplementation((_p: fs.PathLike) => {
			return {
				/* dummy stream */
			} as unknown as ReadStream;
		});

		mockedMimeLookup.mockReturnValue('application/javascript');
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	it('lists both admin and backend when surface=all (default)', async () => {
		const result = await controller.list();

		expect(result.data).toHaveLength(2);

		const admin = result.data.find((e) => e.surface === ExtensionSurfaceType.ADMIN);
		const back = result.data.find((e) => e.surface === ExtensionSurfaceType.BACKEND);

		expect(admin).toMatchObject({
			name: '@acme/admin-ext',
			kind: 'plugin',
			displayName: 'Acme Admin',
			source: ExtensionSourceType.RUNTIME, // no bundled manifest by default
			version: '1.2.3',
			remoteUrl: `:baseUrl/${SYSTEM_MODULE_PREFIX}/extensions/assets/%40acme%2Fadmin-ext/admin/index.js`,
		});

		expect(back).toMatchObject({
			name: '@acme/backend-ext',
			kind: 'module',
			displayName: 'Acme Backend',
			source: ExtensionSourceType.RUNTIME,
			version: '9.9.9',
			routePrefix: 'devices/acme',
		});
	});

	it('lists only admin when surface=admin', async () => {
		const result = await controller.list(ExtensionSurfaceType.ADMIN);

		expect(result.data).toHaveLength(1);
		expect(result.data[0]).toMatchObject({
			surface: ExtensionSurfaceType.ADMIN,
			name: '@acme/admin-ext',
		});
	});

	it('lists only backend when surface=backend', async () => {
		const result = await controller.list(ExtensionSurfaceType.BACKEND);

		expect(result.data).toHaveLength(1);
		expect(result.data[0]).toMatchObject({
			surface: ExtensionSurfaceType.BACKEND,
			name: '@acme/backend-ext',
		});
	});

	it('marks admin extension as bundled when present in manifest', async () => {
		fsExistsSpy.mockImplementation((p: fs.PathLike) => {
			const s = String(p);

			if (s === path.resolve('/tmp/config', 'extensions.manifest.json')) {
				return true;
			}

			if (s.endsWith('package.json') && s.startsWith(PKG_DIR_ADMIN)) {
				return true;
			}

			if (s === path.join(PKG_DIR_ADMIN, 'admin/index.js')) {
				return true;
			}

			return false;
		});

		fsReadSpy.mockImplementation((p: fs.PathLike) => {
			const s = String(p);

			if (s === path.resolve('/tmp/config', 'extensions.manifest.json')) {
				return Buffer.from(
					JSON.stringify({
						bundled: [{ name: '@acme/admin-ext' }],
					}),
					'utf8',
				);
			}

			if (s.endsWith('package.json') && s.startsWith(PKG_DIR_ADMIN)) {
				return Buffer.from(JSON.stringify({ version: '1.2.3' }), 'utf8');
			}

			throw new Error(`Unexpected readFileSync: ${s}`);
		});

		const result = await controller.list(ExtensionSurfaceType.ADMIN);

		expect(result.data).toHaveLength(1);
		expect(result.data[0]).toMatchObject({
			name: '@acme/admin-ext',
			source: ExtensionSourceType.BUNDLED,
		});
	});

	it('streams an asset when package and file exist', async () => {
		const req = {
			params: {
				pkg: '@acme/admin-ext',
				asset_path: 'admin/index.js',
				'*': 'admin/index.js',
			},
		} as any;

		const streamResult = await controller.asset('@acme/admin-ext', req, reply as any);

		expect(reply._headers['Content-Type']).toBe('application/javascript');
		expect(reply._headers['Cache-Control']).toBe('public, max-age=600');
		expect(streamResult).toBeDefined();
	});

	it('returns 404 when admin extension is not found', async () => {
		mockedGetDiscovered.mockResolvedValueOnce({
			admin: [],
			backend: [],
		});

		const req = { params: { pkg: '@acme/unknown', asset_path: 'admin/index.js', '*': 'admin/index.js' } } as any;

		await controller.asset('@acme/unknown', req, reply as any);

		expect(reply._status).toBe(404);
	});

	it('returns 400 when asset wildcard is missing', async () => {
		const req = { params: { pkg: '@acme/admin-ext' } } as any; // no '*'

		await controller.asset('@acme/admin-ext', req, reply as any);

		expect(reply._status).toBe(400);
	});

	it('returns 400 on path traversal attempt', async () => {
		const req = {
			params: { pkg: '@acme/admin-ext', asset_path: '../etc/passwd', '*': '../etc/passwd' },
		} as any;

		await controller.asset('@acme/admin-ext', req, reply as any);

		expect(reply._status).toBe(400);
	});

	it('returns 404 when file does not exist', async () => {
		fsExistsSpy.mockImplementation((p: fs.PathLike) => {
			const s = String(p);

			// extension found, but file not there
			if (s.endsWith('package.json') && s.startsWith(PKG_DIR_ADMIN)) {
				return true;
			}

			if (s === path.join(PKG_DIR_ADMIN, 'admin/index.js')) {
				return false;
			}

			return false;
		});

		const req = {
			params: { pkg: '@acme/admin-ext', asset_path: 'admin/index.js', '*': 'admin/index.js' },
		} as any;

		await controller.asset('@acme/admin-ext', req, reply as any);

		expect(reply._status).toBe(404);
	});

	it('returns 404 when path is a directory', async () => {
		fsStatSpy.mockImplementation(() => {
			return {
				isDirectory: () => true,
			} as unknown as fs.Stats;
		});

		const req = {
			params: { pkg: '@acme/admin-ext', asset_path: 'admin/index.js', '*': 'admin/index.js' },
		} as any;

		await controller.asset('@acme/admin-ext', req, reply as any);

		expect(reply._status).toBe(404);
	});

	it('sets correct Content-Type from mime-types', async () => {
		mockedMimeLookup.mockReturnValueOnce('text/javascript');

		const req = {
			params: { pkg: '@acme/admin-ext', asset_path: 'admin/index.js', '*': 'admin/index.js' },
		} as any;

		await controller.asset('@acme/admin-ext', req, reply as any);

		expect(reply._headers['Content-Type']).toBe('text/javascript');
	});
});
