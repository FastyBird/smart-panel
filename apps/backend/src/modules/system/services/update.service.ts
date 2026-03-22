import { existsSync, readFileSync, readdirSync, readlinkSync } from 'fs';
import { basename, join } from 'path';

import { Injectable } from '@nestjs/common';
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

export interface ServerReleaseAsset {
	name: string;
	downloadUrl: string;
	size: number;
}

export interface PanelReleaseAsset {
	name: string;
	downloadUrl: string;
	size: number;
}

export interface PanelVersionInfo {
	latest: string | null;
	assets: PanelReleaseAsset[];
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

	private cachedServerInfo: Map<string, VersionInfo> = new Map();
	private cachedPanelInfo: Map<string, PanelVersionInfo> = new Map();
	private serverCacheTimestamp: Map<string, number> = new Map();
	private panelCacheTimestamp: Map<string, number> = new Map();
	private cachedReleaseNotes: Map<string, ReleaseNotes> = new Map();
	private readonly CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

	private updateStatus: UpdateStatusInfo = {
		status: UpdateStatusType.IDLE,
		phase: null,
		progressPercent: null,
		message: null,
		error: null,
		startedAt: null,
	};

	private updateLock = false;

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
			const currentDir = readlinkSync(UpdateService.IMAGE_CURRENT_LINK);
			const markerPath = join(UpdateService.IMAGE_BASE_DIR, currentDir, UpdateService.IMAGE_MARKER_FILE);

			if (existsSync(markerPath)) {
				return 'image';
			}
		} catch {
			// readlinkSync fails if the path is not a symlink or doesn't exist
		}

		// Also check absolute path (symlink may resolve to absolute)
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
	 */
	getInstalledVersions(): string[] {
		try {
			return readdirSync(UpdateService.IMAGE_BASE_DIR)
				.filter((entry) => entry.startsWith('v'))
				.map((entry) => entry.replace(/^v/, ''))
				.sort((a, b) => compareSemver(a, b));
		} catch {
			return [];
		}
	}

	/**
	 * Get the currently active version directory name (e.g. "v1.0.0")
	 */
	getActiveVersionDir(): string | null {
		try {
			const target = readlinkSync(UpdateService.IMAGE_CURRENT_LINK);

			return basename(target);
		} catch {
			return null;
		}
	}

	getImageBaseDir(): string {
		return UpdateService.IMAGE_BASE_DIR;
	}

	getStatus(): UpdateStatusInfo {
		return { ...this.updateStatus };
	}

	isUpdateInProgress(): boolean {
		return this.updateLock;
	}

	acquireUpdateLock(): boolean {
		if (this.updateLock) {
			return false;
		}

		this.updateLock = true;

		return true;
	}

	releaseUpdateLock(): void {
		this.updateLock = false;
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

		try {
			const response = await fetch(this.NPM_REGISTRY_URL);

			if (!response.ok) {
				throw new Error(`npm registry returned ${response.status}`);
			}

			const data = (await response.json()) as { 'dist-tags'?: Record<string, string> };
			const latestVersion = data['dist-tags']?.[channel] ?? null;

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

	async fetchReleaseNotes(version: string): Promise<ReleaseNotes> {
		const cleanVersion = version.replace(/^v/, '');
		const cached = this.cachedReleaseNotes.get(cleanVersion);

		if (cached) {
			return cached;
		}

		const url = `${this.GITHUB_API_URL}/tags/v${cleanVersion}`;

		try {
			const response = await fetch(url, {
				headers: {
					Accept: 'application/vnd.github.v3+json',
					'User-Agent': 'FastyBird-SmartPanel',
				},
			});

			if (!response.ok) {
				this.logger.warn(`GitHub API returned ${response.status} for release notes v${cleanVersion}`);

				return {
					version: cleanVersion,
					body: null,
					url: `https://github.com/FastyBird/smart-panel/releases/tag/v${cleanVersion}`,
					publishedAt: null,
				};
			}

			const release = (await response.json()) as {
				tag_name: string;
				body: string | null;
				html_url: string;
				published_at: string | null;
			};

			const result: ReleaseNotes = {
				version: cleanVersion,
				body: release.body,
				url: release.html_url,
				publishedAt: release.published_at,
			};

			this.cachedReleaseNotes.set(cleanVersion, result);

			return result;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to fetch release notes for v${cleanVersion}: ${err.message}`);

			return {
				version: cleanVersion,
				body: null,
				url: `https://github.com/FastyBird/smart-panel/releases/tag/v${cleanVersion}`,
				publishedAt: null,
			};
		}
	}

	/**
	 * For image installs, fetch the backend tarball download URL from a GitHub release.
	 */
	async fetchServerReleaseAsset(version: string): Promise<ServerReleaseAsset | null> {
		const cleanVersion = version.replace(/^v/, '');
		const url = `${this.GITHUB_API_URL}/tags/v${cleanVersion}`;

		try {
			const response = await fetch(url, {
				headers: {
					Accept: 'application/vnd.github.v3+json',
					'User-Agent': 'FastyBird-SmartPanel',
				},
			});

			if (!response.ok) {
				this.logger.warn(`GitHub API returned ${response.status} for release v${cleanVersion}`);

				return null;
			}

			const release = (await response.json()) as {
				tag_name: string;
				assets: Array<{ name: string; browser_download_url: string; size: number }>;
			};

			// Look for the backend tarball (e.g., smart-panel-v1.2.0-backend.tar.gz)
			const backendAsset = release.assets.find((a) => a.name.includes('backend') && a.name.endsWith('.tar.gz'));

			if (!backendAsset) {
				this.logger.warn(`No backend tarball found in release v${cleanVersion}`);

				return null;
			}

			return {
				name: backendAsset.name,
				downloadUrl: backendAsset.browser_download_url,
				size: backendAsset.size,
			};
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to fetch server release asset for v${cleanVersion}: ${err.message}`);

			return null;
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
