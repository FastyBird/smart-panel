/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { existsSync, readFileSync, readdirSync, readlinkSync } from 'fs';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { UpdateService } from './update.service';

jest.mock('fs', () => ({
	...jest.requireActual<typeof import('fs')>('fs'),
	existsSync: jest.fn(),
	readFileSync: jest.fn(),
	readlinkSync: jest.fn(),
	readdirSync: jest.fn(),
}));

describe('UpdateService', () => {
	let service: UpdateService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				UpdateService,
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		service = module.get<UpdateService>(UpdateService);

		jest.clearAllMocks();
	});

	describe('getInstallType', () => {
		it('should return "image" when .image-install marker exists via relative symlink', () => {
			(readlinkSync as jest.Mock).mockReturnValue('v1.0.0');
			(existsSync as jest.Mock).mockImplementation((path: string) => {
				if (path === '/opt/smart-panel/v1.0.0/.image-install') {
					return true;
				}

				return false;
			});

			expect(service.getInstallType()).toBe('image');
		});

		it('should return "image" when .image-install marker exists via absolute symlink target', () => {
			(readlinkSync as jest.Mock).mockReturnValue('/opt/smart-panel/v1.0.0');
			(existsSync as jest.Mock).mockImplementation((path: string) => {
				if (path === '/opt/smart-panel/v1.0.0/.image-install') {
					return true;
				}

				return false;
			});

			expect(service.getInstallType()).toBe('image');
		});

		it('should return "image" via fallback when readlinkSync fails', () => {
			(readlinkSync as jest.Mock).mockImplementation(() => {
				throw new Error('Not a symlink');
			});
			(existsSync as jest.Mock).mockImplementation((path: string) => {
				if (path === '/opt/smart-panel/current/.image-install') {
					return true;
				}

				return false;
			});

			expect(service.getInstallType()).toBe('image');
		});

		it('should return "npm" when no .image-install marker exists', () => {
			(readlinkSync as jest.Mock).mockImplementation(() => {
				throw new Error('Not a symlink');
			});
			(existsSync as jest.Mock).mockReturnValue(false);

			expect(service.getInstallType()).toBe('npm');
		});

		it('should return "npm" when symlink exists but no marker file', () => {
			(readlinkSync as jest.Mock).mockReturnValue('v1.0.0');
			(existsSync as jest.Mock).mockReturnValue(false);

			expect(service.getInstallType()).toBe('npm');
		});
	});

	describe('getInstalledVersions', () => {
		it('should return sorted list of installed versions', () => {
			(readdirSync as jest.Mock).mockReturnValue(['v1.2.0', 'v1.0.0', 'v1.1.0', 'current', 'rebuild-native.sh']);

			const versions = service.getInstalledVersions();

			expect(versions).toEqual(['1.0.0', '1.1.0', '1.2.0']);
		});

		it('should return empty array when directory does not exist', () => {
			(readdirSync as jest.Mock).mockImplementation(() => {
				throw new Error('ENOENT');
			});

			expect(service.getInstalledVersions()).toEqual([]);
		});

		it('should filter out non-version entries including v-prefixed non-semver dirs', () => {
			(readdirSync as jest.Mock).mockReturnValue([
				'current',
				'rebuild-native.sh',
				'first-boot.sh',
				'vars',
				'vendor',
				'v1.0.0',
			]);

			const versions = service.getInstalledVersions();

			expect(versions).toEqual(['1.0.0']);
		});
	});

	describe('getCurrentVersion', () => {
		it('should read version from package.json', () => {
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.5.3' }));

			expect(service.getCurrentVersion()).toBe('1.5.3');
		});

		it('should return 0.0.0 when package.json is unreadable', () => {
			(readFileSync as jest.Mock).mockImplementation(() => {
				throw new Error('ENOENT');
			});

			expect(service.getCurrentVersion()).toBe('0.0.0');
		});
	});
});
