/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import fs from 'node:fs';

import { Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config/dist/config.service';
import { Test, TestingModule } from '@nestjs/testing';

import { ExtensionsBundledService } from './extensions-bundled.service';

jest.mock('node:fs');

describe('ExtensionsBundledService', () => {
	let service: ExtensionsBundledService;

	const mockManifest = {
		bundled: [
			{ name: 'auth-module', kind: 'module', version: '1.0.0' },
			{ name: 'devices-module', kind: 'module', version: '1.0.0' },
			{ name: 'pages-tiles-plugin', kind: 'plugin', version: '1.0.0' },
		],
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ExtensionsBundledService,
				{
					provide: NestConfigService,
					useValue: {
						get: jest.fn().mockReturnValue('/var/data'),
					},
				},
			],
		}).compile();

		service = module.get<ExtensionsBundledService>(ExtensionsBundledService);
	});

	afterEach(() => {
		jest.clearAllMocks();
		service.clearCache();
	});

	describe('isCore', () => {
		it('should return true for bundled extensions', () => {
			(fs.existsSync as jest.Mock).mockReturnValue(true);
			(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockManifest));

			expect(service.isCore('auth-module')).toBe(true);
			expect(service.isCore('devices-module')).toBe(true);
			expect(service.isCore('pages-tiles-plugin')).toBe(true);
		});

		it('should return false for non-bundled extensions', () => {
			(fs.existsSync as jest.Mock).mockReturnValue(true);
			(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockManifest));

			expect(service.isCore('external-plugin')).toBe(false);
			expect(service.isCore('custom-module')).toBe(false);
		});

		it('should return true when manifest does not exist (all extensions assumed core)', () => {
			(fs.existsSync as jest.Mock).mockReturnValue(false);

			// When no manifest exists, all registered extensions are assumed core
			// since third-party dynamic loading isn't implemented yet
			expect(service.isCore('auth-module')).toBe(true);
		});
	});

	describe('getBundledExtensionNames', () => {
		it('should return all bundled extension names', () => {
			(fs.existsSync as jest.Mock).mockReturnValue(true);
			(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockManifest));

			const names = service.getBundledExtensionNames();

			expect(names).toContain('auth-module');
			expect(names).toContain('devices-module');
			expect(names).toContain('pages-tiles-plugin');
			expect(names).toHaveLength(3);
		});

		it('should return empty array when manifest does not exist', () => {
			(fs.existsSync as jest.Mock).mockReturnValue(false);

			const names = service.getBundledExtensionNames();

			expect(names).toEqual([]);
		});
	});

	describe('getBundledModuleNames', () => {
		it('should return only bundled module names', () => {
			(fs.existsSync as jest.Mock).mockReturnValue(true);
			(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockManifest));

			const names = service.getBundledModuleNames();

			expect(names).toContain('auth-module');
			expect(names).toContain('devices-module');
			expect(names).not.toContain('pages-tiles-plugin');
			expect(names).toHaveLength(2);
		});
	});

	describe('getBundledPluginNames', () => {
		it('should return only bundled plugin names', () => {
			(fs.existsSync as jest.Mock).mockReturnValue(true);
			(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockManifest));

			const names = service.getBundledPluginNames();

			expect(names).toContain('pages-tiles-plugin');
			expect(names).not.toContain('auth-module');
			expect(names).toHaveLength(1);
		});
	});

	describe('getBundledExtensions', () => {
		it('should return detailed bundled extension information', () => {
			(fs.existsSync as jest.Mock).mockReturnValue(true);
			(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockManifest));

			const extensions = service.getBundledExtensions();

			expect(extensions).toHaveLength(3);
			expect(extensions[0]).toEqual({ name: 'auth-module', kind: 'module', version: '1.0.0' });
		});

		it('should return empty array when manifest does not exist', () => {
			(fs.existsSync as jest.Mock).mockReturnValue(false);

			const extensions = service.getBundledExtensions();

			expect(extensions).toEqual([]);
		});
	});

	describe('caching', () => {
		it('should cache manifest after first load', () => {
			(fs.existsSync as jest.Mock).mockReturnValue(true);
			(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockManifest));

			// First call
			service.isCore('auth-module');
			// Second call
			service.isCore('devices-module');

			// readFileSync should only be called once due to caching
			expect(fs.readFileSync).toHaveBeenCalledTimes(1);
		});

		it('should reload manifest after clearCache', () => {
			(fs.existsSync as jest.Mock).mockReturnValue(true);
			(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockManifest));

			// First call
			service.isCore('auth-module');
			// Clear cache
			service.clearCache();
			// Second call
			service.isCore('devices-module');

			// readFileSync should be called twice after clearing cache
			expect(fs.readFileSync).toHaveBeenCalledTimes(2);
		});
	});

	describe('error handling', () => {
		it('should handle JSON parse errors gracefully and assume all core', () => {
			(fs.existsSync as jest.Mock).mockReturnValue(true);
			(fs.readFileSync as jest.Mock).mockReturnValue('invalid json');

			// When manifest fails to parse, returns null which results in empty bundledSet
			// Empty bundledSet means all extensions are assumed core
			expect(service.isCore('auth-module')).toBe(true);
			expect(Logger.prototype.warn).toHaveBeenCalled();
		});

		it('should handle file read errors gracefully and assume all core', () => {
			(fs.existsSync as jest.Mock).mockReturnValue(true);
			(fs.readFileSync as jest.Mock).mockImplementation(() => {
				throw new Error('File read error');
			});

			// When manifest fails to load, returns null which results in empty bundledSet
			// Empty bundledSet means all extensions are assumed core
			expect(service.isCore('auth-module')).toBe(true);
			expect(Logger.prototype.warn).toHaveBeenCalled();
		});
	});
});
