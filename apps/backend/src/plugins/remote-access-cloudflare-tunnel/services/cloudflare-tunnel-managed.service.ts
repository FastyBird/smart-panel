import { execFile } from 'node:child_process';
import { join } from 'path';

import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { getEnvValue } from '../../../common/utils/config.utils';
import { ConfigService } from '../../../modules/config/services/config.service';
import { BaseManagedExtensionService } from '../../../modules/extensions/services/base-managed-extension.service';
import { ConfigChangeResult } from '../../../modules/extensions/services/managed-extension-service.interface';
import { PlatformType } from '../../../modules/platform/platform.constants';
import { PlatformService } from '../../../modules/platform/services/platform.service';
import {
	RemoteAccessAdvisory,
	RemoteAccessEndpoint,
	RemoteAccessProviderState,
	RemoteAccessProviderStatus,
} from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import { EventType as RemoteAccessEventType } from '../../../modules/remote-access/remote-access.constants';
import { RemoteAccessCloudflareTunnelPluginConfigModel } from '../models/config.model';
import {
	CLOUDFLARED_METRICS_ADDRESS,
	CLOUDFLARED_MIN_VERSION,
	CLOUDFLARED_POLL_INTERVAL_STABLE_MS,
	CLOUDFLARED_POLL_INTERVAL_TRANSITIONING_MS,
	CLOUDFLARED_READY_GRACE_MS,
	CLOUDFLARE_TUNNEL_DOCUMENTATION_URL,
	CLOUDFLARE_TUNNEL_PRINT_PLAN_TIMEOUT_MS,
	CLOUDFLARE_TUNNEL_VENDOR_DOWNLOAD_URL,
	REMOTE_ACCESS_CLOUDFLARE_METRICS_ADDRESS_ENV,
	REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
} from '../remote-access-cloudflare-tunnel.constants';
import { CloudflareTunnelStopFailedException } from '../remote-access-cloudflare-tunnel.exceptions';

import { CloudflaredCliError, CloudflaredCliService } from './cloudflared-cli.service';
import { CloudflaredMetricsService } from './cloudflared-metrics.service';
import { CloudflaredProcessService } from './cloudflared-process.service';

export type CloudflareTunnelRequirementCode =
	| 'platform-supported'
	| 'binary-installed'
	| 'version-supported'
	| 'token-configured';

/**
 * Exact console commands (and/or a documentation link) that satisfy one unsatisfied requirement
 * on the detected system — D12's manual remedy contract, mirroring the Tailscale plugin's
 * `TailscaleRequirementRemedy` exactly.
 */
export interface CloudflareTunnelRequirementRemedy {
	commands: string[];
	note: string | null;
}

export interface CloudflareTunnelRequirement {
	code: CloudflareTunnelRequirementCode;
	satisfied: boolean;
	message: string;
	/** Always `null` when `satisfied` is `true`. */
	remedy: CloudflareTunnelRequirementRemedy | null;
}

/** One requirement before `attachRemedies()` fills in `remedy`. */
type CloudflareTunnelRequirementBase = Omit<CloudflareTunnelRequirement, 'remedy'>;

const UNEVALUATED_MESSAGE = 'Not evaluated: the platform requirement is not satisfied.';

/** Priority order `computeStatus()` walks to find the first unsatisfied requirement that blocks running the tunnel (D12 rule 3). */
const BLOCKING_ORDER: readonly CloudflareTunnelRequirementCode[] = [
	'platform-supported',
	'binary-installed',
	'version-supported',
	'token-configured',
];

/** Simple dotted-numeric version compare (cloudflared uses CalVer, e.g. `2024.6.1`); non-numeric segments count as 0. */
export function compareCloudflaredVersions(a: string, b: string): number {
	const toParts = (v: string) => v.split('.').map((segment) => parseInt(segment, 10) || 0);
	const partsA = toParts(a);
	const partsB = toParts(b);

	for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
		const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);

		if (diff !== 0) {
			return diff;
		}
	}

	return 0;
}

