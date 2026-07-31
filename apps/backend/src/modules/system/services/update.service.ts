import { existsSync, readFileSync, readdirSync, readlinkSync } from 'fs';
import { join } from 'path';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';

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
	private readonly GITHUB_VERSION_JSON_URL =
		'https://github.com/FastyBird/smart-panel/releases/latest/download/version.json';
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

	// Budget for the *entire* GitHub lookup: the stable probe, the releases listing, and every
	// version.json the scan opens. FETCH_TIMEOUT_MS bounds a single request, which is no bound at
	// all across a sequence of them — when a requested channel has no release the scan cannot
	// short-circuit and would walk the whole page, and a fall-forward install runs the probe
	// before that scan, so separate budgets would let a caller wait for their sum. One deadline
	// is created per lookup and every request inside it draws from what is left.
	private static readonly GITHUB_LOOKUP_TIMEOUT_MS = 30_000; // 30 seconds

	/** Release channels ordered least → most stable. */
	private static readonly CHANNEL_PRECEDENCE: ReadonlyArray<'latest' | 'beta' | 'alpha'> = ['alpha', 'beta', 'latest'];

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

	/**
	 * Detect the release channel from a semver version string.
	 * e.g. "0.2.0-alpha.1" → "alpha", "1.0.0-beta.3" → "beta", "1.0.0" → "latest"
	 */
	detectChannel(version?: string): 'latest' | 'beta' | 'alpha' {
		const v = version ?? this.getCurrentVersion();

		if (v.includes('-alpha')) return 'alpha';
		if (v.includes('-beta')) return 'beta';

		return 'latest';
	}

	/**
	 * Channels an install is willing to accept, ordered least → most stable.
	 *
	 * A channel is a *minimum stability*, not an exact match. Every pre-release line is
	 * finite: once a base version's alpha (or beta) series ends, no further release will
	 * ever carry that channel again. Matching the channel exactly therefore strands the
	 * device on it permanently — it keeps asking a dead channel and is truthfully told it
	 * is up to date, forever. Falling forward lets an alpha install move on to beta and
	 * then to stable, while never offering anything *less* stable than what is installed.
	 */
	private resolveCandidateChannels(channel: 'latest' | 'beta' | 'alpha'): Array<'latest' | 'beta' | 'alpha'> {
		const index = UpdateService.CHANNEL_PRECEDENCE.indexOf(channel);

		// An unknown channel is treated as stable-only rather than opening the device up
		// to every pre-release line.
		return index === -1 ? ['latest'] : [...UpdateService.CHANNEL_PRECEDENCE.slice(index)];
	}

	/**
	 * Highest version by semver precedence among those whose *own* pre-release identifier is
	 * within the accepted channels, or null when nothing qualifies.
	 *
	 * The channel a version arrives under is only a label: an npm dist-tag is a mutable pointer
	 * that can be moved to any version (this project's `latest` tag has pointed at an alpha),
	 * and a release's version.json `channel` is hand-written in the workflow. Trusting either
	 * would let a version labelled `latest` but numbered `1.1.0-alpha.0` reach a beta install
	 * and quietly downgrade its stability. The version string is the only self-evident source,
	 * so the guarantee is enforced against that.
	 */
	private pickHighestVersion(versions: string[], channels: Array<'latest' | 'beta' | 'alpha'>): string | null {
		const accepted = new Set<string>(channels);

		return versions
			.filter((version) => accepted.has(this.detectChannel(version)))
			.reduce<
				string | null
			>((highest, version) => (highest === null || compareSemver(highest, version) < 0 ? version : highest), null);
	}

	async checkServerUpdate(channel?: 'latest' | 'beta' | 'alpha'): Promise<VersionInfo> {
		const resolvedChannel = channel ?? this.detectChannel();
		const cached = this.cachedServerInfo.get(resolvedChannel);
		const cacheTime = this.serverCacheTimestamp.get(resolvedChannel) ?? 0;

		if (cached && Date.now() - cacheTime < this.CACHE_TTL_MS) {
			return cached;
		}

		const currentVersion = this.getCurrentVersion();
		const installType = this.getInstallType();
		const candidateChannels = this.resolveCandidateChannels(resolvedChannel);

		try {
			let latestVersion: string | null = null;

			if (installType === 'image') {
				// Image installs: check GitHub version.json or releases API
				latestVersion = await this.fetchLatestVersionFromGitHub(candidateChannels);
			} else {
				// npm installs: check npm registry dist-tags
				latestVersion = await this.fetchLatestVersionFromNpm(candidateChannels);
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

			this.cachedServerInfo.set(resolvedChannel, result);
			this.serverCacheTimestamp.set(resolvedChannel, Date.now());

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
	 * Timeout for one request drawing on a shared lookup deadline: never longer than a single
	 * request is allowed to take, and never longer than the lookup has left. A value of zero or
	 * below means the budget is spent and the caller should stop rather than issue the request.
	 */
	private requestBudget(deadline: number): number {
		return Math.min(UpdateService.FETCH_TIMEOUT_MS, deadline - Date.now());
	}

	/**
	 * Fetch the highest version advertised by GitHub across the accepted channels (image installs).
	 *
	 * The stable channel is probed through the direct `releases/latest/download` URL: it costs no
	 * API rate limit and, unlike the paged releases listing, it cannot be pushed out of view by a
	 * run of pre-releases. Pre-release channels have no such URL and must come from the API.
	 */
	private async fetchLatestVersionFromGitHub(channels: Array<'latest' | 'beta' | 'alpha'>): Promise<string | null> {
		const found: string[] = [];
		let stableResolved = false;

		// One deadline for the whole lookup. It starts here rather than inside the scan, because
		// a fall-forward install runs the probe first and the caller waits for both.
		const deadline = Date.now() + UpdateService.GITHUB_LOOKUP_TIMEOUT_MS;

		if (channels.includes('latest')) {
			const stable = await this.fetchStableVersionFromDownloadUrl(deadline);

			if (stable) {
				found.push(stable);
				stableResolved = true;
			}
		}

		// Anything the direct probe did not already answer still has to come from the API.
		const remaining = channels.filter((channel) => channel !== 'latest' || !stableResolved);

		if (remaining.length > 0) {
			try {
				found.push(...(await this.fetchVersionsFromReleasesApi(remaining, deadline)));
			} catch (error) {
				const err = error as Error;

				// A rate-limited or failing API must not discard a stable version we already hold.
				if (found.length === 0) {
					throw error;
				}

				this.logger.warn(`Releases API lookup failed (${err.message}), using directly probed version only`);
			}
		}

		return this.pickHighestVersion(found, channels);
	}

	/**
	 * Probe the stable channel via the direct asset download URL — no API rate limit,
	 * follows the redirect to the asset of whichever release GitHub marks as latest.
	 */
	private async fetchStableVersionFromDownloadUrl(deadline: number): Promise<string | null> {
		try {
			const response = await fetch(this.GITHUB_VERSION_JSON_URL, {
				headers: { 'User-Agent': 'FastyBird-SmartPanel' },
				signal: AbortSignal.timeout(this.requestBudget(deadline)),
			});

			if (response.ok) {
				const data = (await response.json()) as { version?: string; channel?: string };

				return data.version?.replace(/^v/, '') ?? null;
			}

			this.logger.debug(`Direct version.json returned ${response.status}, falling back to releases API`);
		} catch {
			this.logger.debug('Direct version.json fetch failed, falling back to releases API');
		}

		return null;
	}

	/**
	 * Query the GitHub releases API for the newest version.json of each requested channel.
	 *
	 * Releases come back newest-first, so the first hit for a channel is that channel's head.
	 * Matching is done on the version.json `channel` field alone rather than on the release's
	 * `prerelease` flag — the two encode the same thing, and trusting one avoids the case where
	 * they disagree. The scan stops as soon as every requested channel has an answer, which
	 * bounds the per-release asset fetches.
	 */
	private async fetchVersionsFromReleasesApi(
		channels: Array<'latest' | 'beta' | 'alpha'>,
		deadline: number,
	): Promise<string[]> {
		// The probe may already have consumed the lookup's budget. Bail out rather than issue a
		// request with a non-positive timeout, which AbortSignal.timeout rejects outright.
		if (this.requestBudget(deadline) <= 0) {
			this.logger.warn('GitHub lookup budget spent before the releases listing; skipping the scan');

			return [];
		}

		const response = await fetch(`${this.GITHUB_PRERELEASE_API_URL}?per_page=20`, {
			headers: {
				Accept: 'application/vnd.github.v3+json',
				'User-Agent': 'FastyBird-SmartPanel',
			},
			signal: AbortSignal.timeout(this.requestBudget(deadline)),
		});

		if (!response.ok) {
			throw new Error(`GitHub API returned ${response.status}`);
		}

		const releases = (await response.json()) as Array<{
			prerelease: boolean;
			tag_name: string;
			assets: Array<{ name: string; browser_download_url: string }>;
		}>;

		const wanted = new Set<string>(channels);
		const resolved = new Map<string, string>();

		for (const release of releases) {
			if (resolved.size === wanted.size) break;

			// A channel with no release at all never satisfies the check above, so the sweep
			// would otherwise open every release on the page. Stop at the budget instead and
			// report on whatever was resolved.
			if (this.requestBudget(deadline) <= 0) {
				this.logger.warn(
					`GitHub lookup hit its ${UpdateService.GITHUB_LOOKUP_TIMEOUT_MS}ms budget after resolving ` +
						`${resolved.size}/${wanted.size} channel(s); continuing with partial results`,
				);

				break;
			}

			const versionAsset = release.assets.find((a) => a.name === 'version.json');

			if (!versionAsset) continue;

			try {
				const assetResponse = await fetch(versionAsset.browser_download_url, {
					headers: { 'User-Agent': 'FastyBird-SmartPanel' },
					signal: AbortSignal.timeout(this.requestBudget(deadline)),
				});

				if (!assetResponse.ok) continue;

				const versionData = (await assetResponse.json()) as { version?: string; channel?: string };
				const channel = versionData.channel;

				if (!channel || !wanted.has(channel) || resolved.has(channel)) continue;

				const version = versionData.version?.replace(/^v/, '');

				if (version) {
					resolved.set(channel, version);
				}
			} catch {
				continue;
			}
		}

		return [...resolved.values()];
	}

	/**
	 * Fetch the highest version across the accepted channels' dist-tags (npm installs).
	 * The registry document carries every dist-tag, so all channels cost a single request.
	 */
	private async fetchLatestVersionFromNpm(channels: Array<'latest' | 'beta' | 'alpha'>): Promise<string | null> {
		const response = await fetch(this.NPM_REGISTRY_URL, {
			signal: AbortSignal.timeout(UpdateService.FETCH_TIMEOUT_MS),
		});

		if (!response.ok) {
			throw new Error(`npm registry returned ${response.status}`);
		}

		const data = (await response.json()) as { 'dist-tags'?: Record<string, string> };
		const distTags = data['dist-tags'] ?? {};

		return this.pickHighestVersion(
			channels.map((channel) => distTags[channel]).filter((v): v is string => !!v),
			channels,
		);
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

		// Look for the server tarball (e.g., smart-panel-server-0.1.0-arm64.tar.gz)
		const backendAsset = assets.find((a) => a.name.startsWith('smart-panel-server-') && a.name.endsWith('.tar.gz'));

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
