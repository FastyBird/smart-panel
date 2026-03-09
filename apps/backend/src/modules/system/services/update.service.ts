import { readFileSync } from 'fs';
import { join } from 'path';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
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

	private cachedServerInfo: VersionInfo | null = null;
	private cachedPanelInfo: PanelVersionInfo | null = null;
	private cacheTimestamp: number = 0;
	private readonly CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

	getCurrentVersion(): string {
		try {
			const pkgJson = JSON.parse(
				readFileSync(join(__dirname, '..', '..', '..', '..', 'package.json'), 'utf8'),
			) as { version: string };

			return pkgJson.version;
		} catch {
			return '0.0.0';
		}
	}

	async checkServerUpdate(channel: 'latest' | 'beta' | 'alpha' = 'latest'): Promise<VersionInfo> {
		if (this.cachedServerInfo && Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS) {
			return this.cachedServerInfo;
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
				const comparison = this.compareVersions(currentVersion, latestVersion);

				if (comparison < 0) {
					updateAvailable = true;
					updateType = this.getUpdateType(currentVersion, latestVersion);
				}
			}

			this.cachedServerInfo = {
				current: currentVersion,
				latest: latestVersion,
				updateAvailable,
				updateType,
			};

			this.cacheTimestamp = Date.now();

			return this.cachedServerInfo;
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
		if (this.cachedPanelInfo && Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS) {
			return this.cachedPanelInfo;
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

			const panelAssets = release.assets
				.filter(
					(a) =>
						a.name.startsWith('smart-panel-display') || a.name.endsWith('.apk') || a.name.includes('panel'),
				)
				.map((a) => ({
					name: a.name,
					downloadUrl: a.browser_download_url,
					size: a.size,
				}));

			this.cachedPanelInfo = {
				latest: release.tag_name.replace(/^v/, ''),
				assets: panelAssets,
			};

			this.cacheTimestamp = Date.now();

			return this.cachedPanelInfo;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to check for panel updates: ${err.message}`);

			return { latest: null, assets: [] };
		}
	}

	invalidateCache(): void {
		this.cachedServerInfo = null;
		this.cachedPanelInfo = null;
		this.cacheTimestamp = 0;
	}

	private compareVersions(current: string, latest: string): number {
		const cleanVersion = (v: string) => v.replace(/^v/, '').split('-')[0];

		const currentParts = cleanVersion(current).split('.').map(Number);
		const latestParts = cleanVersion(latest).split('.').map(Number);

		for (let i = 0; i < 3; i++) {
			const c = currentParts[i] || 0;
			const l = latestParts[i] || 0;

			if (c < l) return -1;
			if (c > l) return 1;
		}

		// If base versions are equal, a pre-release version is less than the release version
		const currentPrerelease = current.includes('-');
		const latestPrerelease = latest.includes('-');

		if (currentPrerelease && !latestPrerelease) return -1;
		if (!currentPrerelease && latestPrerelease) return 1;

		return 0;
	}

	private getUpdateType(current: string, latest: string): 'patch' | 'minor' | 'major' {
		const cleanVersion = (v: string) => v.replace(/^v/, '').split('-')[0];

		const currentParts = cleanVersion(current).split('.').map(Number);
		const latestParts = cleanVersion(latest).split('.').map(Number);

		if ((latestParts[0] || 0) > (currentParts[0] || 0)) return 'major';
		if ((latestParts[1] || 0) > (currentParts[1] || 0)) return 'minor';

		return 'patch';
	}
}
