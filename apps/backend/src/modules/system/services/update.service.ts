import { readFileSync } from 'fs';
import { join } from 'path';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { compareSemver, getUpdateType } from '../../../common/utils/semver';
import { SYSTEM_MODULE_NAME } from '../system.constants';

export interface VersionInfo {
	current: string;
	latest: string | null;
	updateAvailable: boolean;
	updateType: 'patch' | 'minor' | 'major' | null;
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

@Injectable()
export class UpdateService {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'UpdateService');

	private readonly NPM_REGISTRY_URL = 'https://registry.npmjs.org/@fastybird/smart-panel';
	private readonly GITHUB_API_URL = 'https://api.github.com/repos/FastyBird/smart-panel/releases';

	private cachedServerInfo: Map<string, VersionInfo> = new Map();
	private cachedPanelInfo: Map<string, PanelVersionInfo> = new Map();
	private serverCacheTimestamp: Map<string, number> = new Map();
	private panelCacheTimestamp: Map<string, number> = new Map();
	private readonly CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

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
			.filter((a) => a.name.startsWith('smart-panel-display') || a.name.endsWith('.apk') || a.name.includes('panel'))
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

	invalidateCache(): void {
		this.cachedServerInfo.clear();
		this.cachedPanelInfo.clear();
		this.serverCacheTimestamp.clear();
		this.panelCacheTimestamp.clear();
	}
}
