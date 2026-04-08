/*
eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment,
@typescript-eslint/no-unsafe-call
*/
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

	describe('detectChannel', () => {
		it('should return alpha for alpha pre-release versions', () => {
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '0.3.0-alpha.1' }));

			expect(service.detectChannel()).toBe('alpha');
		});

		it('should return beta for beta pre-release versions', () => {
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0-beta.3' }));

			expect(service.detectChannel()).toBe('beta');
		});

		it('should return latest for stable versions', () => {
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: '1.0.0' }));

			expect(service.detectChannel()).toBe('latest');
		});

		it('should accept explicit version parameter', () => {
			expect(service.detectChannel('2.0.0-alpha.5')).toBe('alpha');
			expect(service.detectChannel('2.0.0-beta.1')).toBe('beta');
			expect(service.detectChannel('2.0.0')).toBe('latest');
		});
	});

	describe('update lock', () => {
		it('should acquire and release lock', () => {
			expect(service.isUpdateInProgress()).toBe(false);
			expect(service.acquireUpdateLock()).toBe(true);
			expect(service.isUpdateInProgress()).toBe(true);

			service.releaseUpdateLock();

			expect(service.isUpdateInProgress()).toBe(false);
		});

		it('should reject second lock acquisition', () => {
			expect(service.acquireUpdateLock()).toBe(true);
			expect(service.acquireUpdateLock()).toBe(false);

			service.releaseUpdateLock();
		});

		it('should auto-release lock after timeout', () => {
			expect(service.acquireUpdateLock()).toBe(true);

			// Simulate timeout by directly setting the lock timestamp far in the past
			(service as any).updateLockAcquiredAt = Date.now() - 16 * 60 * 1000;

			expect(service.isUpdateInProgress()).toBe(false);
		});
	});

	describe('checkServerUpdate cache', () => {
		it('should return cached result within TTL', async () => {
			// Pre-populate cache
			const cached = {
				current: '1.0.0',
				latest: '1.1.0',
				updateAvailable: true,
				updateType: 'minor' as const,
			};

			(service as any).cachedServerInfo.set('latest', cached);
			(service as any).serverCacheTimestamp.set('latest', Date.now());

			const result = await service.checkServerUpdate('latest');

			expect(result).toEqual(cached);
		});
	});

	describe('setStatus', () => {
		it('should merge partial status and emit event', () => {
			const emitter = (service as any).eventEmitter as { emit: jest.Mock };

			service.setStatus({ status: 'downloading' as any, progressPercent: 20 });

			expect(emitter.emit).toHaveBeenCalled();
		});
	});
});
