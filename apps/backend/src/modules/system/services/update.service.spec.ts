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

import { ConfigService } from '../../config/services/config.service';
import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../notifications/notifications.constants';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { SYSTEM_MODULE_NAME, UpdateChannelType } from '../system.constants';

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
	let notifications: { notify: jest.Mock; resolve: jest.Mock; resolveAll: jest.Mock };
	let configService: { getModuleConfig: jest.Mock };

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
				{
					provide: NotificationsService,
					useValue: {
						notify: jest.fn(),
						resolve: jest.fn(),
						resolveAll: jest.fn(),
					},
				},
				{
					provide: ConfigService,
					useValue: {
						// Devices that have never touched the setting are on `auto`, which is what
						// every pre-existing test assumes.
						getModuleConfig: jest.fn(() => ({ updateChannel: UpdateChannelType.AUTO })),
					},
				},
			],
		}).compile();

		service = module.get<UpdateService>(UpdateService);
		notifications = module.get<NotificationsService>(NotificationsService) as unknown as typeof notifications;
		configService = module.get<ConfigService>(ConfigService) as unknown as typeof configService;

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

		it('should return null for a pre-release identifier it does not recognise', () => {
			expect(service.detectChannel('2.0.0-rc.1')).toBeNull();
			expect(service.detectChannel('2.0.0-nightly')).toBeNull();
		});

		it('should treat build metadata as stable', () => {
			// In semver the pre-release sits between '-' and '+', so a '-' inside build metadata
			// does not make the version a pre-release.
			expect(service.detectChannel('1.0.0+build-7')).toBe('latest');
			expect(service.detectChannel('v1.0.0+2026-07-31')).toBe('latest');
		});

		it('should ignore channel words appearing inside build metadata', () => {
			expect(service.detectChannel('1.0.1+build-alpha')).toBe('latest');
			expect(service.detectChannel('1.0.1+beta-meta')).toBe('latest');
		});

		it('should match the pre-release identifier rather than a substring of it', () => {
			// "alpharelease" is not the alpha channel; only the first dot-separated identifier
			// decides, so anything else is unknown.
			expect(service.detectChannel('1.0.0-alpharelease.1')).toBeNull();
			expect(service.detectChannel('1.0.0-prebeta')).toBeNull();
			expect(service.detectChannel('1.0.0-alpha')).toBe('alpha');
			expect(service.detectChannel('1.0.0-beta.7')).toBe('beta');
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

	describe('checkServerUpdate channel fall-forward', () => {
		const NPM_REGISTRY = 'https://registry.npmjs.org/@fastybird/smart-panel';
		const RELEASES_API = 'https://api.github.com/repos/FastyBird/smart-panel/releases?per_page=20';
		const STABLE_VERSION_JSON = 'https://github.com/FastyBird/smart-panel/releases/latest/download/version.json';

		let fetchSpy: jest.SpyInstance;

		const mockFetchRoutes = (routes: Record<string, unknown>): void => {
			fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
				const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

				if (!(url in routes)) {
					return Promise.resolve({ ok: false, status: 404 } as Response);
				}

				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve(routes[url]),
				} as Response);
			});
		};

		/** Install detection: no `.image-install` marker anywhere → npm install. */
		const mockNpmInstall = (currentVersion: string): void => {
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: currentVersion }));
			(readlinkSync as jest.Mock).mockImplementation(() => {
				throw new Error('Not a symlink');
			});
			(existsSync as jest.Mock).mockReturnValue(false);
		};

		/** Install detection: `.image-install` marker present → Raspbian image install. */
		const mockImageInstall = (currentVersion: string): void => {
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: currentVersion }));
			(readlinkSync as jest.Mock).mockReturnValue('v0.7.0-alpha');
			(existsSync as jest.Mock).mockImplementation(
				(path: string) => path === '/opt/smart-panel/v0.7.0-alpha/.image-install',
			);
		};

		const release = (tag: string, prerelease: boolean, assetUrl: string | null) => ({
			tag_name: tag,
			prerelease,
			assets: assetUrl ? [{ name: 'version.json', browser_download_url: assetUrl }] : [],
		});

		afterEach(() => {
			fetchSpy?.mockRestore();
		});

		it('should offer the beta release to an npm install stranded on a dead alpha channel', async () => {
			mockNpmInstall('0.7.0-alpha.1');
			mockFetchRoutes({
				[NPM_REGISTRY]: {
					'dist-tags': { latest: '0.5.0-alpha.2', alpha: '0.7.0-alpha.1', beta: '1.0.0-beta.2' },
				},
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('1.0.0-beta.2');
			expect(result.updateAvailable).toBe(true);
			expect(result.updateType).toBe('major');
		});

		it('should offer the beta release to an image install stranded on a dead alpha channel', async () => {
			mockImageInstall('0.7.0-alpha.1');
			mockFetchRoutes({
				[RELEASES_API]: [
					release('v1.0.0-beta.2', true, 'https://example.test/beta/version.json'),
					release('v0.7.0-alpha.1', true, 'https://example.test/alpha/version.json'),
				],
				'https://example.test/beta/version.json': { version: '1.0.0-beta.2', channel: 'beta' },
				'https://example.test/alpha/version.json': { version: '0.7.0-alpha.1', channel: 'alpha' },
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('1.0.0-beta.2');
			expect(result.updateAvailable).toBe(true);
			expect(result.updateType).toBe('major');
		});

		it('should offer the stable release to a beta install once the beta line ends', async () => {
			mockNpmInstall('1.0.0-beta.2');
			mockFetchRoutes({
				[NPM_REGISTRY]: {
					'dist-tags': { latest: '1.0.0', alpha: '0.7.0-alpha.1', beta: '1.0.0-beta.2' },
				},
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('1.0.0');
			expect(result.updateAvailable).toBe(true);
		});

		it('should never offer a less stable channel to a stable install', async () => {
			mockNpmInstall('1.0.0');
			mockFetchRoutes({
				[NPM_REGISTRY]: {
					'dist-tags': { latest: '1.0.0', alpha: '1.1.0-alpha.0', beta: '1.1.0-beta.0' },
				},
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('1.0.0');
			expect(result.updateAvailable).toBe(false);
		});

		it('should not offer a newer alpha to a beta install', async () => {
			mockNpmInstall('1.0.0-beta.2');
			mockFetchRoutes({
				[NPM_REGISTRY]: {
					'dist-tags': { latest: '0.5.0-alpha.2', alpha: '1.1.0-alpha.0', beta: '1.0.0-beta.2' },
				},
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('1.0.0-beta.2');
			expect(result.updateAvailable).toBe(false);
		});

		it('should reach the stable release for an image install even when it is absent from the releases page', async () => {
			mockImageInstall('1.0.0-beta.2');
			mockFetchRoutes({
				[STABLE_VERSION_JSON]: { version: '1.0.0', channel: 'latest' },
				[RELEASES_API]: [release('v1.0.0-beta.2', true, 'https://example.test/beta/version.json')],
				'https://example.test/beta/version.json': { version: '1.0.0-beta.2', channel: 'beta' },
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('1.0.0');
			expect(result.updateAvailable).toBe(true);
		});

		it('should not offer a pre-release that a dist-tag merely labels as stable', async () => {
			// dist-tags are mutable pointers, not proof of stability — this project's `latest`
			// tag has in fact pointed at an alpha. A beta install accepts the `latest` channel,
			// so without checking the version itself an alpha would be offered as an upgrade.
			mockNpmInstall('1.0.0-beta.2');
			mockFetchRoutes({
				[NPM_REGISTRY]: {
					'dist-tags': { latest: '1.1.0-alpha.0', beta: '1.0.0-beta.2', alpha: '1.1.0-alpha.0' },
				},
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('1.0.0-beta.2');
			expect(result.updateAvailable).toBe(false);
		});

		it('should not offer a pre-release that a release marks with a more stable channel', async () => {
			mockImageInstall('1.0.0-beta.2');
			mockFetchRoutes({
				[STABLE_VERSION_JSON]: { version: '1.1.0-alpha.0', channel: 'latest' },
				[RELEASES_API]: [release('v1.0.0-beta.2', true, 'https://example.test/beta/version.json')],
				'https://example.test/beta/version.json': { version: '1.0.0-beta.2', channel: 'beta' },
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('1.0.0-beta.2');
			expect(result.updateAvailable).toBe(false);
		});

		it('should abandon the releases scan once the overall time budget is spent', async () => {
			mockImageInstall('0.7.0-alpha.1');

			// Twenty releases that are all alphas, so beta and latest are never resolved and the
			// "every channel answered" short-circuit can never fire.
			const releases = Array.from({ length: 20 }, (_, i) =>
				release(`v9.9.${i}-alpha.0`, true, `https://example.test/r${i}/version.json`),
			);
			const routes: Record<string, unknown> = { [RELEASES_API]: releases };

			releases.forEach((_, i) => {
				routes[`https://example.test/r${i}/version.json`] = { version: `9.9.${i}-alpha.0`, channel: 'alpha' };
			});

			mockFetchRoutes(routes);

			// Virtual clock: every request costs 6s, so a 30s budget allows only a handful.
			let now = 1_000_000;
			const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
			const routed = fetchSpy.getMockImplementation() as (input: RequestInfo | URL) => Promise<Response>;

			fetchSpy.mockImplementation((input: RequestInfo | URL) => {
				now += 6_000;

				return routed(input);
			});

			await service.checkServerUpdate();

			// Without a budget this walks all 20 releases looking for beta and latest.
			expect(fetchSpy.mock.calls.length).toBeLessThan(10);

			nowSpy.mockRestore();
		});

		it('should bound the stable probe and the releases scan under one shared budget', async () => {
			// A fall-forward install does both: probe the stable URL, then scan the releases page.
			// Giving each its own budget means the caller can wait for their sum, so the deadline
			// has to start before the probe, not after it.
			mockImageInstall('0.7.0-alpha.1');

			const releases = Array.from({ length: 20 }, (_, i) =>
				release(`v9.9.${i}`, true, `https://example.test/r${i}/version.json`),
			);
			const routes: Record<string, unknown> = {
				[STABLE_VERSION_JSON]: { version: '0.1.0', channel: 'latest' },
				[RELEASES_API]: releases,
			};

			releases.forEach((_, i) => {
				routes[`https://example.test/r${i}/version.json`] = { version: `9.9.${i}`, channel: 'nightly' };
			});

			mockFetchRoutes(routes);

			const start = 1_000_000;
			let now = start;
			const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
			const routed = fetchSpy.getMockImplementation() as (input: RequestInfo | URL) => Promise<Response>;

			fetchSpy.mockImplementation((input: RequestInfo | URL) => {
				now += 6_000;

				return routed(input);
			});

			await service.checkServerUpdate();

			const budget = (UpdateService as unknown as { GITHUB_LOOKUP_TIMEOUT_MS: number }).GITHUB_LOOKUP_TIMEOUT_MS;

			expect(now - start).toBeLessThanOrEqual(budget);

			nowSpy.mockRestore();
		});

		it('should classify a release by its version, not by the channel its version.json claims', async () => {
			// The `channel` field is hand-written in the release workflow. If the newest release
			// mislabels an alpha as beta, keying the scan on that label marks beta as answered and
			// the genuinely newer beta below it is never examined.
			mockImageInstall('1.0.0-beta.2');
			mockFetchRoutes({
				[RELEASES_API]: [
					release('v1.1.0-alpha.0', true, 'https://example.test/mislabelled/version.json'),
					release('v1.0.0-beta.5', true, 'https://example.test/beta/version.json'),
				],
				'https://example.test/mislabelled/version.json': { version: '1.1.0-alpha.0', channel: 'beta' },
				'https://example.test/beta/version.json': { version: '1.0.0-beta.5', channel: 'beta' },
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('1.0.0-beta.5');
			expect(result.updateAvailable).toBe(true);
		});

		it('should not cache a stable-only fallback for the full TTL', async () => {
			// The releases API failed, so the beta/alpha channels were never consulted. Caching
			// that as a complete answer hides a newer pre-release from GET /status until the TTL
			// expires, even though the failure was transient.
			mockImageInstall('1.0.0-beta.2');
			mockFetchRoutes({
				[STABLE_VERSION_JSON]: { version: '0.9.0', channel: 'latest' },
			});

			let now = 1_000_000;
			const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);

			const first = await service.checkServerUpdate();

			expect(first.latest).toBe('0.9.0');
			expect(first.updateAvailable).toBe(false);

			const callsAfterFirst = fetchSpy.mock.calls.length;

			// Ten minutes later the partial answer must no longer be served from cache.
			now += 10 * 60 * 1000;

			await service.checkServerUpdate();

			expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst);

			nowSpy.mockRestore();
		});

		it('should cache a complete lookup for the full TTL', async () => {
			mockImageInstall('1.0.0-beta.2');
			mockFetchRoutes({
				[STABLE_VERSION_JSON]: { version: '0.9.0', channel: 'latest' },
				[RELEASES_API]: [release('v1.0.0-beta.5', true, 'https://example.test/beta/version.json')],
				'https://example.test/beta/version.json': { version: '1.0.0-beta.5', channel: 'beta' },
			});

			let now = 1_000_000;
			const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);

			await service.checkServerUpdate();

			const callsAfterFirst = fetchSpy.mock.calls.length;

			now += 10 * 60 * 1000;

			await service.checkServerUpdate();

			expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);

			nowSpy.mockRestore();
		});

		it('should keep scanning when the stable probe returns a pre-release', async () => {
			// The direct download URL is just another source of a version string. If what it
			// returns is not actually stable, the stable channel is still unanswered and the
			// releases API has to be consulted for it.
			mockImageInstall('1.0.0');
			mockFetchRoutes({
				[STABLE_VERSION_JSON]: { version: '1.1.0-alpha.0', channel: 'latest' },
				[RELEASES_API]: [release('v1.2.0', false, 'https://example.test/stable/version.json')],
				'https://example.test/stable/version.json': { version: '1.2.0', channel: 'latest' },
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('1.2.0');
			expect(result.updateAvailable).toBe(true);
		});

		it('should treat a scan whose last request exhausts the budget as partial', async () => {
			// The budget check runs at the top of each iteration, so a request that spends the
			// budget on the final release leaves the loop without it ever firing.
			mockImageInstall('1.0.0-beta.2');
			mockFetchRoutes({
				[STABLE_VERSION_JSON]: { version: '0.9.0', channel: 'latest' },
				[RELEASES_API]: [release('v1.0.0-beta.5', true, 'https://example.test/missing/version.json')],
				// version.json deliberately absent → the request 404s after consuming the budget
			});

			let now = 1_000_000;
			const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
			const routed = fetchSpy.getMockImplementation() as (input: RequestInfo | URL) => Promise<Response>;

			fetchSpy.mockImplementation((input: RequestInfo | URL) => {
				now += 12_000;

				return routed(input);
			});

			await service.checkServerUpdate();

			const callsAfterFirst = fetchSpy.mock.calls.length;

			// The beta channel was never actually answered, so this must not be cached for 12h.
			now += 10 * 60 * 1000;

			await service.checkServerUpdate();

			expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst);

			nowSpy.mockRestore();
		});

		it('should not treat an unrecognised pre-release identifier as stable', async () => {
			// detectChannel knows alpha and beta. Anything else carrying a pre-release component is
			// still a pre-release and must not be handed to a stable install just because its
			// identifier is unfamiliar.
			mockImageInstall('1.0.0');
			mockFetchRoutes({
				[RELEASES_API]: [release('v2.0.0-rc.1', true, 'https://example.test/rc/version.json')],
				'https://example.test/rc/version.json': { version: '2.0.0-rc.1', channel: 'latest' },
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBeNull();
			expect(result.updateAvailable).toBe(false);
		});

		it('should offer only stable releases to an install on an unrecognised pre-release', async () => {
			// We cannot place such an install on a pre-release line, so the conservative floor is
			// stable-only rather than assuming it belongs to the least stable channel.
			mockNpmInstall('2.0.0-rc.1');
			mockFetchRoutes({
				[NPM_REGISTRY]: {
					'dist-tags': { latest: '3.0.0', beta: '3.1.0-beta.0', alpha: '3.2.0-alpha.0' },
				},
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('3.0.0');
			expect(result.updateAvailable).toBe(true);
		});

		it('should take the highest version in a channel, not the first one listed', async () => {
			// Releases come back newest-created first, which is not the same as highest version: a
			// backport published after a major pre-release appears above it.
			mockImageInstall('1.0.0-beta.2');
			mockFetchRoutes({
				[RELEASES_API]: [
					release('v1.5.1-beta.0', true, 'https://example.test/backport/version.json'),
					release('v2.0.0-beta.0', true, 'https://example.test/major/version.json'),
				],
				'https://example.test/backport/version.json': { version: '1.5.1-beta.0', channel: 'beta' },
				'https://example.test/major/version.json': { version: '2.0.0-beta.0', channel: 'beta' },
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('2.0.0-beta.0');
			expect(result.updateAvailable).toBe(true);
		});

		it('should still report a result when the releases API fails but the stable probe succeeds', async () => {
			mockImageInstall('0.9.0-beta.1');
			mockFetchRoutes({
				[STABLE_VERSION_JSON]: { version: '1.0.0', channel: 'latest' },
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('1.0.0');
			expect(result.updateAvailable).toBe(true);
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
			(service as any).serverCacheExpiresAt.set('latest', Date.now() + 60_000);

			const result = await service.checkServerUpdate('latest');

			expect(result).toEqual(cached);
		});
	});

	describe('update availability notifications', () => {
		let fetchSpy: jest.SpyInstance;

		const mockNpmInstall = (currentVersion: string): void => {
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: currentVersion }));
			(readlinkSync as jest.Mock).mockImplementation(() => {
				throw new Error('Not a symlink');
			});
			(existsSync as jest.Mock).mockReturnValue(false);
		};

		afterEach(() => {
			fetchSpy?.mockRestore();
		});

		it('raises the update-available issue when a newer version is offered', async () => {
			mockNpmInstall('1.0.0');
			fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ 'dist-tags': { latest: '1.1.0' } }),
			} as Response);

			await service.checkServerUpdate('latest');

			expect(notifications.notify).toHaveBeenCalledWith({
				source: SYSTEM_MODULE_NAME,
				kind: NotificationKind.ISSUE,
				key: 'update-available',
				severity: NotificationSeverity.INFO,
				title: 'Update 1.1.0 is available',
				message: 'Installed 1.0.0. Channel: latest.',
				actions: [{ type: NotificationActionType.LINK, label: 'View update', url: '/system/info', primary: true }],
				data: { current_version: '1.0.0', latest_version: '1.1.0' },
			});
			expect(notifications.resolve).not.toHaveBeenCalled();
		});

		it('does not call notify or resolve on a fresh check when no update was ever offered', async () => {
			mockNpmInstall('1.1.0');
			fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ 'dist-tags': { latest: '1.1.0' } }),
			} as Response);

			await service.checkServerUpdate('latest');

			// There was never an announced "available" state to transition away from, so a bare
			// negative check - e.g. the very first check after boot - reports nothing.
			expect(notifications.notify).not.toHaveBeenCalled();
			expect(notifications.resolve).not.toHaveBeenCalled();
		});

		it('calls notify once for two fresh checks that report the same available version', async () => {
			mockNpmInstall('1.0.0');
			fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ 'dist-tags': { latest: '1.1.0' } }),
			} as Response);

			await service.checkServerUpdate('latest');
			service.invalidateServerCache();
			await service.checkServerUpdate('latest');

			expect(notifications.notify).toHaveBeenCalledTimes(1);
			expect(notifications.resolve).not.toHaveBeenCalled();
		});

		it('calls notify twice when a later fresh check offers a newer version', async () => {
			mockNpmInstall('1.0.0');
			fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ 'dist-tags': { latest: '1.1.0' } }),
			} as Response);

			await service.checkServerUpdate('latest');

			service.invalidateServerCache();
			fetchSpy.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ 'dist-tags': { latest: '1.2.0' } }),
			} as Response);

			await service.checkServerUpdate('latest');

			expect(notifications.notify).toHaveBeenCalledTimes(2);
			expect(notifications.notify).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({ title: 'Update 1.2.0 is available' }),
			);
		});

		it('resolves the update-available issue once when an offered update stops being available', async () => {
			mockNpmInstall('1.0.0');
			fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ 'dist-tags': { latest: '1.1.0' } }),
			} as Response);

			await service.checkServerUpdate('latest');

			service.invalidateServerCache();
			fetchSpy.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ 'dist-tags': { latest: '1.0.0' } }),
			} as Response);

			await service.checkServerUpdate('latest');

			expect(notifications.notify).toHaveBeenCalledTimes(1);
			expect(notifications.resolve).toHaveBeenCalledTimes(1);
			expect(notifications.resolve).toHaveBeenCalledWith(SYSTEM_MODULE_NAME, 'update-available');
		});
	});

	describe('checkServerUpdate generation guard', () => {
		let fetchSpy: jest.SpyInstance;

		const mockNpmInstall = (currentVersion: string): void => {
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: currentVersion }));
			(readlinkSync as jest.Mock).mockImplementation(() => {
				throw new Error('Not a symlink');
			});
			(existsSync as jest.Mock).mockReturnValue(false);
		};

		afterEach(() => {
			fetchSpy?.mockRestore();
		});

		it('discards a stale check that finishes after a newer one, touching neither the cache nor the notifications', async () => {
			mockNpmInstall('1.0.0');

			let resolveFirst: (value: Response) => void = () => undefined;
			let resolveSecond: (value: Response) => void = () => undefined;
			const firstFetch = new Promise<Response>((resolve) => {
				resolveFirst = resolve;
			});
			const secondFetch = new Promise<Response>((resolve) => {
				resolveSecond = resolve;
			});

			fetchSpy = jest
				.spyOn(global, 'fetch')
				.mockImplementationOnce(() => firstFetch)
				.mockImplementationOnce(() => secondFetch);

			// The older check starts first...
			const stale = service.checkServerUpdate('latest');
			// ...and a newer one starts before the older one's own fetch has resolved.
			const fresh = service.checkServerUpdate('latest');

			// The newer check's fetch settles first, reporting 2.0.0.
			resolveSecond({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ 'dist-tags': { latest: '2.0.0' } }),
			} as Response);

			const freshResult = await fresh;

			expect(freshResult.latest).toBe('2.0.0');
			expect(notifications.notify).toHaveBeenCalledTimes(1);
			expect(notifications.notify).toHaveBeenCalledWith(
				expect.objectContaining({ title: 'Update 2.0.0 is available' }),
			);

			// The older check's fetch settles last, reporting 1.5.0 - a version nobody is being
			// offered any more. It must not overwrite the cache or fire a second notification.
			resolveFirst({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ 'dist-tags': { latest: '1.5.0' } }),
			} as Response);

			const staleResult = await stale;

			expect(staleResult.latest).toBe('1.5.0');
			expect(notifications.notify).toHaveBeenCalledTimes(1);

			const cached = (service as any).cachedServerInfo.get('latest');
			expect(cached.latest).toBe('2.0.0');
		});
	});

	describe('configured update channel', () => {
		const NPM_REGISTRY = 'https://registry.npmjs.org/@fastybird/smart-panel';
		const RELEASES_API = 'https://api.github.com/repos/FastyBird/smart-panel/releases?per_page=20';
		const STABLE_VERSION_JSON = 'https://github.com/FastyBird/smart-panel/releases/latest/download/version.json';

		let fetchSpy: jest.SpyInstance;

		const requestedUrl = (input: RequestInfo | URL): string =>
			typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

		const mockFetchRoutes = (routes: Record<string, unknown>): void => {
			fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
				const url = requestedUrl(input);

				if (!(url in routes)) {
					return Promise.resolve({ ok: false, status: 404 } as Response);
				}

				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve(routes[url]),
				} as Response);
			});
		};

		const requestedUrls = (): string[] =>
			(fetchSpy.mock.calls as [RequestInfo | URL][]).map(([input]) => requestedUrl(input));

		const mockNpmInstall = (currentVersion: string): void => {
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: currentVersion }));
			(readlinkSync as jest.Mock).mockImplementation(() => {
				throw new Error('Not a symlink');
			});
			(existsSync as jest.Mock).mockReturnValue(false);
		};

		const mockImageInstall = (currentVersion: string): void => {
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ version: currentVersion }));
			(readlinkSync as jest.Mock).mockReturnValue('v1.0.0-beta.3');
			(existsSync as jest.Mock).mockImplementation(
				(path: string) => path === '/opt/smart-panel/v1.0.0-beta.3/.image-install',
			);
		};

		const release = (tag: string, prerelease: boolean, assetUrl: string | null) => ({
			tag_name: tag,
			prerelease,
			assets: assetUrl ? [{ name: 'version.json', browser_download_url: assetUrl }] : [],
		});

		const setChannel = (updateChannel: UpdateChannelType): void => {
			configService.getModuleConfig.mockReturnValue({ updateChannel });
		};

		afterEach(() => {
			fetchSpy?.mockRestore();
		});

		describe('resolveEffectiveChannel', () => {
			it('should fall back to the installed version when the channel is left on auto', () => {
				mockNpmInstall('1.0.0-beta.3');
				setChannel(UpdateChannelType.AUTO);

				expect(service.resolveEffectiveChannel()).toBe('beta');
			});

			it('should map the operator-facing "stable" onto the internal "latest"', () => {
				mockNpmInstall('1.0.0-beta.3');
				setChannel(UpdateChannelType.STABLE);

				expect(service.resolveEffectiveChannel()).toBe('latest');
			});

			it('should prefer the configured channel over the installed version', () => {
				mockNpmInstall('1.0.0-beta.3');
				setChannel(UpdateChannelType.ALPHA);

				expect(service.resolveEffectiveChannel()).toBe('alpha');
			});

			it('should prefer an explicit argument over the configured channel', () => {
				mockNpmInstall('1.0.0-beta.3');
				setChannel(UpdateChannelType.ALPHA);

				expect(service.resolveEffectiveChannel('latest')).toBe('latest');
			});

			it('should fall back to auto when the config cannot be read', () => {
				mockNpmInstall('1.0.0-beta.3');
				configService.getModuleConfig.mockImplementation(() => {
					throw new Error('config.yaml is unreadable');
				});

				expect(service.resolveEffectiveChannel()).toBe('beta');
			});

			it('should treat an install on an unrecognised pre-release line as stable-only', () => {
				mockNpmInstall('2.0.0-rc.1');
				setChannel(UpdateChannelType.AUTO);

				expect(service.resolveEffectiveChannel()).toBe('latest');
			});
		});

		it('should offer a newer alpha to a beta install once the operator opts into alpha', async () => {
			mockNpmInstall('1.0.0-beta.3');
			setChannel(UpdateChannelType.ALPHA);
			mockFetchRoutes({
				[NPM_REGISTRY]: {
					'dist-tags': { latest: '0.5.0-alpha.2', alpha: '1.1.0-alpha.0', beta: '1.0.0-beta.3' },
				},
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('1.1.0-alpha.0');
			expect(result.updateAvailable).toBe(true);
			expect(result.updateType).toBe('minor');
		});

		it('should keep hiding that alpha from the same install while the channel is on auto', async () => {
			mockNpmInstall('1.0.0-beta.3');
			setChannel(UpdateChannelType.AUTO);
			mockFetchRoutes({
				[NPM_REGISTRY]: {
					'dist-tags': { latest: '0.5.0-alpha.2', alpha: '1.1.0-alpha.0', beta: '1.0.0-beta.3' },
				},
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('1.0.0-beta.3');
			expect(result.updateAvailable).toBe(false);
		});

		it('should never offer a pre-release to an install pinned to stable', async () => {
			mockNpmInstall('1.0.0-beta.3');
			setChannel(UpdateChannelType.STABLE);
			mockFetchRoutes({
				[NPM_REGISTRY]: {
					'dist-tags': { latest: '0.5.0-alpha.2', alpha: '1.1.0-alpha.0', beta: '1.0.0-beta.3' },
				},
			});

			const result = await service.checkServerUpdate();

			// The `latest` dist-tag points at an alpha, so classifying by the version string leaves
			// the stable channel with no candidate at all rather than trusting the tag.
			expect(result.latest).toBeNull();
			expect(result.updateAvailable).toBe(false);
		});

		it('should offer the alpha to an image install once the operator opts into alpha', async () => {
			mockImageInstall('1.0.0-beta.3');
			setChannel(UpdateChannelType.ALPHA);
			mockFetchRoutes({
				[RELEASES_API]: [
					release('v1.1.0-alpha.0', true, 'https://example.test/alpha/version.json'),
					release('v1.0.0-beta.3', true, 'https://example.test/beta/version.json'),
				],
				'https://example.test/alpha/version.json': { version: '1.1.0-alpha.0', channel: 'alpha' },
				'https://example.test/beta/version.json': { version: '1.0.0-beta.3', channel: 'beta' },
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('1.1.0-alpha.0');
			expect(result.updateAvailable).toBe(true);
		});

		it('should drop the cached answer when the system config changes', async () => {
			mockImageInstall('1.0.0-beta.3');
			setChannel(UpdateChannelType.AUTO);
			mockFetchRoutes({
				[RELEASES_API]: [
					release('v1.1.0-alpha.0', true, 'https://example.test/alpha/version.json'),
					release('v1.0.0-beta.3', true, 'https://example.test/beta/version.json'),
				],
				'https://example.test/alpha/version.json': { version: '1.1.0-alpha.0', channel: 'alpha' },
				'https://example.test/beta/version.json': { version: '1.0.0-beta.3', channel: 'beta' },
			});

			await expect(service.checkServerUpdate()).resolves.toMatchObject({ updateAvailable: false });

			setChannel(UpdateChannelType.ALPHA);
			service.onConfigUpdated({ source: SYSTEM_MODULE_NAME, type: 'module' });

			await expect(service.checkServerUpdate()).resolves.toMatchObject({
				latest: '1.1.0-alpha.0',
				updateAvailable: true,
			});
		});

		it('should ignore a config change from another module', async () => {
			mockImageInstall('1.0.0-beta.3');
			setChannel(UpdateChannelType.AUTO);
			mockFetchRoutes({
				[RELEASES_API]: [release('v1.0.0-beta.3', true, 'https://example.test/beta/version.json')],
				'https://example.test/beta/version.json': { version: '1.0.0-beta.3', channel: 'beta' },
			});

			await service.checkServerUpdate();

			const callsAfterFirstCheck = fetchSpy.mock.calls.length;

			service.onConfigUpdated({ source: 'devices-module', type: 'module' });

			await service.checkServerUpdate();

			expect(fetchSpy).toHaveBeenCalledTimes(callsAfterFirstCheck);
		});

		it('should not download version.json for releases whose tag is outside the wanted channels', async () => {
			mockImageInstall('1.0.0-beta.3');
			setChannel(UpdateChannelType.BETA);
			mockFetchRoutes({
				[RELEASES_API]: [
					release('v1.1.0-alpha.0', true, 'https://example.test/alpha/version.json'),
					release('v1.0.0-beta.3', true, 'https://example.test/beta/version.json'),
					release('v0.7.0-alpha.1', true, 'https://example.test/old-alpha/version.json'),
				],
				'https://example.test/alpha/version.json': { version: '1.1.0-alpha.0', channel: 'alpha' },
				'https://example.test/beta/version.json': { version: '1.0.0-beta.3', channel: 'beta' },
				'https://example.test/old-alpha/version.json': { version: '0.7.0-alpha.1', channel: 'alpha' },
			});

			await service.checkServerUpdate();

			const requested = requestedUrls();

			expect(requested).toContain('https://example.test/beta/version.json');
			expect(requested).not.toContain('https://example.test/alpha/version.json');
			expect(requested).not.toContain('https://example.test/old-alpha/version.json');
		});

		it('should skip the stable probe when the releases listing already answered the stable channel', async () => {
			mockImageInstall('1.0.0');
			setChannel(UpdateChannelType.STABLE);
			mockFetchRoutes({
				[RELEASES_API]: [release('v1.2.0', false, 'https://example.test/stable/version.json')],
				'https://example.test/stable/version.json': { version: '1.2.0', channel: 'latest' },
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('1.2.0');
			expect(requestedUrls()).not.toContain(STABLE_VERSION_JSON);
		});

		it('should still probe for a stable release the listing could not reach', async () => {
			mockImageInstall('1.0.0');
			setChannel(UpdateChannelType.STABLE);
			mockFetchRoutes({
				[RELEASES_API]: [release('v1.1.0-alpha.0', true, 'https://example.test/alpha/version.json')],
				'https://example.test/alpha/version.json': { version: '1.1.0-alpha.0', channel: 'alpha' },
				[STABLE_VERSION_JSON]: { version: '1.3.0', channel: 'latest' },
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('1.3.0');
			expect(result.updateAvailable).toBe(true);
		});

		it('should still answer from the probe when the releases API is unavailable', async () => {
			mockImageInstall('1.0.0');
			setChannel(UpdateChannelType.STABLE);
			mockFetchRoutes({
				[STABLE_VERSION_JSON]: { version: '1.3.0', channel: 'latest' },
			});

			const result = await service.checkServerUpdate();

			expect(result.latest).toBe('1.3.0');
			expect(result.updateAvailable).toBe(true);
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
