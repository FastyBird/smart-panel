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
	private serverCacheTimestamp: number = 0;
	private panelCacheTimestamp: number = 0;
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
		if (this.cachedServerInfo && Date.now() - this.serverCacheTimestamp < this.CACHE_TTL_MS) {
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

			this.serverCacheTimestamp = Date.now();

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
		if (this.cachedPanelInfo && Date.now() - this.panelCacheTimestamp < this.CACHE_TTL_MS) {
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
				.filter((a) => a.name.startsWith('smart-panel-display') || a.name.endsWith('.apk') || a.name.includes('panel'))
				.map((a) => ({
					name: a.name,
					downloadUrl: a.browser_download_url,
					size: a.size,
				}));

			this.cachedPanelInfo = {
				latest: release.tag_name.replace(/^v/, ''),
				assets: panelAssets,
			};

			this.panelCacheTimestamp = Date.now();

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
		this.serverCacheTimestamp = 0;
		this.panelCacheTimestamp = 0;
	}

	private compareVersions(current: string, latest: string): number {
		const parseVersion = (v: string) => {
			const cleaned = v.replace(/^v/, '');
			const [base, ...prereleaseParts] = cleaned.split('-');
			const parts = base.split('.').map(Number);
			const prerelease = prereleaseParts.length > 0 ? prereleaseParts.join('-') : null;

			return { parts, prerelease };
		};

		const currentParsed = parseVersion(current);
		const latestParsed = parseVersion(latest);

		// Compare base version (major.minor.patch)
		for (let i = 0; i < 3; i++) {
			const c = currentParsed.parts[i] || 0;
			const l = latestParsed.parts[i] || 0;

			if (c < l) return -1;
			if (c > l) return 1;
		}

		// If base versions are equal, a pre-release version is less than the release version
		if (currentParsed.prerelease && !latestParsed.prerelease) return -1;
		if (!currentParsed.prerelease && latestParsed.prerelease) return 1;

		// Both are pre-releases with the same base version - compare pre-release identifiers
		if (currentParsed.prerelease && latestParsed.prerelease) {
			return this.comparePrereleaseIdentifiers(currentParsed.prerelease, latestParsed.prerelease);
		}

		return 0;
	}

	private comparePrereleaseIdentifiers(current: string, latest: string): number {
		const currentParts = current.split('.');
		const latestParts = latest.split('.');

		const maxLength = Math.max(currentParts.length, latestParts.length);

		for (let i = 0; i < maxLength; i++) {
			// Fewer identifiers = lower precedence (per semver spec)
			if (i >= currentParts.length) return -1;
			if (i >= latestParts.length) return 1;

			const cPart = currentParts[i];
			const lPart = latestParts[i];

			const cNum = Number(cPart);
			const lNum = Number(lPart);

			const cIsNum = !isNaN(cNum);
			const lIsNum = !isNaN(lNum);

			// Numeric identifiers have lower precedence than string identifiers
			if (cIsNum && !lIsNum) return -1;
			if (!cIsNum && lIsNum) return 1;

			if (cIsNum && lIsNum) {
				if (cNum < lNum) return -1;
				if (cNum > lNum) return 1;
			} else {
				// Both are strings - compare lexically
				if (cPart < lPart) return -1;
				if (cPart > lPart) return 1;
			}
		}

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
