import { existsSync, readFileSync, readdirSync, readlinkSync } from 'fs';
import { join } from 'path';

import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { compareSemver, getUpdateType } from '../../../common/utils/semver';
import { EventType, SYSTEM_MODULE_NAME, UpdatePhase, UpdateStatusType } from '../system.constants';

export type InstallType = 'image' | 'npm';

export interface VersionInfo {
	current: string;
	latest: string | null;
	updateAvailable: boolean;
	updateType: 'patch' | 'minor' | 'major' | null;
}

export interface ReleaseAsset {
	name: string;
	downloadUrl: string;
	size: number;
}

export interface PanelVersionInfo {
	latest: string | null;
	assets: ReleaseAsset[];
}

export interface UpdateStatusInfo {
	status: UpdateStatusType;
	phase: UpdatePhase | null;
	progressPercent: number | null;
	message: string | null;
	error: string | null;
	startedAt: Date | null;
}

export interface ReleaseNotes {
	version: string;
	body: string | null;
	url: string;
	publishedAt: string | null;
}

@Injectable()
export class UpdateService {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'UpdateService');

	private readonly NPM_REGISTRY_URL = 'https://registry.npmjs.org/@fastybird/smart-panel';
	private readonly GITHUB_API_URL = 'https://api.github.com/repos/FastyBird/smart-panel/releases';
	private readonly GITHUB_VERSION_JSON_URL = 'https://github.com/FastyBird/smart-panel/releases/latest/download/version.json';
	private readonly GITHUB_PRERELEASE_API_URL = 'https://api.github.com/repos/FastyBird/smart-panel/releases';

	private cachedServerInfo: Map<string, VersionInfo> = new Map();
	private cachedPanelInfo: Map<string, PanelVersionInfo> = new Map();
	private serverCacheTimestamp: Map<string, number> = new Map();
	private panelCacheTimestamp: Map<string, number> = new Map();
	private cachedReleaseNotes: Map<string, ReleaseNotes> = new Map();
	private readonly CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

	private updateStatus: UpdateStatusInfo = {
		status: UpdateStatusType.IDLE,
		phase: null,
		progressPercent: null,
		message: null,
		error: null,
		startedAt: null,
	};

	private updateLockAcquiredAt: number | null = null;
	private readonly UPDATE_LOCK_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
	private static readonly FETCH_TIMEOUT_MS = 15_000; // 15 seconds

	private static readonly IMAGE_BASE_DIR = '/opt/smart-panel';
	private static readonly IMAGE_CURRENT_LINK = '/opt/smart-panel/current';
	private static readonly IMAGE_MARKER_FILE = '.image-install';

	constructor(private readonly eventEmitter: EventEmitter2) {}

	getCurrentVersion(): string {
		try {
			const pkgJson = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', 'package.json'), 'utf8')) as {
				version: string;
			};

			return pkgJson.version;
		} catch {
			return '0.0.0';
		}
	}

	/**
	 * Detect whether the app was installed via the Raspbian image or via npm.
	 * Image installs have a `.image-install` marker file in the active version directory.
	 */
	getInstallType(): InstallType {
		try {
			const currentTarget = readlinkSync(UpdateService.IMAGE_CURRENT_LINK);

			// readlinkSync may return a relative path (e.g. "v1.0.0") or an absolute
			// path (e.g. "/opt/smart-panel/v1.0.0"). Use path.resolve to handle both.
			const resolvedDir = currentTarget.startsWith('/')
				? currentTarget
				: join(UpdateService.IMAGE_BASE_DIR, currentTarget);

			const markerPath = join(resolvedDir, UpdateService.IMAGE_MARKER_FILE);

			if (existsSync(markerPath)) {
				return 'image';
			}
		} catch {
			// readlinkSync fails if the path is not a symlink or doesn't exist
		}

		// Fallback: check via the symlink directly (Node follows symlinks in existsSync)
		try {
			const markerPath = join(UpdateService.IMAGE_CURRENT_LINK, UpdateService.IMAGE_MARKER_FILE);

			if (existsSync(markerPath)) {
				return 'image';
			}
		} catch {
			// Ignore
		}

		return 'npm';
	}

	/**
	 * List installed versions in /opt/smart-panel/v*
	 * Only includes directories matching semver pattern (e.g. v1.0.0, v1.2.3-beta.1)
	 */
	getInstalledVersions(): string[] {
		try {
			return readdirSync(UpdateService.IMAGE_BASE_DIR)
				.filter((entry) => /^v\d+\.\d+\.\d+/.test(entry))
				.map((entry) => entry.replace(/^v/, ''))
				.sort((a, b) => compareSemver(a, b));
		} catch {
			return [];
		}
	}

	getImageBaseDir(): string {
		return UpdateService.IMAGE_BASE_DIR;
	}

	getStatus(): UpdateStatusInfo {
		return { ...this.updateStatus };
	}

	isUpdateInProgress(): boolean {
		if (this.updateLockAcquiredAt === null) {
			return false;
		}

		if (Date.now() - this.updateLockAcquiredAt > this.UPDATE_LOCK_TIMEOUT_MS) {
			this.logger.warn('Update lock expired after timeout, releasing');
			this.releaseUpdateLock();

			return false;
		}

		return true;
	}

	acquireUpdateLock(): boolean {
		if (this.isUpdateInProgress()) {
			return false;
		}

		this.updateLockAcquiredAt = Date.now();

		return true;
	}

	releaseUpdateLock(): void {
		this.updateLockAcquiredAt = null;
	}

	setStatus(partial: Partial<UpdateStatusInfo>): void {
		this.updateStatus = { ...this.updateStatus, ...partial };

		this.eventEmitter.emit(EventType.SYSTEM_UPDATE_STATUS, {
			status: this.updateStatus.status,
			phase: this.updateStatus.phase,
			progress_percent: this.updateStatus.progressPercent,
			message: this.updateStatus.message,
			error: this.updateStatus.error,
		});
	}

	async checkServerUpdate(channel: 'latest' | 'beta' | 'alpha' = 'latest'): Promise<VersionInfo> {
		const cached = this.cachedServerInfo.get(channel);
		const cacheTime = this.serverCacheTimestamp.get(channel) ?? 0;

		if (cached && Date.now() - cacheTime < this.CACHE_TTL_MS) {
			return cached;
		}

		const currentVersion = this.getCurrentVersion();
		const installType = this.getInstallType();

		try {
			let latestVersion: string | null = null;

			if (installType === 'image') {
				// Image installs: check GitHub version.json or releases API
				latestVersion = await this.fetchLatestVersionFromGitHub(channel);
			} else {
				// npm installs: check npm registry dist-tags
				latestVersion = await this.fetchLatestVersionFromNpm(channel);
			}

			let updateAvailable = false;
			let updateType: 'patch' | 'minor' | 'major' | null = null;

			if (latestVersion) {
				const comparison = compareSemver(currentVersion, latestVersion);

				if (comparison < 0) {
					updateAvailable = true;
					updateType = getUpdateType(currentVersion, latestVersion);
				}
			}

			const result: VersionInfo = {
				current: currentVersion,
				latest: latestVersion,
				updateAvailable,
				updateType,
			};

			this.cachedServerInfo.set(channel, result);
			this.serverCacheTimestamp.set(channel, Date.now());

			return result;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to check for server updates: ${err.message}`);

			return {
				current: currentVersion,
				latest: null,
				updateAvailable: false,
				updateType: null,
			};
		}
	}

	/**
	 * Fetch latest version from GitHub version.json (for image installs).
	 * For the 'latest' channel, uses the direct download URL which avoids API rate limits.
	 * For pre-release channels (alpha/beta), queries the releases API to find matching releases.
	 */
	private async fetchLatestVersionFromGitHub(channel: 'latest' | 'beta' | 'alpha'): Promise<string | null> {
		if (channel === 'latest') {
			// Direct download — no API rate limit, follows redirect to the asset
			const response = await fetch(this.GITHUB_VERSION_JSON_URL, {
				headers: { 'User-Agent': 'FastyBird-SmartPanel' },
				signal: AbortSignal.timeout(UpdateService.FETCH_TIMEOUT_MS),
			});

			if (!response.ok) {
				throw new Error(`GitHub version.json returned ${response.status}`);
			}

			const data = (await response.json()) as { version?: string; channel?: string };

			return data.version?.replace(/^v/, '') ?? null;
		}

		// Pre-release channels: query the releases API and find the version.json asset
		const response = await fetch(`${this.GITHUB_PRERELEASE_API_URL}?per_page=20`, {
			headers: {
				Accept: 'application/vnd.github.v3+json',
				'User-Agent': 'FastyBird-SmartPanel',
			},
			signal: AbortSignal.timeout(UpdateService.FETCH_TIMEOUT_MS),
		});

		if (!response.ok) {
			throw new Error(`GitHub API returned ${response.status}`);
		}

		const releases = (await response.json()) as Array<{
			prerelease: boolean;
			tag_name: string;
			assets: Array<{ name: string; browser_download_url: string }>;
		}>;

		// Find the first pre-release with a version.json that matches the channel
		for (const release of releases) {
			if (!release.prerelease) continue;

			const versionAsset = release.assets.find((a) => a.name === 'version.json');

			if (!versionAsset) continue;

			try {
				const assetResponse = await fetch(versionAsset.browser_download_url, {
					headers: { 'User-Agent': 'FastyBird-SmartPanel' },
					signal: AbortSignal.timeout(UpdateService.FETCH_TIMEOUT_MS),
				});

				if (!assetResponse.ok) continue;

				const versionData = (await assetResponse.json()) as { version?: string; channel?: string };

				if (versionData.channel === channel) {
					return versionData.version?.replace(/^v/, '') ?? null;
				}
			} catch {
				continue;
			}
		}

		return null;
	}

	/**
	 * Fetch latest version from npm registry (for npm installs).
	 */
	private async fetchLatestVersionFromNpm(channel: 'latest' | 'beta' | 'alpha'): Promise<string | null> {
		const response = await fetch(this.NPM_REGISTRY_URL, {
			signal: AbortSignal.timeout(UpdateService.FETCH_TIMEOUT_MS),
		});

		if (!response.ok) {
			throw new Error(`npm registry returned ${response.status}`);
		}

		const data = (await response.json()) as { 'dist-tags'?: Record<string, string> };

		return data['dist-tags']?.[channel] ?? null;
	}

	async fetchReleaseNotes(version: string): Promise<ReleaseNotes> {
		const cleanVersion = version.replace(/^v/, '');
		const cached = this.cachedReleaseNotes.get(cleanVersion);

		if (cached) {
			return cached;
		}

		const fallback: ReleaseNotes = {
			version: cleanVersion,
			body: null,
			url: `https://github.com/FastyBird/smart-panel/releases/tag/v${cleanVersion}`,
			publishedAt: null,
		};

		const release = await this.fetchGitHubRelease(cleanVersion);

		if (!release) {
			return fallback;
		}

		const result: ReleaseNotes = {
			version: cleanVersion,
			body: (release as { body?: string | null }).body ?? null,
			url: (release as { html_url?: string }).html_url ?? fallback.url,
			publishedAt: (release as { published_at?: string | null }).published_at ?? null,
		};

		this.cachedReleaseNotes.set(cleanVersion, result);

		return result;
	}

	/**
	 * For image installs, fetch the backend tarball download URL from a GitHub release.
	 */
	async fetchServerReleaseAsset(version: string): Promise<ReleaseAsset | null> {
		const cleanVersion = version.replace(/^v/, '');

		const release = await this.fetchGitHubRelease(cleanVersion);

		if (!release) {
			return null;
		}

		const assets = (release as { assets?: Array<{ name: string; browser_download_url: string; size: number }> }).assets;

		if (!assets) {
			this.logger.warn(`No assets found in release v${cleanVersion}`);

			return null;
		}

		// Look for the backend tarball (e.g., smart-panel-v1.2.0-backend.tar.gz)
		const backendAsset = assets.find((a) => a.name.includes('backend') && a.name.endsWith('.tar.gz'));

		if (!backendAsset) {
			this.logger.warn(`No backend tarball found in release v${cleanVersion}`);

			return null;
		}

		return {
			name: backendAsset.name,
			downloadUrl: backendAsset.browser_download_url,
			size: backendAsset.size,
		};
	}

	/**
	 * Fetch a GitHub release by tag. Shared by fetchReleaseNotes and fetchServerReleaseAsset.
	 */
	private async fetchGitHubRelease(cleanVersion: string): Promise<Record<string, unknown> | null> {
		const url = `${this.GITHUB_API_URL}/tags/v${cleanVersion}`;

		try {
			const response = await fetch(url, {
				headers: {
					Accept: 'application/vnd.github.v3+json',
					'User-Agent': 'FastyBird-SmartPanel',
				},
				signal: AbortSignal.timeout(UpdateService.FETCH_TIMEOUT_MS),
			});

			if (!response.ok) {
				this.logger.warn(`GitHub API returned ${response.status} for release v${cleanVersion}`);

				return null;
			}

			return (await response.json()) as Record<string, unknown>;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to fetch GitHub release v${cleanVersion}: ${err.message}`);

			return null;
		}
	}

	@Cron('0 */12 * * *')
	async scheduledUpdateCheck(): Promise<void> {
		this.logger.debug('Running scheduled update check');

		try {
			this.invalidateServerCache();

			const info = await this.checkServerUpdate();

			if (info.updateAvailable) {
				this.logger.log(`Update available: ${info.current} -> ${info.latest} (${info.updateType})`);
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Scheduled update check failed: ${err.message}`);
		}
	}

	invalidateServerCache(): void {
		this.cachedServerInfo.clear();
		this.serverCacheTimestamp.clear();
	}

	async checkPanelUpdate(prerelease: boolean = false): Promise<PanelVersionInfo> {
		const cacheKey = prerelease ? 'prerelease' : 'stable';
		const cached = this.cachedPanelInfo.get(cacheKey);
		const cacheTime = this.panelCacheTimestamp.get(cacheKey) ?? 0;

		if (cached && Date.now() - cacheTime < this.CACHE_TTL_MS) {
			return cached;
		}

		try {
			const url = prerelease ? `${this.GITHUB_API_URL}?per_page=10` : `${this.GITHUB_API_URL}/latest`;
			const response = await fetch(url, {
				headers: {
					Accept: 'application/vnd.github.v3+json',
					'User-Agent': 'FastyBird-SmartPanel',
				},
				signal: AbortSignal.timeout(UpdateService.FETCH_TIMEOUT_MS),
			});

			if (!response.ok) {
				throw new Error(`GitHub API returned ${response.status}`);
			}

			let release: { tag_name: string; assets: Array<{ name: string; browser_download_url: string; size: number }> };

			if (prerelease) {
				const releases = (await response.json()) as Array<typeof release & { prerelease: boolean }>;
				const found = releases.find((r) => r.prerelease);

				if (!found) {
					return { latest: null, assets: [] };
				}

				release = found;
			} else {
				release = (await response.json()) as typeof release;
			}

			const result = this.mapReleaseAssets(release);

			this.cachedPanelInfo.set(cacheKey, result);
			this.panelCacheTimestamp.set(cacheKey, Date.now());

			return result;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to check for panel updates: ${err.message}`);

			return { latest: null, assets: [] };
		}
	}

	async fetchPanelRelease(version: string): Promise<PanelVersionInfo> {
		const cleanVersion = version.replace(/^v/, '');

		try {
			const response = await fetch(`${this.GITHUB_API_URL}/tags/v${cleanVersion}`, {
				headers: {
					Accept: 'application/vnd.github.v3+json',
					'User-Agent': 'FastyBird-SmartPanel',
				},
				signal: AbortSignal.timeout(UpdateService.FETCH_TIMEOUT_MS),
			});

			if (!response.ok) {
				this.logger.error(`GitHub API returned ${response.status} for version ${cleanVersion}`);

				return { latest: null, assets: [] };
			}

			const release = (await response.json()) as {
				tag_name: string;
				assets: Array<{ name: string; browser_download_url: string; size: number }>;
			};

			return this.mapReleaseAssets(release);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to fetch panel release ${cleanVersion}: ${err.message}`);

			return { latest: null, assets: [] };
		}
	}

	private mapReleaseAssets(release: {
		tag_name: string;
		assets: Array<{ name: string; browser_download_url: string; size: number }>;
	}): PanelVersionInfo {
		const panelAssets = release.assets
			.filter((a) => a.name.startsWith('smart-panel-display') || a.name.endsWith('.apk'))
			.map((a) => ({
				name: a.name,
				downloadUrl: a.browser_download_url,
				size: a.size,
			}));

		return {
			latest: release.tag_name.replace(/^v/, ''),
			assets: panelAssets,
		};
	}
}