/**
 * Managed service `tunnel` for the Cloudflare Tunnel remote-access provider plugin.
 *
 * Unlike the Tailscale node (which drives an independently running `tailscaled` daemon through
 * its CLI), this service directly owns the `cloudflared tunnel ... run` child process (D9):
 * `start()`/`stop()` spawn and kill it, and `computeStatus()` derives connection state from the
 * process's own liveness plus `cloudflared`'s local `/ready` metrics endpoint — never from a
 * CLI status call.
 */
@Injectable()
export class CloudflareTunnelManagedService extends BaseManagedExtensionService {
	private readonly logger: ReturnType<typeof createExtensionLogger> = createExtensionLogger(
		REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
		'CloudflareTunnelManagedService',
	);

	readonly owner = { kind: 'plugin', type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME } as const;
	readonly serviceId = 'tunnel';
	readonly activationPolicy = 'owner-enabled' as const;

	private pollTimer: NodeJS.Timeout | null = null;
	private lastStatus: RemoteAccessProviderStatus | null = null;
	/** Set by `stop()` when stopping the child process fails unexpectedly — read back by `computeStatus()` while `this.state === 'error'`. */
	private lastError: string | null = null;
	private pluginConfig: RemoteAccessCloudflareTunnelPluginConfigModel | null = null;
	private requirementsCache: CloudflareTunnelRequirement[] | null = null;
	/** Cached from the last successful `evaluateBinaryAndVersion()` — read by `buildDetails()`/`buildAdvisories()` regardless of connection state. */
	private lastKnownVersion: string | null = null;

	constructor(
		private readonly cliService: CloudflaredCliService,
		private readonly processService: CloudflaredProcessService,
		private readonly metricsService: CloudflaredMetricsService,
		private readonly configService: ConfigService,
		private readonly nestConfigService: NestConfigService,
		private readonly platformService: PlatformService,
		private readonly eventEmitter: EventEmitter2,
	) {
		super();
	}

	/**
	 * Never throws (self-healing, matching the Tailscale node's D3 philosophy): unsatisfied
	 * requirements simply skip spawning the process, the poller keeps running, and
	 * `computeStatus()` reports `not-installed`/`setup-required` until an admin fixes it.
	 */
	async start(): Promise<void> {
		await this.withLock(async () => {
			if (this.state === 'started') {
				return;
			}

			this.state = 'starting';
			this.pluginConfig = null;

			const config = this.getPluginConfig();

			this.logger.log('Starting Cloudflare Tunnel service');

			try {
				const requirements = await this.refreshRequirements();

				if (this.requirementsSatisfied(requirements)) {
					this.processService.start({
						token: config.tunnelToken ?? '',
						protocol: config.protocol,
						metricsAddress: this.getMetricsAddress(),
					});
				}
			} catch (error) {
				this.logger.warn('Failed to evaluate Cloudflare Tunnel requirements during start', {
					message: error instanceof Error ? error.message : String(error),
				});
			}

			this.schedulePoll(0);

			this.state = 'started';

			this.logger.log('Cloudflare Tunnel service started');
		});
	}

