import { existsSync, readFileSync, readdirSync, readlinkSync } from 'fs';
import { join } from 'path';

import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';

import { createExtensionLogger } from '../../../common/logger';
import { compareSemver, getUpdateType } from '../../../common/utils/semver';
import { EventType as ConfigEventType } from '../../config/config.constants';
import { ConfigService } from '../../config/services/config.service';
import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../notifications/notifications.constants';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { SystemConfigModel } from '../models/config.model';
import { EventType, SYSTEM_MODULE_NAME, UpdateChannelType, UpdatePhase, UpdateStatusType } from '../system.constants';

interface ConfigUpdatedEvent {
	source: string;
	type: 'module' | 'plugin';
}

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
	// Absolute expiry rather than write time, so a lookup that only partially succeeded can be
	// given a shorter life than a complete one.
	private serverCacheExpiresAt: Map<string, number> = new Map();
	private panelCacheTimestamp: Map<string, number> = new Map();
	private cachedReleaseNotes: Map<string, ReleaseNotes> = new Map();
	private readonly CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

	// Bumped before every fresh remote lookup in checkServerUpdate(). A lookup whose generation
	// no longer matches when it finishes was superseded by a newer one while it was in flight -
	// its result is still returned to its own caller, but it must not overwrite the cache or
	// mutate the announced-availability notification with a now-stale answer.
	private checkGeneration = 0;

	// The availability last reported to notify()/resolve(), so reportUpdateAvailability() can
	// tell a genuine transition from a repeat of the same fresh check - starts `null` (nothing
	// announced yet), so a fresh negative check is not treated as "became unavailable".
	private lastAnnouncedAvailability: { available: boolean; version: string | null } | null = null;

	// A lookup that could not consult every accepted channel — the releases API was unavailable,
	// or the scan ran out of budget — still produces a usable answer, but an incomplete one: the
	// channel it failed to reach may hold something newer. Caching that for the full TTL would
	// let one transient failure report "up to date" to GET /status for half a day. It is kept
	// only briefly instead, so the next poll retries without hammering a failing API.
	private static readonly PARTIAL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

	constructor(
		private readonly eventEmitter: EventEmitter2,
		private readonly notifications: NotificationsService,
		private readonly configService: ConfigService,
	) {}

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
	 *
	 * Returns null for a version carrying a pre-release identifier this project does not publish,
	 * such as "2.0.0-rc.1". Falling back to "latest" there would classify a pre-release as stable
	 * and offer it to a stable install — and since this method is what the minimum-stability
	 * guarantee is enforced with, an unrecognised identifier has to mean "unknown", not "safe".
	 */
	detectChannel(version?: string): 'latest' | 'beta' | 'alpha' | null {
		const raw = version ?? this.getCurrentVersion();

		// Build metadata carries no precedence and may contain anything, including the words
		// "alpha" and "beta" — so it is discarded before anything is classified, not after.
		const core = raw.replace(/^v/, '').split('+')[0];
		const separator = core.indexOf('-');

		if (separator === -1) {
			return 'latest';
		}

		// Compare the first dot-separated pre-release identifier as a whole. A substring match
		// would read "1.0.0-alpharelease.1" as the alpha channel.
		const [identifier] = core.slice(separator + 1).split('.');

		if (identifier === 'alpha') return 'alpha';
		if (identifier === 'beta') return 'beta';

		return null;
	}

	/**
	 * The channel a lookup will actually run against.
	 *
	 * Precedence: an explicit argument (the CLI's `--channel`) beats the operator's configured
	 * channel, which beats the channel inferred from the installed version. Public because the
	 * CLI needs the same answer the service uses — it prints the channel it checked and decides
	 * whether to include pre-releases for the panel from it.
	 */
	resolveEffectiveChannel(explicit?: 'latest' | 'beta' | 'alpha'): 'latest' | 'beta' | 'alpha' {
		return explicit ?? this.resolveConfiguredChannel() ?? this.detectChannel() ?? 'latest';
	}

	/**
	 * The operator's configured channel, or null when they have left it on `auto`.
	 *
	 * `auto` deliberately resolves to null rather than to a channel of its own: the caller then
	 * falls back to {@link detectChannel}, which is the behaviour every install had before this
	 * setting existed. That keeps `auto` a true no-op for devices nobody has touched.
	 *
	 * A missing or unreadable config is also `auto` — an update check must never fail because a
	 * preference could not be read.
	 */
	private resolveConfiguredChannel(): 'latest' | 'beta' | 'alpha' | null {
		let configured: UpdateChannelType | undefined;

		try {
			configured = this.configService.getModuleConfig<SystemConfigModel>(SYSTEM_MODULE_NAME).updateChannel;
		} catch (error) {
			const err = error as Error;

			this.logger.warn(`Could not read the configured update channel (${err.message}), falling back to auto`);

			return null;
		}

		switch (configured) {
			// `stable` is the operator-facing name for the channel this codebase calls `latest`.
			case UpdateChannelType.STABLE:
				return 'latest';
			case UpdateChannelType.BETA:
				return 'beta';
			case UpdateChannelType.ALPHA:
				return 'alpha';
			default:
				return null;
		}
	}

	/**
	 * Drop the cached lookups when the system config changes, so switching the channel is
	 * reflected by the next check instead of up to 12 hours later. The caches are keyed by
	 * channel, so a switch would otherwise answer from whichever entry the new channel happens
	 * to hit — or from none at all, while the *old* channel's stale entry lives on.
	 */
	@OnEvent(ConfigEventType.CONFIG_UPDATED)
	onConfigUpdated(event: ConfigUpdatedEvent): void {
		if (event.type !== 'module' || event.source !== SYSTEM_MODULE_NAME) {
			return;
		}

		this.cachedServerInfo.clear();
		this.serverCacheExpiresAt.clear();
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
		// Precedence: an explicit argument (the CLI's --channel) beats the operator's configured
		// channel, which beats the channel inferred from the installed version. An install whose
		// own version carries an identifier we do not recognise cannot be placed on a pre-release
		// line, so it is treated as stable-only: the only thing we can safely offer it is a
		// release with no pre-release component at all. Normalising here also keeps the cache
		// keyed by a real channel.
		const resolvedChannel = this.resolveEffectiveChannel(channel);
		const cached = this.cachedServerInfo.get(resolvedChannel);
		const expiresAt = this.serverCacheExpiresAt.get(resolvedChannel) ?? 0;

		if (cached && Date.now() < expiresAt) {
			return cached;
		}

		const currentVersion = this.getCurrentVersion();
		const installType = this.getInstallType();
		const candidateChannels = this.resolveCandidateChannels(resolvedChannel);

		// Captured before the lookup starts, not after it finishes, so two overlapping calls (a
		// scheduled check and a manual one, say) are ordered by when they started, not by which one
		// happens to answer first.
		const generation = ++this.checkGeneration;

		try {
			let latestVersion: string | null = null;
			let complete = true;

			if (installType === 'image') {
				// Image installs: check GitHub version.json or releases API
				const lookup = await this.fetchLatestVersionFromGitHub(candidateChannels);

				latestVersion = lookup.version;
				complete = lookup.complete;
			} else {
				// npm installs: a single registry document carries every dist-tag, so the lookup
				// either succeeds outright or throws — it is never partial.
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

			// A newer check already finished and answered while this one was still in flight - its
			// cache write and notification would only relitigate a question that is already settled,
			// with a now-stale answer. This call's own caller still gets its own truthful result.
			if (generation === this.checkGeneration) {
				this.cachedServerInfo.set(resolvedChannel, result);
				this.serverCacheExpiresAt.set(
					resolvedChannel,
					Date.now() + (complete ? this.CACHE_TTL_MS : UpdateService.PARTIAL_CACHE_TTL_MS),
				);

				this.reportUpdateAvailability(result, resolvedChannel);
			}

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
	 * Raises or resolves the `update-available` issue after a fresh check. Called only from the
	 * non-cached, non-superseded branch of {@link checkServerUpdate}, so a cache hit or a stale
	 * generation never re-reports a condition that was not actually just (re-)checked — the
	 * scheduled (12 h cron) and manual "check for updates" paths both invalidate the cache before
	 * calling `checkServerUpdate`, so this covers both without a second call site.
	 *
	 * Compares against {@link lastAnnouncedAvailability} rather than reacting to `info` alone, so
	 * a repeat of the same fresh answer — the common case, since most checks find nothing new —
	 * calls neither notify() nor resolve(): only becoming available, the offered version
	 * changing, or becoming unavailable again are transitions worth reporting.
	 */
	private reportUpdateAvailability(info: VersionInfo, channel: string): void {
		const previous = this.lastAnnouncedAvailability;
		const next = { available: info.updateAvailable, version: info.updateAvailable ? info.latest : null };

		this.lastAnnouncedAvailability = next;

		const becameAvailable =
			next.available && (previous === null || !previous.available || previous.version !== next.version);

		if (becameAvailable) {
			void this.notifications.notify({
				source: SYSTEM_MODULE_NAME,
				kind: NotificationKind.ISSUE,
				key: 'update-available',
				severity: NotificationSeverity.INFO,
				title: `Update ${info.latest} is available`,
				message: `Installed ${info.current}. Channel: ${channel}.`,
				actions: [{ type: NotificationActionType.LINK, label: 'View update', url: '/system/info', primary: true }],
				data: { current_version: info.current, latest_version: info.latest },
			});

			return;
		}

		const becameUnavailable = !next.available && previous !== null && previous.available;

		if (becameUnavailable) {
			void this.notifications.resolve(SYSTEM_MODULE_NAME, 'update-available');
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
	private async fetchLatestVersionFromGitHub(
		channels: Array<'latest' | 'beta' | 'alpha'>,
	): Promise<{ version: string | null; complete: boolean }> {
		const wanted = new Set<'latest' | 'beta' | 'alpha'>(channels);
		// Keyed by the channel a version *actually* belongs to. Every source feeds this same map
		// through the same classification, so no source can claim a channel it did not answer.
		const answered = new Map<'latest' | 'beta' | 'alpha', string>();
		let apiError: Error | null = null;
		// A scan that could not read every eligible release's version.json has not ruled out a
		// newer version, so its answer is provisional even when the listing itself succeeded.
		let scanComplete = false;

		// One deadline for the whole lookup. It starts here rather than inside the scan, because
		// the caller may wait for both the listing and the probe.
		const deadline = Date.now() + UpdateService.GITHUB_LOOKUP_TIMEOUT_MS;

		// The listing goes first: a single request covers every requested channel at once, so
		// running it before the stable probe means the probe is only paid for when the listing
		// could not answer the stable channel itself.
		try {
			const scan = await this.fetchVersionsFromReleasesApi(channels, deadline);

			scanComplete = scan.complete;

			for (const version of scan.versions) {
				this.recordCandidate(answered, wanted, version);
			}
		} catch (error) {
			// A rate-limited or failing API is not fatal on its own — the probe below may still
			// answer the stable channel — but the channels it would have covered are now unknown
			// rather than absent.
			apiError = error as Error;

			this.logger.warn(`Releases API lookup failed (${apiError.message}), falling back to the direct probe`);
		}

		// `releases/latest` cannot be pushed out of view by a long run of pre-releases the way the
		// first page of the listing can, so it remains the only way to see a stable release that
		// sits further back than the listing reaches. It is worth a request only when the listing
		// left the stable channel unanswered.
		if (wanted.has('latest') && !answered.has('latest')) {
			const probed = await this.fetchStableVersionFromDownloadUrl(deadline);

			// The download URL is just another source of a version string. If what it returns is
			// not in fact stable, the stable channel simply stays unanswered.
			this.recordCandidate(answered, wanted, probed);
		}

		// Nothing answered and the API is why — the caller cannot be given a truthful "up to date",
		// so the failure is surfaced rather than reported as an absence of updates.
		if (answered.size === 0 && apiError !== null) {
			throw apiError;
		}

		// Completeness is derived once, here, rather than tracked at each exit path. Since the scan
		// now reads the whole page instead of stopping at the first hit per channel, having an
		// answer for every channel no longer proves the search finished — only running out of
		// neither time nor API does.
		const complete = apiError === null && scanComplete && this.requestBudget(deadline) > 0;

		return { version: this.pickHighestVersion([...answered.values()], channels), complete };
	}

	/**
	 * File a version under the channel its own version string puts it in, keeping the first (and
	 * therefore newest, since sources are consulted newest-first) answer per channel. Versions
	 * outside the accepted channels are dropped rather than recorded, so a channel is only ever
	 * marked answered by a version that genuinely belongs to it.
	 */
	private recordCandidate(
		answered: Map<'latest' | 'beta' | 'alpha', string>,
		wanted: Set<'latest' | 'beta' | 'alpha'>,
		version: string | null | undefined,
	): void {
		if (!version) return;

		const channel = this.detectChannel(version);

		if (channel === null || !wanted.has(channel)) return;

		const held = answered.get(channel);

		// Highest wins, not first seen. GitHub lists releases newest-created first, which is not
		// the same order as semver: a backport cut after a major pre-release is listed above it.
		if (held === undefined || compareSemver(held, version) < 0) {
			answered.set(channel, version);
		}
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
	 * The whole page is read — releases come back newest-*created* first, which is not semver
	 * order, so stopping at the first hit per channel can miss a higher version further down.
	 *
	 * Each release's tag is classified before anything is downloaded, so only releases on a
	 * requested channel cost an asset fetch. Without that filter a device on a channel with no
	 * recent releases pays one request per listed release on every lookup, which is the quickest
	 * way to reach the unauthenticated API's hourly limit and leave every later check partial.
	 *
	 * Reports `complete: false` when an eligible release's version.json could not be read. Such a
	 * read is skipped rather than retried, and the release it was skipped for may be the only one
	 * carrying a newer version — caching that silence as a full "up to date" would hide an update
	 * for the whole 12-hour TTL over what is usually a transient failure.
	 */
	private async fetchVersionsFromReleasesApi(
		channels: Array<'latest' | 'beta' | 'alpha'>,
		deadline: number,
	): Promise<{ versions: string[]; complete: boolean }> {
		// The probe may already have consumed the lookup's budget. Bail out rather than issue a
		// request with a non-positive timeout, which AbortSignal.timeout rejects outright.
		if (this.requestBudget(deadline) <= 0) {
			this.logger.warn('GitHub lookup budget spent before the releases listing; skipping the scan');

			return { versions: [], complete: false };
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

		const versions: string[] = [];
		const wanted = new Set<'latest' | 'beta' | 'alpha'>(channels);
		let complete = true;

		// The caller keeps the highest per channel and treats a budget-truncated read as partial.
		for (const release of releases) {
			// The tag already names the version, so a release on a channel nobody asked for can be
			// dropped before it costs a request. Only a tag that classifies to a *known* channel is
			// trusted to exclude — an unrecognised one falls through to version.json, which may
			// still name an accepted version.
			const taggedChannel = this.detectChannel(release.tag_name);

			if (taggedChannel !== null && !wanted.has(taggedChannel)) continue;

			const versionAsset = release.assets.find((a) => a.name === 'version.json');

			if (!versionAsset) continue;

			if (this.requestBudget(deadline) <= 0) {
				this.logger.warn(
					`GitHub lookup hit its ${UpdateService.GITHUB_LOOKUP_TIMEOUT_MS}ms budget after reading ` +
						`${versions.length} release(s); continuing with partial results`,
				);

				complete = false;

				break;
			}

			try {
				const assetResponse = await fetch(versionAsset.browser_download_url, {
					headers: { 'User-Agent': 'FastyBird-SmartPanel' },
					signal: AbortSignal.timeout(this.requestBudget(deadline)),
				});

				if (!assetResponse.ok) {
					this.logger.warn(
						`version.json for ${release.tag_name} returned ${assetResponse.status}; the scan is incomplete`,
					);

					complete = false;

					continue;
				}

				const versionData = (await assetResponse.json()) as { version?: string; channel?: string };
				const version = versionData.version?.replace(/^v/, '');

				// Only the version is taken. version.json's `channel` is hand-written in the release
				// workflow and is never consulted — the caller classifies from the version itself.
				if (version) {
					versions.push(version);
				} else {
					// The asset was readable but names no version, so this release contributes
					// nothing and we cannot tell whether it was newer.
					complete = false;
				}
			} catch (error) {
				const err = error as Error;

				this.logger.warn(
					`Could not read version.json for ${release.tag_name} (${err.message}); the scan is incomplete`,
				);

				complete = false;
			}
		}

		return { versions, complete };
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
		this.serverCacheExpiresAt.clear();
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