	/**
	 * Kills the `cloudflared` child process (SIGTERM, then SIGKILL after the stop grace) and
	 * transitions to `stopped`. Stopping a local child process is expected to always succeed;
	 * a failure here is genuinely exceptional and transitions to `error` instead, mirroring
	 * `TailscaleNodeManagedService.stop()`'s D3 failure semantics.
	 */
	async stop(): Promise<void> {
		await this.withLock(async () => {
			if (this.state === 'stopped') {
				return;
			}

			this.state = 'stopping';

			this.clearPoll();

			try {
				await this.processService.stop();

				this.state = 'stopped';
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);

				this.state = 'error';
				this.lastError = message;

				this.logger.error('Failed to stop the Cloudflare Tunnel process', { message });

				await this.emitStatus();

				throw new CloudflareTunnelStopFailedException(message);
			}

			await this.emitStatus();

			this.logger.log('Cloudflare Tunnel service stopped');
		});
	}

	private async emitStatus(): Promise<void> {
		const status = await this.computeStatus();

		this.lastStatus = status;
		this.eventEmitter.emit(RemoteAccessEventType.PROVIDER_STATUS, status);
	}

	/**
	 * Token or protocol change → restart required (a running `cloudflared` process cannot pick
	 * up a new token/protocol without being respawned). A hostname-only change needs no restart
	 * — `computeStatus()` reads `public_hostname` live on every call, so the new endpoint is
	 * reflected immediately.
	 */
	async onConfigChanged(): Promise<ConfigChangeResult> {
		const previous = this.pluginConfig;
		this.pluginConfig = null;
		const next = this.getPluginConfig();

		const tokenChanged = !previous || previous.tunnelToken !== next.tunnelToken;
		const protocolChanged = !previous || previous.protocol !== next.protocol;

		if (tokenChanged || protocolChanged) {
			this.logger.log('Cloudflare Tunnel token or protocol changed, restart required');

			return { restartRequired: true };
		}

		await this.emitStatus().catch((error) => {
			this.logger.debug('Failed to emit status after a Cloudflare Tunnel config change', {
				message: error instanceof Error ? error.message : String(error),
			});
		});

		return { restartRequired: false };
	}

	/** `/ready` returning 200 — a fresh probe, no caching. */
	async isHealthy(): Promise<boolean> {
		if (!this.processService.isRunning()) {
			return false;
		}

		const ready = await this.metricsService.fetchReady(this.getMetricsAddress());

		return ready !== null;
	}

	/**
	 * Registered with `FactoryResetRegistryService` by the plugin module — stops the process
	 * through the full managed-service `stop()`, not `processService.stop()` directly: this
	 * service's poller self-heals a `started`-but-not-running process (see `pollTick()`), so
	 * stopping only the child process while leaving `this.state === 'started'` would let a
	 * pending tick see valid requirements and respawn `cloudflared` moments after this reports
	 * success. `stop()` clears the poll timer and moves `this.state` to `stopped` first.
	 * The token/hostname themselves are cleared by `POST /reset` through `ConfigService`, not here.
	 */
	async factoryReset(): Promise<{ success: boolean; reason?: string }> {
		try {
			await this.stop();

			return { success: true };
		} catch (error) {
			return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
		}
	}

	/** Cached snapshot from the last `refreshRequirements()` call — never populated before `start()` has run once. */
	getRequirements(): CloudflareTunnelRequirement[] {
		return this.requirementsCache ?? [];
	}

	/**
	 * Re-evaluates every prerequisite and updates the cache `getRequirements()` reads. Unlike
	 * the Tailscale node's `refreshRequirements()`, this is never throttled: every check here
	 * (platform detection, one `cloudflared --version` call, a config read) is cheap enough to
	 * run on every poll tick without a periodic cadence limit.
	 */
	async refreshRequirements(): Promise<CloudflareTunnelRequirement[]> {
		const requirements = await this.evaluateRequirementsLive();

		this.requirementsCache = requirements;

		return requirements;
	}

	/** `true` only when the list is non-empty and every requirement is satisfied. */
	private requirementsSatisfied(requirements: CloudflareTunnelRequirement[]): boolean {
		return requirements.length > 0 && requirements.every((requirement) => requirement.satisfied);
	}

	private async evaluateRequirementsLive(): Promise<CloudflareTunnelRequirement[]> {
		const platform = await this.evaluatePlatformSupported();

		if (!platform.satisfied) {
			return this.attachRemedies([
				platform,
				this.unevaluatedRequirement('binary-installed'),
				this.unevaluatedRequirement('version-supported'),
				this.unevaluatedRequirement('token-configured'),
			]);
		}

		const { binary, version } = await this.evaluateBinaryAndVersion();
		const token = this.evaluateTokenConfigured();

		return this.attachRemedies([platform, binary, version, token]);
	}

	private unevaluatedRequirement(code: CloudflareTunnelRequirementCode): CloudflareTunnelRequirementBase {
		return { code, satisfied: false, message: UNEVALUATED_MESSAGE };
	}

	/** Attaches `remedy` to each requirement: `null` when satisfied, otherwise the manual remedy for its code. */
	private async attachRemedies(
		requirements: CloudflareTunnelRequirementBase[],
	): Promise<CloudflareTunnelRequirement[]> {
		// Memoized as a shared *promise* so `binary-installed` and `version-supported` — both
		// unsatisfied together on a freshly detected missing install — never spawn
		// `cloudflared-setup.sh --print-plan` twice for one evaluation.
		let installRemedyPromise: Promise<CloudflareTunnelRequirementRemedy> | null = null;

		const getInstallRemedy = (): Promise<CloudflareTunnelRequirementRemedy> => {
			installRemedyPromise ??= this.buildInstallRemedy();

			return installRemedyPromise;
		};

		return Promise.all(requirements.map((requirement) => this.finalizeRequirement(requirement, getInstallRemedy)));
	}

	private async finalizeRequirement(
		requirement: CloudflareTunnelRequirementBase,
		getInstallRemedy: () => Promise<CloudflareTunnelRequirementRemedy>,
	): Promise<CloudflareTunnelRequirement> {
		if (requirement.satisfied) {
			return { ...requirement, remedy: null };
		}

		const remedy =
			requirement.code === 'binary-installed' || requirement.code === 'version-supported'
				? await getInstallRemedy()
				: this.buildFixedRemedy(requirement.code);

		return { ...requirement, remedy };
	}

	/** D12's manual remedy contract for the codes whose remedy never depends on the detected system. */
	private buildFixedRemedy(code: CloudflareTunnelRequirementCode): CloudflareTunnelRequirementRemedy {
		switch (code) {
			case 'token-configured':
				return { commands: [], note: 'Paste the tunnel token in the setup wizard' };
			case 'platform-supported':
			default:
				return { commands: [], note: CLOUDFLARE_TUNNEL_DOCUMENTATION_URL };
		}
	}

	/**
	 * Runs the plugin's own setup script in its unprivileged `--print-plan` mode to get the
	 * exact commands the privileged install step would run on this distro. Never throws: a
	 * missing script, a non-zero exit, a timeout or empty output (an unsupported distribution)
	 * all fall back to the vendor download link instead.
	 */
	private async buildInstallRemedy(): Promise<CloudflareTunnelRequirementRemedy> {
		try {
			const stdout = await this.runSetupScriptPrintPlan();
			const lines = stdout
				.split('\n')
				.map((line) => line.trim())
				.filter((line) => line.length > 0);

			if (lines.length === 0) {
				return { commands: [], note: CLOUDFLARE_TUNNEL_VENDOR_DOWNLOAD_URL };
			}

			// A line containing a pipe already carries its own `sudo` on the privileged segment
			// (e.g. `curl ... | sudo tee <path>`) — prefixing the whole line would elevate only
			// the left-hand command and leave the actual write unprivileged.
			return {
				commands: lines.map((line) => (line.includes('|') ? line : `sudo ${line}`)),
				note: null,
			};
		} catch (error) {
			this.logger.debug('Failed to build the install remedy from cloudflared-setup.sh --print-plan', {
				message: error instanceof Error ? error.message : String(error),
			});

			return { commands: [], note: CLOUDFLARE_TUNNEL_VENDOR_DOWNLOAD_URL };
		}
	}

	private runSetupScriptPrintPlan(): Promise<string> {
		const script = join(__dirname, '..', 'scripts', 'cloudflared-setup.sh');

		return new Promise((resolve, reject) => {
			execFile(
				'bash',
				[script, '--print-plan'],
				{ timeout: CLOUDFLARE_TUNNEL_PRINT_PLAN_TIMEOUT_MS },
				(error: NodeJS.ErrnoException | null, stdout?: string) => {
					if (error) {
						reject(error);

						return;
					}

					resolve(stdout ?? '');
				},
			);
		});
	}

	private async evaluatePlatformSupported(): Promise<CloudflareTunnelRequirementBase> {
		const platformType = await this.platformService.getPlatformTypeAsync();

		if (platformType === PlatformType.RASPBERRY || platformType === PlatformType.GENERIC) {
			return { code: 'platform-supported', satisfied: true, message: `Platform '${platformType}' is supported.` };
		}

		return {
			code: 'platform-supported',
			satisfied: false,
			message: `Cloudflare Tunnel is not supported on the '${platformType}' platform.`,
		};
	}

	private async evaluateBinaryAndVersion(): Promise<{
		binary: CloudflareTunnelRequirementBase;
		version: CloudflareTunnelRequirementBase;
	}> {
		try {
			const info = await this.cliService.getVersion();

			this.lastKnownVersion = info.version;

			const supported = compareCloudflaredVersions(info.version, CLOUDFLARED_MIN_VERSION) >= 0;

			return {
				binary: { code: 'binary-installed', satisfied: true, message: `cloudflared ${info.version} is installed.` },
				version: {
					code: 'version-supported',
					satisfied: supported,
					message: supported
						? `cloudflared ${info.version} meets the minimum supported version ${CLOUDFLARED_MIN_VERSION}.`
						: `cloudflared ${info.version} is older than the minimum supported version ${CLOUDFLARED_MIN_VERSION}.`,
				},
			};
		} catch (error) {
			const notInstalled = error instanceof CloudflaredCliError && error.kind === 'not-installed';

			return {
				binary: {
					code: 'binary-installed',
					satisfied: false,
					message: notInstalled
						? 'cloudflared is not installed.'
						: 'Failed to determine whether cloudflared is installed.',
				},
				version: {
					code: 'version-supported',
					satisfied: false,
					message: 'Cannot verify the cloudflared version before it is installed.',
				},
			};
		}
	}

	private evaluateTokenConfigured(): CloudflareTunnelRequirementBase {
		const config = this.getPluginConfig();
		const satisfied = typeof config.tunnelToken === 'string' && config.tunnelToken.trim().length > 0;

		return {
			code: 'token-configured',
			satisfied,
			message: satisfied
				? 'A Cloudflare tunnel token is configured.'
				: 'Paste the tunnel token from the Cloudflare Zero Trust dashboard',
		};
	}

	private firstBlockingRequirement(requirements: CloudflareTunnelRequirement[]): CloudflareTunnelRequirement | null {
		for (const code of BLOCKING_ORDER) {
			const requirement = requirements.find((candidate) => candidate.code === code);

			if (requirement && !requirement.satisfied) {
				return requirement;
			}
		}

		return null;
	}

	private stateForRequirementCode(code: CloudflareTunnelRequirementCode): RemoteAccessProviderState {
		switch (code) {
			case 'platform-supported':
				return 'unsupported';
			case 'token-configured':
				return 'setup-required';
			case 'binary-installed':
			case 'version-supported':
			default:
				return 'not-installed';
		}
	}

	/**
	 * Live status, used by both the poller and `CloudflareTunnelProviderService.getStatus()`
	 * (hence every `GET /status`). Never throws. Never mutates (a GET must not spawn or kill the
	 * process — see `pollTick()` for the only place that does).
	 *
	 * D2-style lifecycle short-circuit, mirroring `TailscaleNodeManagedService.computeStatus()`:
	 * `stopped`/`stopping` always report `disconnected` regardless of the daemon's own state,
	 * and `error` reports the recorded `lastError`.
	 */
	async computeStatus(): Promise<RemoteAccessProviderStatus> {
		if (this.state === 'stopped' || this.state === 'stopping') {
			return this.buildStatus('disconnected', 'The tunnel service is stopped.');
		}

		if (this.state === 'error') {
			return this.buildStatus('error', this.lastError ?? 'The Cloudflare Tunnel service failed.');
		}

		const requirements = await this.refreshRequirements();
		const blocking = this.firstBlockingRequirement(requirements);

		if (blocking) {
			return this.buildStatus(this.stateForRequirementCode(blocking.code), blocking.message);
		}

		if (!this.processService.isRunning()) {
			const lastLine = this.processService.getLastStderrLine();
			const exit = this.processService.getLastExit();
			const message =
				lastLine ??
				(exit
					? `cloudflared exited unexpectedly${exit.code !== null ? ` (code ${exit.code})` : ''}.`
					: 'cloudflared is not running.');

			return this.buildStatus('error', message);
		}

		const ready = await this.metricsService.fetchReady(this.getMetricsAddress());

		if (ready) {
			return this.buildStatus('connected', undefined, ready);
		}

		const startedAt = this.processService.getStartedAt();
		const withinGrace = startedAt !== null && Date.now() - startedAt < CLOUDFLARED_READY_GRACE_MS;

		if (withinGrace) {
			return this.buildStatus('connecting', 'Waiting for the tunnel to become ready.');
		}

		const message = this.processService.getLastStderrLine() ?? 'Cloudflared did not become ready in time.';

		return this.buildStatus('error', message);
	}

	// ─── Poller ───────────────────────────────────────────────────────

	private isPollable(): boolean {
		return this.state === 'starting' || this.state === 'started';
	}

	private schedulePoll(delayMs: number): void {
		this.clearPoll();

		if (!this.isPollable()) {
			return;
		}

		this.pollTimer = setTimeout(() => {
			void this.pollTick();
		}, delayMs);

		this.pollTimer.unref?.();
	}

	private clearPoll(): void {
		if (this.pollTimer) {
			clearTimeout(this.pollTimer);
			this.pollTimer = null;
		}
	}

	/**
	 * Unlike `computeStatus()`, this is allowed to mutate: if every requirement is satisfied but
	 * the `cloudflared` process is not running (it crashed, or never started because a
	 * requirement was unsatisfied at `start()` time and has since been fixed), it is (re)spawned
	 * — simple self-healing, bounded by the poll interval itself rather than a separate backoff.
	 */
	private async pollTick(): Promise<void> {
		try {
			if (this.state === 'started' && !this.processService.isRunning()) {
				const requirements = await this.refreshRequirements();

				if (this.requirementsSatisfied(requirements) && this.isPollable()) {
					const config = this.getPluginConfig();

					this.processService.start({
						token: config.tunnelToken ?? '',
						protocol: config.protocol,
						metricsAddress: this.getMetricsAddress(),
					});
				}
			}

			const status = await this.computeStatus();

			if (!this.isPollable()) {
				// stop() ran while this tick was in flight.
				return;
			}

			if (this.hasStatusChanged(this.lastStatus, status)) {
				this.lastStatus = status;
				this.eventEmitter.emit(RemoteAccessEventType.PROVIDER_STATUS, status);
			}

			this.schedulePoll(
				status.state === 'connecting'
					? CLOUDFLARED_POLL_INTERVAL_TRANSITIONING_MS
					: CLOUDFLARED_POLL_INTERVAL_STABLE_MS,
			);
		} catch (error) {
			if (!this.isPollable()) {
				return;
			}

			this.logger.error('Cloudflare Tunnel status poll failed', {
				message: error instanceof Error ? error.message : String(error),
			});

			this.schedulePoll(CLOUDFLARED_POLL_INTERVAL_STABLE_MS);
		}
	}

	private hasStatusChanged(previous: RemoteAccessProviderStatus | null, next: RemoteAccessProviderStatus): boolean {
		if (!previous) {
			return true;
		}

		return (
			previous.state !== next.state ||
			previous.message !== next.message ||
			JSON.stringify(previous.endpoints) !== JSON.stringify(next.endpoints) ||
			JSON.stringify(previous.details) !== JSON.stringify(next.details) ||
			JSON.stringify(previous.proxyAddresses) !== JSON.stringify(next.proxyAddresses) ||
			JSON.stringify(previous.advisories) !== JSON.stringify(next.advisories)
		);
	}

	// ─── Status assembly ──────────────────────────────────────────────

	private buildStatus(
		state: RemoteAccessProviderState,
		message: string | undefined,
		ready: { readyConnections: number; connectorId: string } | null = null,
	): RemoteAccessProviderStatus {
		const config = this.getPluginConfig();
		const connected = state === 'connected';

		return {
			type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
			state,
			endpoints: connected ? this.buildEndpoints(config) : [],
			message,
			details: this.buildDetails(config, ready),
			proxyAddresses: connected ? ['127.0.0.1', '::1'] : [],
			advisories: this.buildAdvisories(state, config),
			updatedAt: new Date().toISOString(),
		};
	}

	private buildEndpoints(config: RemoteAccessCloudflareTunnelPluginConfigModel): RemoteAccessEndpoint[] {
		if (!config.publicHostname) {
			return [];
		}

		return [{ url: `https://${config.publicHostname}`, scope: 'public', https: true, label: 'Cloudflare Tunnel' }];
	}

	private buildDetails(
		config: RemoteAccessCloudflareTunnelPluginConfigModel,
		ready: { readyConnections: number; connectorId: string } | null,
	): Record<string, string | number | boolean | null> {
		return {
			hostname: config.publicHostname,
			connector_id: ready?.connectorId ?? null,
			ready_connections: ready?.readyConnections ?? null,
			version: this.lastKnownVersion,
		};
	}

	/**
	 * `public-exposure` is always present while connected (D9/§4 — reachable from the internet,
	 * only the Smart Panel login protects it unless Cloudflare Access is configured);
	 * `hostname-not-configured` when connected but no endpoint is published yet;
	 * `version-unsupported` mirrors the Tailscale plugin's version-advisory pattern — computed
	 * from the last known version regardless of connection state.
	 */
	private buildAdvisories(
		state: RemoteAccessProviderState,
		config: RemoteAccessCloudflareTunnelPluginConfigModel,
	): RemoteAccessAdvisory[] {
		const advisories: RemoteAccessAdvisory[] = [];

		if (this.lastKnownVersion && compareCloudflaredVersions(this.lastKnownVersion, CLOUDFLARED_MIN_VERSION) < 0) {
			advisories.push({
				code: 'version-unsupported',
				severity: 'warning',
				message: `cloudflared ${this.lastKnownVersion} is older than the minimum supported version ${CLOUDFLARED_MIN_VERSION}. Upgrade the cloudflared package.`,
			});
		}

		if (state === 'connected') {
			advisories.push({
				code: 'public-exposure',
				severity: 'warning',
				message:
					'This installation is reachable from the internet; only the Smart Panel login protects it unless Cloudflare Access is configured.',
			});

			if (!config.publicHostname) {
				advisories.push({
					code: 'hostname-not-configured',
					severity: 'info',
					message: 'The tunnel is connected, but no public hostname is configured yet — no endpoint is published.',
				});
			}
		}

		return advisories;
	}

	private getMetricsAddress(): string {
		return getEnvValue<string>(
			this.nestConfigService,
			REMOTE_ACCESS_CLOUDFLARE_METRICS_ADDRESS_ENV,
			CLOUDFLARED_METRICS_ADDRESS,
		);
	}

	getPluginConfig(): RemoteAccessCloudflareTunnelPluginConfigModel {
		if (!this.pluginConfig) {
			try {
				this.pluginConfig = this.configService.getPluginConfig<RemoteAccessCloudflareTunnelPluginConfigModel>(
					REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
				);
			} catch (error) {
				this.logger.warn('Failed to load the Cloudflare Tunnel plugin configuration, using defaults', {
					message: error instanceof Error ? error.message : String(error),
				});
				this.pluginConfig = new RemoteAccessCloudflareTunnelPluginConfigModel();
			}
		}

		return this.pluginConfig;
	}
}
