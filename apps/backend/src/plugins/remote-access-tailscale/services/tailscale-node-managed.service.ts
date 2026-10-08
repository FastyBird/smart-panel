import os from 'os';
import { join } from 'path';

import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { cancellableExecFile } from '../../../common/utils/cancellable-exec.utils';
import { getEnvValue } from '../../../common/utils/config.utils';
import { RemoteAccessObservation } from '../../../common/utils/remote-access-observation.utils';
import { ConfigService } from '../../../modules/config/services/config.service';
import { BaseManagedExtensionService } from '../../../modules/extensions/services/base-managed-extension.service';
import {
	ConfigChangeResult,
	ServiceState,
} from '../../../modules/extensions/services/managed-extension-service.interface';
import { PlatformType } from '../../../modules/platform/platform.constants';
import { PlatformService } from '../../../modules/platform/services/platform.service';
import {
	RemoteAccessAdvisory,
	RemoteAccessEndpoint,
	RemoteAccessProviderState,
	RemoteAccessProviderStatus,
} from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import { EventType as RemoteAccessEventType } from '../../../modules/remote-access/remote-access.constants';
import { RemoteAccessTailscalePluginConfigModel } from '../models/config.model';
import {
	REMOTE_ACCESS_TAILSCALE_ALLOW_DEV_ENV,
	REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
	TAILSCALE_DEFAULT_LOGIN_SERVER,
	TAILSCALE_KEY_EXPIRY_ADVISORY_WINDOW_MS,
	TAILSCALE_MIN_VERSION,
	TAILSCALE_POLL_INTERVAL_STABLE_MS,
	TAILSCALE_POLL_INTERVAL_TRANSITIONING_MS,
	TAILSCALE_RECONNECT_BASE_DELAY_MS,
	TAILSCALE_RECONNECT_MAX_DELAY_MS,
	TAILSCALE_STOP_STATUS_TIMEOUT_MS,
	TAILSCALE_SYSTEMCTL_PROBE_TIMEOUT_MS,
} from '../remote-access-tailscale.constants';
import {
	TailscaleNodeStopFailedException,
	TailscaleOperationCancelledException,
	TailscalePluginDisabledException,
	TailscaleRequirementUnsatisfiedException,
} from '../remote-access-tailscale.exceptions';

import { TailscaleCliError, TailscaleCliService, TailscaleStatus } from './tailscale-cli.service';
import { TailscaleOperation, TailscaleOperationCoordinatorService } from './tailscale-operation-coordinator.service';
import { TailscaleServeResult, TailscaleServeService } from './tailscale-serve.service';
import { TailscaleStatusMapperService } from './tailscale-status-mapper.service';

export type TailscaleAuthentication = 'unknown' | 'required' | 'authenticated';
export interface TailscaleControlState {
	enabled: boolean;
	serviceState: ServiceState;
	authentication: TailscaleAuthentication;
	operation: TailscaleOperation | null;
}

export interface TailscaleObservationMetadata {
	requirements: TailscaleRequirement[];
	control: TailscaleControlState;
}

export type TailscaleRequirementCode =
	| 'platform-supported'
	| 'binary-installed'
	| 'daemon-active'
	| 'operator-granted'
	| 'version-supported';

/**
 * Exact console commands (and/or a documentation link) that satisfy one
 * unsatisfied requirement on the detected system — D12's manual remedy
 * contract, first implemented here; every later provider plugin copies this
 * shape. `commands` is empty and `note` is a link when no exact command
 * applies (a non-apt system, or a platform this plugin cannot run on at
 * all).
 */
export interface TailscaleRequirementRemedy {
	commands: string[];
	note: string | null;
}

export interface TailscaleRequirement {
	code: TailscaleRequirementCode;
	satisfied: boolean;
	message: string;
	/** Always `null` when `satisfied` is `true`. */
	remedy: TailscaleRequirementRemedy | null;
}

/** One requirement before `attachRemedies()` fills in `remedy` — every private `evaluate*()` helper below returns this shape. */
type TailscaleRequirementBase = Omit<TailscaleRequirement, 'remedy'>;

/** Action checks may verify management capability; live status observations always use read-only checks. */
export type TailscaleRequirementRefreshReason =
	| 'start'
	| 'permission-denied'
	| 'setup-complete'
	| 'status-read'
	| 'periodic';

/** Timeout for the unprivileged `tailscale-setup.sh --print-plan` probe — a local file read and a few `echo`s, nowhere near this ceiling in practice. */
const TAILSCALE_PRINT_PLAN_TIMEOUT_MS = 2_000;

const OPERATOR_GRANTED_SATISFIED_MESSAGE = 'The smart-panel operator is granted.';

/** `platform-supported`'s remedy note — this plugin's own documentation, listing the Docker/Home Assistant alternatives. */
const TAILSCALE_DOCUMENTATION_URL = 'https://smart-panel.fastybird.com/docs';

/** `binary-installed`/`version-supported`'s remedy note when the script reports an unsupported (non-Debian-family) distribution — matches the link `tailscale-setup.sh` itself prints in that same case. */
const TAILSCALE_VENDOR_DOWNLOAD_URL = 'https://tailscale.com/download/linux';

/** Simple dotted-numeric version compare; non-numeric segments count as 0. */
export function compareTailscaleVersions(a: string, b: string): number {
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

const UNEVALUATED_MESSAGE = 'Not evaluated: the platform requirement is not satisfied.';

/**
 * Managed service `node` for the Tailscale remote-access provider plugin.
 *
 * Owns the actual runtime: prerequisite checks, applying preferences and
 * bringing the node up/down, and an adaptive-interval status poller that
 * emits `RemoteAccessModule.Provider.Status` only when the mapped status
 * actually changes. `TailscaleProviderService` (the `IRemoteAccessProvider`
 * registered with the remote-access module) delegates to `computeStatus()`
 * here rather than duplicating the CLI + mapper composition.
 *
 * Authentication flows live in TailscaleLoginService and share this
 * provider's operation coordinator with node and Serve mutations.
 * `start()` never authenticates a node that has never signed in — it only
 * reconnects a node that already holds a key. `stop()` never signs out.
 *
 * A stopped managed service reports `disconnected` with no endpoints/proxy
 * addresses regardless of what the daemon itself last reported — every
 * lifecycle transition (`start()`, `stop()`) emits `PROVIDER_STATUS`
 * immediately instead of waiting for the next poll tick (D2/D3).
 */
@Injectable()
export class TailscaleNodeManagedService extends BaseManagedExtensionService implements OnModuleDestroy {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
		'TailscaleNodeManagedService',
	);

	readonly owner = { kind: 'plugin', type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME } as const;
	readonly serviceId = 'node';
	readonly activationPolicy = 'owner-enabled' as const;

	private readonly observations = new RemoteAccessObservation<{
		status: RemoteAccessProviderStatus;
		raw: TailscaleStatus | null;
		requirements: TailscaleRequirement[];
	}>();
	private readonly requirementObservations = new RemoteAccessObservation<TailscaleRequirement[]>();
	private authentication: TailscaleAuthentication = 'unknown';
	private identity: Record<string, string | number | boolean | null> = {};
	private connectPromise: Promise<void> | null = null;
	private stopPromise: Promise<void> | null = null;
	private pollTimer: NodeJS.Timeout | null = null;
	private lastStatus: RemoteAccessProviderStatus | null = null;
	/** Set by `stop()` when the underlying `down` call fails with a non-tolerated outcome — read back by `computeStatus()` while `this.state === 'error'`. */
	private lastError: string | null = null;
	private pluginConfig: RemoteAccessTailscalePluginConfigModel | null = null;
	/** Desired tags awaiting a successful current node `up`; login/reset leave them pending for one conservative reapply. */
	private pendingAdvertiseTags: string | null = null;
	/** Cached `refreshRequirements()` snapshot — see `getRequirements()`/`refreshRequirements()`. */
	private requirementsCache: TailscaleRequirement[] | null = null;
	/** Set by `convergeServe()` while the last Serve/Funnel mutation attempt was denied — read back so the denial is logged, and `operator-granted` refreshed, only once per transition instead of on every call. */
	private lastServeConvergeDenied = false;
	/** Consecutive failed `attemptReconnect()` calls since the node last reported `connected` — drives the backoff `nextReconnectAttemptAt` uses. */
	private reconnectAttempts = 0;
	/** Earliest time `pollTick()` may call `attemptReconnect()` again — `0` means "due now". */
	private nextReconnectAttemptAt = 0;

	constructor(
		private readonly cli: TailscaleCliService,
		private readonly mapper: TailscaleStatusMapperService,
		private readonly configService: ConfigService,
		private readonly nestConfigService: NestConfigService,
		private readonly platformService: PlatformService,
		private readonly eventEmitter: EventEmitter2,
		private readonly serveService: TailscaleServeService,
		@Optional()
		private readonly operations: TailscaleOperationCoordinatorService = new TailscaleOperationCoordinatorService(),
	) {
		super();
		this.operations.onSettled((operation) => {
			// The poller's own convergence/reconnect keeps its adaptive timer.
			if (operation !== 'serve' && operation !== 'reconnect') {
				this.schedulePoll(0);
			}
		});
	}

	getOperationCoordinator(): TailscaleOperationCoordinatorService {
		return this.operations;
	}

	getControlState(): TailscaleControlState {
		return {
			enabled: this.isPluginEnabled(),
			serviceState: this.state,
			authentication: this.authentication,
			operation: this.operations.getOperation(),
		};
	}

	private isPluginEnabled(): boolean {
		try {
			return this.configService.getPluginConfig<RemoteAccessTailscalePluginConfigModel>(
				REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			).enabled;
		} catch {
			return false;
		}
	}

	clearAuthentication(): void {
		this.authentication = 'required';
		this.identity = {};
	}

	observeAuthentication(status: TailscaleStatus): void {
		if (status.BackendState === 'NeedsLogin') {
			this.clearAuthentication();
		} else if (['Running', 'Starting', 'Stopped', 'NeedsMachineAuth'].includes(status.BackendState)) {
			this.authentication = 'authenticated';
			this.identity = this.mapper.map(status, { port: this.getBackendPort() }).details;
		}
	}

	async onModuleDestroy(): Promise<void> {
		await this.stop();
	}

	async ensureSupervisorStartedForLogin(): Promise<void> {
		if (!this.isPluginEnabled()) {
			throw new TailscalePluginDisabledException();
		}
		if (this.state !== 'started') {
			await this.startNode(false);
		}
	}

	private assertRequirements(requirements: TailscaleRequirement[]): void {
		const failed = requirements.find((requirement) => !requirement.satisfied);
		if (failed) {
			throw new TailscaleRequirementUnsatisfiedException(failed);
		}
		if (requirements.length === 0) {
			throw new TailscaleCliError(
				'unknown',
				'Tailscale setup could not be verified. Re-check setup before connecting.',
			);
		}
	}

	async connect(): Promise<void> {
		if (!this.isPluginEnabled()) {
			throw new TailscalePluginDisabledException();
		}
		if (this.connectPromise !== null) {
			return this.connectPromise;
		}
		this.connectPromise = (
			this.state === 'started'
				? this.operations.run('connect', async (token) => {
						const config = this.getPluginConfig();
						const requirements = await this.refreshRequirements('start');
						this.operations.assertCurrent(token);
						this.assertRequirements(requirements);
						const status = await this.cli.getStatus();
						this.operations.assertCurrent(token);
						this.observeAuthentication(status);
						if (!this.mapper.hasExistingKey(status)) {
							throw new TailscaleCliError('needs-login', 'Sign in to Tailscale before connecting.');
						}
						if (this.mapper.map(status, { port: this.getBackendPort() }).state === 'connected') {
							return;
						}
						await this.applyNodePreferences(config);
						this.operations.assertCurrent(token);
						this.schedulePoll(0);
					})
				: this.startNode(true)
		).finally(() => {
			this.connectPromise = null;
		});
		return this.connectPromise;
	}

	async start(): Promise<void> {
		return this.startNode(false);
	}

	private async startNode(strict: boolean): Promise<void> {
		await this.operations.run('connect', async (token) => {
			if (this.state === 'started') {
				return;
			}

			this.state = 'starting';
			this.pluginConfig = null;
			// A fresh start cycle gets an immediate reconnect opportunity from
			// the poller rather than waiting out a backoff timer left over
			// from before this service was last stopped.
			this.reconnectAttempts = 0;
			this.nextReconnectAttemptAt = 0;
			// Cache the config unconditionally, even when a prerequisite is
			// missing or the node holds no key and neither set nor up ever
			// runs below — onConfigChanged()'s login_server diff needs a known
			// "previous" value, otherwise a later login_server change (once the
			// prerequisite clears) would go undetected.
			const config = this.getPluginConfig();
			this.pendingAdvertiseTags = config.advertiseTags.join(',');

			this.logger.log('Starting Tailscale node service');

			try {
				const requirements = await this.refreshRequirements('start');
				this.operations.assertCurrent(token);
				if (strict) {
					this.assertRequirements(requirements);
				}

				if (this.requirementsSatisfied(requirements)) {
					const status = await this.getStatusOrNull();
					this.operations.assertCurrent(token);
					if (status) {
						this.observeAuthentication(status);
					}

					if (status && this.mapper.hasExistingKey(status)) {
						await this.applyNodePreferences(config);
					}
				}
			} catch (error) {
				this.operations.assertCurrent(token);
				if (strict) {
					this.state = 'error';
					this.lastError = error instanceof Error ? error.message : 'Unknown Tailscale failure.';
					await this.emitStatus();
					throw error;
				}
				if (error instanceof TailscaleCliError && error.kind === 'permission-denied') {
					await this.refreshRequirements('permission-denied').catch(() => undefined);
				}

				this.logger.warn(
					'Failed to bring the Tailscale node up during start; the poller keeps reporting live status.',
					{
						message: error instanceof Error ? error.message : String(error),
					},
				);

				// Surface the failed start immediately instead of waiting for the
				// poller's first tick (schedulePoll(0) below) to report it —
				// emitStatus() itself never throws (computeStatus() never does),
				// but guard it anyway so a failure here can never mask the
				// original start() failure.
				await this.emitStatus().catch((emitError) => {
					this.logger.debug('Failed to emit status after a failed start', {
						message: emitError instanceof Error ? emitError.message : String(emitError),
					});
				});
			}

			this.operations.assertCurrent(token);
			this.state = 'started';
			this.lastError = null;
			this.schedulePoll(0);

			this.logger.log('Tailscale node service started');
		});
		if (strict && this.authentication !== 'authenticated') {
			throw new TailscaleCliError('needs-login', 'Sign in to Tailscale before connecting.');
		}
	}

	/**
	 * D3: `down()` succeeding, or failing with one of the tolerated "nothing
	 * to bring down" outcomes (`needs-login`, `daemon-down`, `not-installed`,
	 * or the backend already reporting `Stopped` regardless of why `down`
	 * itself failed), transitions to `stopped`. Any other failure
	 * (`permission-denied`, `timeout`, `unknown`, or a non-`TailscaleCliError`)
	 * transitions to `error`, records `lastError`, and throws
	 * `TailscaleNodeStopFailedException` — but only after `emitStatus()` has
	 * already reported that. Either way, `computeStatus()` (via
	 * `emitStatus()`) now reads `this.state` first (D2) and short-circuits to
	 * `disconnected`/`error` accordingly, instead of trusting whatever the
	 * daemon last reported.
	 */
	async stop(): Promise<void> {
		if (this.stopPromise !== null) {
			return this.stopPromise;
		}
		const shouldDown =
			this.state !== 'stopped' || this.operations.getOperation() !== null || this.operations.hasPendingChildren();
		this.state = 'stopping';
		this.observations.invalidate();
		this.requirementObservations.invalidate();
		this.clearPoll();
		this.stopPromise = this.operations
			.interrupt('disconnect', async (token) => {
				if (!shouldDown) {
					this.state = 'stopped';
					await this.emitStatus();
					return;
				}
				try {
					await this.cli.down();
					this.operations.assertCurrent(token);
					this.state = 'stopped';
				} catch (error) {
					this.operations.assertCurrent(token);
					const tolerated = await this.isStopFailureTolerated(error);
					this.operations.assertCurrent(token);
					if (!tolerated) {
						throw error;
					}
					this.state = 'stopped';
				}
				this.lastError = null;
				await this.emitStatus();
			})
			.catch(async (error: unknown) => {
				if (error instanceof TailscaleOperationCancelledException) {
					throw error;
				}
				this.state = 'error';
				this.lastError = error instanceof Error ? error.message : 'Unknown Tailscale failure.';
				await this.emitStatus();
				if (error instanceof Error && 'code' in error) {
					throw error;
				}
				throw new TailscaleNodeStopFailedException(this.lastError);
			})
			.finally(() => {
				this.stopPromise = null;
			});
		return this.stopPromise;
	}

	/**
	 * Whether a `down()` failure still counts as "stop achieved its goal".
	 * `needs-login`/`daemon-down`/`not-installed` mean there was nothing to
	 * bring down in the first place. Any other failure (including a
	 * non-`TailscaleCliError`) falls back to a live status read: if the
	 * backend already reports `Stopped` regardless of why `down` itself
	 * failed, the desired end state already holds. Only a genuine failure —
	 * the backend still running/reachable in some other state, or the status
	 * read itself failing — is left non-tolerated.
	 */
	private async isStopFailureTolerated(error: unknown): Promise<boolean> {
		if (
			error instanceof TailscaleCliError &&
			(error.kind === 'needs-login' || error.kind === 'daemon-down' || error.kind === 'not-installed')
		) {
			return true;
		}

		const status = await this.getStatusOrNullWithin(TAILSCALE_STOP_STATUS_TIMEOUT_MS);

		return status?.BackendState === 'Stopped';
	}

	/**
	 * A failed management command may leave the daemon in its desired state, so
	 * one read-back is useful for classifying an already-stopped node. During
	 * application shutdown that read-back must have its own finite bound: a
	 * wedged daemon cannot keep Nest's destruction hook waiting after `down()`
	 * has already failed. A timeout deliberately returns `null`, preserving the
	 * original failure and fail-closed quiescence semantics.
	 */
	private async getStatusOrNullWithin(timeoutMs: number): Promise<TailscaleStatus | null> {
		let timer: NodeJS.Timeout | undefined;

		try {
			return await Promise.race([
				this.getStatusOrNull(),
				new Promise<null>((resolve, reject) => {
					timer = setTimeout(() => {
						void this.operations.reapPendingChildren().then(() => resolve(null), reject);
					}, timeoutMs);
				}),
			]);
		} finally {
			if (timer) {
				clearTimeout(timer);
			}
		}
	}

	/** Computes the current status and pushes it as `PROVIDER_STATUS`, unconditionally (unlike the poller's own `pollTick()`, which only emits on change) — used by `stop()` (both outcomes) and by `start()` after a failed `set`/`up` call. */
	private async emitStatus(): Promise<void> {
		const generation = this.operations.getGeneration();
		const status =
			this.state === 'stopped' || this.state === 'stopping' || this.state === 'error'
				? this.buildStatus(
						this.state === 'error' ? 'error' : 'disconnected',
						this.lastError ?? 'The node service is stopped.',
						this.identity,
					)
				: await this.computeStatus();
		if (!this.operations.isCurrent(generation)) {
			return;
		}
		this.operations.assertCurrent();

		this.lastStatus = status;
		this.eventEmitter.emit(RemoteAccessEventType.PROVIDER_OBSERVATION, {
			status,
			metadata: { requirements: this.getRequirements(), control: this.getControlState() },
		});
	}

	async onConfigChanged(): Promise<ConfigChangeResult> {
		this.observations.invalidate();
		this.requirementObservations.invalidate();
		if (this.stopPromise !== null) {
			await this.stopPromise;
		}
		this.clearPoll();
		return this.operations.interrupt('config', async (token) => {
			let result: ConfigChangeResult;
			try {
				result = await this.applyConfigChange();
			} catch (error) {
				this.operations.assertCurrent(token);
				this.state = 'error';
				this.lastError = error instanceof Error ? error.message : 'Unknown Tailscale failure.';
				await this.emitStatus();
				throw error;
			}
			this.operations.assertCurrent(token);
			if (this.isPollable()) {
				this.schedulePoll(0);
			}
			return result;
		});
	}

	private async applyConfigChange(): Promise<ConfigChangeResult> {
		const previous = this.pluginConfig;
		this.pluginConfig = null;
		const next = this.getPluginConfig();
		if (this.pendingAdvertiseTags !== null || previous?.advertiseTags.join(',') !== next.advertiseTags.join(',')) {
			this.pendingAdvertiseTags = next.advertiseTags.join(',');
		}

		// `start()` always caches the config, so `previous` should never be
		// null here — but if it somehow is (config cleared or never cached),
		// treat the prior login_server as unknown and restart defensively
		// rather than risk silently missing a real change.
		if (!next.enabled) {
			this.state = 'stopping';
			try {
				await this.cli.down();
			} catch (error) {
				if (!(await this.isStopFailureTolerated(error))) {
					throw error;
				}
			}
			this.operations.assertCurrent();
			this.state = 'stopped';
			await this.emitStatus();
			return { restartRequired: false };
		}
		if (!previous || previous.loginServer !== next.loginServer) {
			this.logger.log('Tailscale login_server changed (or its prior value was unknown), restart required');

			// Sign the node out so it comes back requiring a fresh login against
			// the new control plane instead of silently keeping a key issued by
			// the old one. Only the kinds that mean "there was nothing to sign
			// out of" are tolerated (matching factoryReset() and
			// TailscaleLoginService.logout(), which apply the same rule to
			// their own logout calls) — a permission-denied, timeout or
			// unknown failure means the node may still hold a key issued by
			// the old control plane, so it must propagate instead of silently
			// reporting a restart as ready to proceed.
			try {
				await this.cli.logout();
			} catch (error) {
				if (
					error instanceof TailscaleCliError &&
					(error.kind === 'needs-login' || error.kind === 'not-installed' || error.kind === 'daemon-down')
				) {
					this.logger.debug('tailscale logout had nothing to sign out of while applying a login_server change', {
						kind: error.kind,
					});
				} else {
					throw error;
				}
			}

			this.operations.assertCurrent();
			this.clearAuthentication();
			return { restartRequired: true };
		}

		if (!this.isPollable()) {
			return { restartRequired: false };
		}
		try {
			// A config change is a rare, admin-triggered event (never the
			// poller), so a fresh evaluation here is cheap enough — reuses
			// the 'start' reason since both represent "about to apply
			// preferences, recheck gating first".
			const requirements = await this.refreshRequirements('start');

			if (this.requirementsSatisfied(requirements)) {
				let status = await this.getStatusOrNull();

				if (status && this.mapper.hasExistingKey(status)) {
					this.operations.assertCurrent();
					if (this.pendingAdvertiseTags !== null) {
						// Tags are supported by `up`, not `set`. Fresh prefs decide whether
						// they need flagged up and its settings-conflict check.
						await this.applyNodePreferences(next);
						this.operations.assertCurrent();
						status = await this.getStatusOrNull();
						this.operations.assertCurrent();
						if (status) {
							this.observeAuthentication(status);
						}
					} else {
						await this.cli.set(this.buildPreferenceFlags(next));
						this.operations.assertCurrent();
					}

					const port = this.getBackendPort();

					// Converged immediately here for a responsive config change,
					// rather than waiting for the next poll tick to pick it up
					// (pollTick() runs the same converge step, at most once per
					// tick, gated on requirements satisfied + connected).
					if (status && this.mapper.map(status, { port }).state === 'connected') {
						await this.convergeServe(next, port, status);
					}
				}
			}
		} catch (error) {
			this.operations.assertCurrent();
			if (error instanceof TailscaleCliError && error.kind === 'permission-denied') {
				await this.refreshRequirements('permission-denied').catch(() => undefined);
			}

			this.logger.warn('Failed to apply changed Tailscale preferences', {
				message: error instanceof Error ? error.message : String(error),
			});
		}

		return { restartRequired: false };
	}

	/**
	 * D3: healthy only when every requirement is satisfied (the cached
	 * `getRequirements()` snapshot — a live re-evaluation here would add an
	 * `operator-granted` probe to every health-check tick; the poller already
	 * updates that cache on every shared observation, see
	 * `refreshRequirements`'s own doc) AND the daemon backend itself reports
	 * `Running` with `Self.Online`.
	 */
	async isHealthy(): Promise<boolean> {
		const generation = this.operations.getGeneration();
		if (!this.isPollable()) {
			return false;
		}
		if (!this.requirementsSatisfied(this.getRequirements())) {
			return false;
		}

		try {
			const { raw: status } = await this.computeStatusWithRawStatus();

			return (
				this.isPollable() &&
				this.operations.isCurrent(generation) &&
				status?.BackendState === 'Running' &&
				status.Self?.Online === true
			);
		} catch {
			return false;
		}
	}

	/**
	 * Registered with `FactoryResetRegistryService` by the plugin module.
	 * `serve reset` is a thin, best-effort call — RA-6 owns the actual Serve
	 * configuration and this plugin never enables it, so failures here (e.g.
	 * nothing was ever served) are not a reset failure. Logging out with
	 * nothing to sign out of (not installed, never signed in) is treated the
	 * same way: the desired end state already holds.
	 */
	async factoryReset(): Promise<{ success: boolean; reason?: string }> {
		this.state = 'stopping';
		this.observations.invalidate();
		this.requirementObservations.invalidate();
		this.clearPoll();
		try {
			return await this.operations.interrupt('reset', async (token) => {
				await this.cli.down().catch((error: unknown) =>
					this.isStopFailureTolerated(error).then((safe) => {
						if (!safe) {
							throw error;
						}
					}),
				);
				this.operations.assertCurrent(token);
				await this.cli.serveReset().catch(() => undefined);
				this.operations.assertCurrent(token);
				await this.cli.logout().catch((error: unknown) => {
					if (
						!(
							error instanceof TailscaleCliError && ['not-installed', 'needs-login', 'daemon-down'].includes(error.kind)
						)
					) {
						throw error;
					}
				});
				this.operations.assertCurrent(token);
				this.clearAuthentication();
				this.state = 'stopped';
				await this.emitStatus();
				return { success: true };
			});
		} catch (error) {
			if (!(error instanceof TailscaleOperationCancelledException)) {
				this.state = 'error';
				this.lastError = error instanceof Error ? error.message : 'Unknown error';
				await this.emitStatus();
			}
			return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
		}
	}

	/**
	 * Explicit setup verification alias. Status controllers consume getStatusSnapshot(),
	 * whose requirement checks cannot initiate capability mutations.
	 */
	async evaluateRequirements(): Promise<TailscaleRequirement[]> {
		return this.refreshRequirements('setup-complete');
	}

	/** Setup may reconcile only if no later operator action superseded the accepted job. */
	async reconcileSetup(generation: number): Promise<void> {
		if (!this.operations.isCurrent(generation) || !this.getControlState().enabled) {
			return;
		}
		await this.operations.run('config', async (token) => {
			this.operations.assertCurrent(token);
			if (!this.operations.isCurrent(generation)) {
				return;
			}
			if (this.state !== 'started') {
				await this.startNode(false);
			} else {
				const status = await this.cli.getStatus();
				this.operations.assertCurrent(token);
				this.observeAuthentication(status);
				if (this.mapper.hasExistingKey(status)) {
					await this.applyNodePreferences(this.getPluginConfig());
					this.operations.assertCurrent(token);
				}
				this.schedulePoll(0);
			}
		});
	}

	/**
	 * Cached snapshot from the last `refreshRequirements()` call — never
	 * `null`/empty after `start()` has run once (`start()` always calls
	 * `refreshRequirements('start')` before completing, regardless of
	 * whether every requirement turns out satisfied). Returns an empty array
	 * if read before that, which `requirementsSatisfied()` treats the same
	 * as "not ready" rather than vacuously true.
	 */
	getRequirements(): TailscaleRequirement[] {
		return this.requirementsCache ?? [];
	}

	/** Coalesces read-only prerequisite checks. Explicit action/setup checks retain the capability probe. */
	async refreshRequirements(
		reason: TailscaleRequirementRefreshReason,
		signal?: AbortSignal,
	): Promise<TailscaleRequirement[]> {
		const generation = this.operations.getGeneration();
		const readOnly = reason === 'periodic' || reason === 'status-read';
		const requirements = await (readOnly
			? this.requirementObservations.run(
					(readSignal) => this.evaluateRequirementsLive(generation, false, readSignal),
					signal,
				)
			: this.evaluateRequirementsLive(generation, true, signal));
		signal?.throwIfAborted();
		if (!this.operations.isCurrent(generation)) {
			return this.getRequirements();
		}

		this.requirementsCache = requirements;

		return requirements;
	}

	/** `true` only when the list is non-empty and every requirement is satisfied — an empty (never-evaluated) list is treated as "not ready", not vacuously true. */
	private requirementsSatisfied(requirements: TailscaleRequirement[]): boolean {
		return requirements.length > 0 && requirements.every((requirement) => requirement.satisfied);
	}

	/** The actual, always-live evaluation — reached only through `refreshRequirements()`, which owns the cache and coalesces read-only checks. */
	private async evaluateRequirementsLive(
		generation: number,
		allowProbe = false,
		signal?: AbortSignal,
	): Promise<TailscaleRequirement[]> {
		const platform = await this.evaluatePlatformSupported();
		signal?.throwIfAborted();
		if (!this.operations.isCurrent(generation)) {
			return this.getRequirements();
		}

		if (!platform.satisfied) {
			// The other four are not actually evaluated when the platform
			// itself is unsupported (UNEVALUATED_MESSAGE) — showing a remedy
			// for them would be misleading (there is nothing to fix there yet);
			// only platform-supported's own remedy is real.
			return [
				await this.finalizeRequirement(platform),
				this.unevaluatedRequirement('binary-installed'),
				this.unevaluatedRequirement('daemon-active'),
				this.unevaluatedRequirement('operator-granted'),
				this.unevaluatedRequirement('version-supported'),
			];
		}

		// Wait for every read to close before releasing the prerequisite slot. A rejected
		// sibling must not permit replacement observations while another child is still alive.
		const results = await Promise.allSettled([
			this.evaluateBinaryAndVersion(signal),
			this.evaluateDaemonActive(signal),
			this.evaluateOperatorGranted(generation, allowProbe, signal),
		]);
		signal?.throwIfAborted();
		const [binaryResult, daemonResult, operatorResult] = results;
		if (binaryResult.status === 'rejected') {
			throw binaryResult.reason;
		}
		if (daemonResult.status === 'rejected') {
			throw daemonResult.reason;
		}
		if (operatorResult.status === 'rejected') {
			throw operatorResult.reason;
		}
		const { binary, version } = binaryResult.value;
		const daemonActive = daemonResult.value;
		const operatorGranted = operatorResult.value;

		return this.attachRemedies([platform, binary, daemonActive, operatorGranted, version], signal);
	}

	private unevaluatedRequirement(code: TailscaleRequirementCode): TailscaleRequirement {
		return { code, satisfied: false, message: UNEVALUATED_MESSAGE, remedy: null };
	}

	/** Attaches `remedy` to each requirement: `null` when satisfied (D12: "remedy is null when the requirement is satisfied"), otherwise the manual remedy for its code. */
	private async attachRemedies(
		requirements: TailscaleRequirementBase[],
		signal?: AbortSignal,
	): Promise<TailscaleRequirement[]> {
		// Memoized as a shared *promise* (not just the resolved value) so
		// `binary-installed` and `version-supported` — both unsatisfied
		// together on a freshly detected missing install, and both mapped to
		// this same script call — never spawn `tailscale-setup.sh
		// --print-plan` twice for the one request evaluating them
		// concurrently below.
		let installRemedyPromise: Promise<TailscaleRequirementRemedy> | null = null;

		const getInstallRemedy = (): Promise<TailscaleRequirementRemedy> => {
			installRemedyPromise ??= this.buildInstallRemedy(signal);

			return installRemedyPromise;
		};

		return Promise.all(requirements.map((requirement) => this.finalizeRequirement(requirement, getInstallRemedy)));
	}

	private async finalizeRequirement(
		requirement: TailscaleRequirementBase,
		getInstallRemedy?: () => Promise<TailscaleRequirementRemedy>,
	): Promise<TailscaleRequirement> {
		if (requirement.satisfied) {
			return { ...requirement, remedy: null };
		}

		const remedy =
			getInstallRemedy && (requirement.code === 'binary-installed' || requirement.code === 'version-supported')
				? await getInstallRemedy()
				: await this.buildRemedy(requirement.code);

		return { ...requirement, remedy };
	}

	/**
	 * D12's manual remedy contract for one requirement code, for the codes
	 * whose command never depends on the detected script output —
	 * `daemon-active`/`operator-granted` are plain one-line systemd/tailscale
	 * commands that never vary by distro, and `platform-supported` has no
	 * command at all (Docker and the Home Assistant add-on cannot run a mesh
	 * client no matter what is typed into their console). `binary-installed`/
	 * `version-supported` go through `buildInstallRemedy()` instead — see
	 * `finalizeRequirement()`, the only caller of this method for those two
	 * codes.
	 */
	private async buildRemedy(code: TailscaleRequirementCode): Promise<TailscaleRequirementRemedy> {
		const serviceUser = os.userInfo().username;

		switch (code) {
			case 'binary-installed':
			case 'version-supported':
				return this.buildInstallRemedy();
			case 'daemon-active':
				return { commands: ['sudo systemctl enable --now tailscaled'], note: null };
			case 'operator-granted':
				return { commands: [`sudo tailscale set --operator=${serviceUser}`], note: null };
			case 'platform-supported':
			default:
				return { commands: [], note: TAILSCALE_DOCUMENTATION_URL };
		}
	}

	/**
	 * Runs the plugin's own setup script in its unprivileged `--print-plan`
	 * mode to get the exact commands the privileged install step would run
	 * on this distro (see the script's own header doc). Never throws: a
	 * missing script, a non-zero exit, a timeout or empty output (an
	 * unsupported distribution — the script's own `--print-plan` signal for
	 * that case) all fall back to the vendor download link instead.
	 */
	private async buildInstallRemedy(signal?: AbortSignal): Promise<TailscaleRequirementRemedy> {
		try {
			const stdout = await this.runSetupScriptPrintPlan(signal);
			const lines = stdout
				.split('\n')
				.map((line) => line.trim())
				.filter((line) => line.length > 0);

			if (lines.length === 0) {
				return { commands: [], note: TAILSCALE_VENDOR_DOWNLOAD_URL };
			}

			// A line containing a pipe already carries its own `sudo` on the privileged
			// segment (e.g. `curl ... | sudo tee <path>`) - prefixing the whole line would
			// elevate only the left-hand command and leave the actual write unprivileged.
			return {
				commands: lines.map((line) => (line.includes('|') ? line : `sudo ${line}`)),
				note: null,
			};
		} catch (error) {
			this.logger.debug('Failed to build the install remedy from tailscale-setup.sh --print-plan', {
				message: error instanceof Error ? error.message : String(error),
			});

			return { commands: [], note: TAILSCALE_VENDOR_DOWNLOAD_URL };
		}
	}

	private async runSetupScriptPrintPlan(signal?: AbortSignal): Promise<string> {
		const script = join(__dirname, '..', 'scripts', 'tailscale-setup.sh');
		return (
			await cancellableExecFile(
				'bash',
				[script, '--print-plan', '--step=install'],
				signal,
				TAILSCALE_PRINT_PLAN_TIMEOUT_MS,
			)
		).stdout;
	}

	/**
	 * Live status merged with the platform requirement, used by both the
	 * poller and `TailscaleProviderService.getStatus()` (hence every GET
	 * status endpoint). Never throws — CLI failures are classified into
	 * `not-installed` / `setup-required` / `error` states instead. Never
	 * mutates: Serve/Funnel state is read via `TailscaleServeService.read()`
	 * only — a GET must not converge anything. Converging is `pollTick()`'s
	 * and `onConfigChanged()`'s job, not this method's (see their own docs).
	 *
	 * D2: reads this managed service's own lifecycle state (`this.state`)
	 * first and short-circuits on it — a `tailscaled` daemon that is still
	 * technically up (or a stale cached CLI response) must never override
	 * "this service was stopped/errored" once the admin has acted. `stopped`/
	 * `stopping` always report `disconnected` with no endpoints/proxy
	 * addresses, regardless of what `status --json` currently claims;
	 * `error` reports the `lastError` `stop()` recorded. Prerequisite reads remain
	 * available while stopped so manually prepared installations can be discovered.
	 *
	 * Every observation includes fresh read-only prerequisites. REST and poll callers
	 * share one in-flight observation; neither initiates an operator write probe.
	 */
	async computeStatus(
		_requirementsReason: TailscaleRequirementRefreshReason = 'status-read',
		options?: { signal?: AbortSignal; fresh?: boolean },
	): Promise<RemoteAccessProviderStatus> {
		return (await this.computeStatusWithRawStatus(options)).status;
	}

	async awaitObservationIdle(): Promise<void> {
		await Promise.all([this.observations.awaitIdle(), this.requirementObservations.awaitIdle()]);
	}

	async getStatusSnapshot(options?: { signal?: AbortSignal; fresh?: boolean }): Promise<{
		status: RemoteAccessProviderStatus;
		metadata: TailscaleObservationMetadata;
	}> {
		const observation = await this.computeStatusWithRawStatus(options);
		return {
			status: observation.status,
			metadata: { requirements: observation.requirements, control: this.getControlState() },
		};
	}

	private async computeStatusWithRawStatus(options?: { signal?: AbortSignal; fresh?: boolean }): Promise<{
		status: RemoteAccessProviderStatus;
		raw: TailscaleStatus | null;
		requirements: TailscaleRequirement[];
	}> {
		const generation = this.operations.getGeneration();
		const revision = this.operations.getObservationRevision();
		try {
			const result = await this.observations.run(async (signal) => {
				const requirements = await this.refreshRequirements('status-read', signal);
				const collected = await this.collectStatusWithRawStatus(generation, signal, requirements);
				signal.throwIfAborted();
				return { ...collected, requirements };
			}, options?.signal);
			if (!this.operations.isCurrent(generation) || !this.operations.isObservationCurrent(revision)) {
				return this.supersededObservation();
			}
			if (result.raw && this.isPollable()) {
				this.observeAuthentication(result.raw);
			}
			return result;
		} catch (error) {
			if (
				!this.operations.isCurrent(generation) ||
				!this.operations.isObservationCurrent(revision) ||
				!this.isPollable()
			) {
				return this.supersededObservation();
			}
			return {
				status: this.buildStatus('error', error instanceof Error ? error.message : 'The status observation failed.'),
				raw: null,
				requirements: this.getRequirements(),
			};
		}
	}

	private supersededObservation(): {
		status: RemoteAccessProviderStatus;
		raw: null;
		requirements: TailscaleRequirement[];
	} {
		return {
			status: this.buildStatus(
				this.state === 'error' ? 'error' : 'disconnected',
				this.lastError ?? 'The observation was superseded by a lifecycle action.',
			),
			raw: null,
			requirements: this.getRequirements(),
		};
	}

	private async collectStatusWithRawStatus(
		generation = this.operations.getGeneration(),
		signal?: AbortSignal,
		requirements: TailscaleRequirement[] = this.getRequirements(),
	): Promise<{
		status: RemoteAccessProviderStatus;
		raw: TailscaleStatus | null;
	}> {
		if (this.state === 'stopped' || this.state === 'stopping') {
			return { status: this.buildStatus('disconnected', 'The node service is stopped.', this.identity), raw: null };
		}

		if (this.state === 'error') {
			return { status: this.buildStatus('error', this.lastError ?? 'The Tailscale node service failed.'), raw: null };
		}

		const platform = requirements.find((requirement) => requirement.code === 'platform-supported') ?? {
			satisfied: false,
			message: 'Platform detection did not complete.',
		};
		signal?.throwIfAborted();
		if (!this.operations.isCurrent(generation)) {
			return {
				status: this.buildStatus(
					'disconnected',
					'The observation was superseded by a lifecycle action.',
					this.identity,
				),
				raw: null,
			};
		}

		if (!platform.satisfied) {
			return { status: this.buildStatus('unsupported', platform.message), raw: null };
		}

		try {
			const status = await this.cli.getStatus(signal);
			signal?.throwIfAborted();
			if (!this.operations.isCurrent(generation)) {
				return {
					status: this.buildStatus(
						'disconnected',
						'The observation was superseded by a lifecycle action.',
						this.identity,
					),
					raw: null,
				};
			}
			const port = this.getBackendPort();
			const postureAdvisories = this.buildPostureAdvisories(status);

			signal?.throwIfAborted();
			if (!this.operations.isCurrent(generation)) {
				return {
					status: this.buildStatus(
						'disconnected',
						'The observation was superseded by a lifecycle action.',
						this.identity,
					),
					raw: null,
				};
			}
			const operatorRequirement = requirements.find((requirement) => requirement.code === 'operator-granted');

			if (operatorRequirement && !operatorRequirement.satisfied) {
				// The smart-panel user was never granted as the tailscaled
				// operator: every write (`set`/`up`/`serve`) fails
				// permission-denied even though the read-only call above just
				// succeeded and may report Running. Report setup-required
				// instead of trusting BackendState, and skip reading Serve/Funnel
				// below entirely — it would only report a drifted/absent handler
				// this plugin cannot fix anyway.
				return {
					status: this.buildStatus(
						'setup-required',
						operatorRequirement.message,
						{},
						[],
						[],
						[
							...postureAdvisories,
							{ code: 'operator-not-granted', severity: 'critical', message: operatorRequirement.message },
						],
					),
					raw: status,
				};
			}

			const mapped = this.mapper.map(status, { port });

			if (mapped.state !== 'connected') {
				return {
					status: this.buildStatus(
						mapped.state,
						mapped.message,
						mapped.details,
						mapped.proxyAddresses,
						mapped.endpoints,
						postureAdvisories,
					),
					raw: status,
				};
			}

			// Serve/Funnel are only meaningful once connected — `Self.CapMap`
			// (the ACL capabilities `read()`/`converge()` gate on) is only
			// populated then. `read()` never mutates; never more than once per
			// call, called by every status read (the poller's tick included).
			const config = this.getPluginConfig();
			const serveResult = await this.serveService.read(config, port, status, signal);

			return {
				status: this.buildStatus(
					mapped.state,
					mapped.message,
					mapped.details,
					[...mapped.proxyAddresses, ...serveResult.proxyAddresses],
					[...mapped.endpoints, ...serveResult.endpoints],
					[...postureAdvisories, ...serveResult.advisories],
				),
				raw: status,
			};
		} catch (error) {
			if (error instanceof TailscaleCliError) {
				switch (error.kind) {
					case 'not-installed':
						return { status: this.buildStatus('not-installed', 'Tailscale is not installed.'), raw: null };
					case 'permission-denied':
						return {
							status: this.buildStatus(
								'setup-required',
								'The smart-panel operator has not been granted on tailscaled.',
							),
							raw: null,
						};
					case 'daemon-down':
						return { status: this.buildStatus('setup-required', 'The Tailscale daemon is not running.'), raw: null };
					default:
						return { status: this.buildStatus('error', 'Failed to retrieve the Tailscale status.'), raw: null };
				}
			}

			throw error;
		}
	}

	/**
	 * The only place `TailscaleServeService.converge()` is called from — at
	 * most one Serve/Funnel mutation, gated by the caller (`pollTick()`:
	 * once per tick, only while healthy; `onConfigChanged()`: immediately,
	 * unconditionally once connected). Centralised here so both call sites
	 * share the same `permission-denied` handling: refreshing the
	 * `operator-granted` requirement and logging the denial, both only once
	 * per state transition — not on every call while the grant stays
	 * revoked, which is what produced the original per-tick warning spam.
	 */
	private async convergeServe(
		config: RemoteAccessTailscalePluginConfigModel,
		port: number,
		status: TailscaleStatus,
	): Promise<TailscaleServeResult> {
		const result = await this.operations.run(
			'serve',
			async (token) => {
				const converged = await this.serveService.converge(config, port, status);
				this.operations.assertCurrent(token);
				return converged;
			},
			// Routine Serve reconciliation does not change lifecycle or authentication.
			// Keep ownership/cancellation without invalidating concurrent status reads.
			false,
		);

		if (result.permissionDenied) {
			if (!this.lastServeConvergeDenied) {
				this.lastServeConvergeDenied = true;

				this.logger.warn(
					'Tailscale Serve/Funnel mutation was denied — the smart-panel operator grant may have been revoked.',
				);

				await this.refreshRequirements('permission-denied').catch(() => undefined);
			}
		} else {
			this.lastServeConvergeDenied = false;
		}

		return result;
	}

	// ─── Requirements ─────────────────────────────────────────────────

	/**
	 * Awaits `PlatformService`'s own detection promise before reading the
	 * platform type — called right after boot (the poller's first tick,
	 * `start()`), `platformType` can still be `undefined` if this read
	 * `PlatformService.getPlatformType()` synchronously, which would
	 * misreport `unsupported` with a message naming the `'undefined'`
	 * platform. `getPlatformTypeAsync()` resolves only once detection has
	 * actually settled, so this never happens.
	 */
	private async evaluatePlatformSupported(): Promise<TailscaleRequirementBase> {
		const platformType = await this.platformService.getPlatformTypeAsync();

		if (platformType === PlatformType.RASPBERRY || platformType === PlatformType.GENERIC) {
			return { code: 'platform-supported', satisfied: true, message: `Platform '${platformType}' is supported.` };
		}

		if (platformType === PlatformType.DEVELOPMENT) {
			const allowDev = getEnvValue<boolean>(this.nestConfigService, REMOTE_ACCESS_TAILSCALE_ALLOW_DEV_ENV, false);

			if (allowDev) {
				return {
					code: 'platform-supported',
					satisfied: true,
					message: `Platform 'development' is allowed via ${REMOTE_ACCESS_TAILSCALE_ALLOW_DEV_ENV}=true.`,
				};
			}

			return {
				code: 'platform-supported',
				satisfied: false,
				message: `Set ${REMOTE_ACCESS_TAILSCALE_ALLOW_DEV_ENV}=true to use Tailscale on the development platform.`,
			};
		}

		return {
			code: 'platform-supported',
			satisfied: false,
			message: `Tailscale is not supported on the '${platformType}' platform.`,
		};
	}

	private async evaluateBinaryAndVersion(signal?: AbortSignal): Promise<{
		binary: TailscaleRequirementBase;
		version: TailscaleRequirementBase;
	}> {
		try {
			const info = await this.cli.getVersion(signal);
			const supported = compareTailscaleVersions(info.version, TAILSCALE_MIN_VERSION) >= 0;

			return {
				binary: { code: 'binary-installed', satisfied: true, message: `Tailscale ${info.version} is installed.` },
				version: {
					code: 'version-supported',
					satisfied: supported,
					message: supported
						? `Tailscale ${info.version} meets the minimum supported version ${TAILSCALE_MIN_VERSION}.`
						: `Tailscale ${info.version} is older than the minimum supported version ${TAILSCALE_MIN_VERSION}.`,
				},
			};
		} catch (error) {
			const notInstalled = error instanceof TailscaleCliError && error.kind === 'not-installed';

			return {
				binary: {
					code: 'binary-installed',
					satisfied: false,
					message: notInstalled ? 'Tailscale is not installed.' : 'Failed to determine whether Tailscale is installed.',
				},
				version: {
					code: 'version-supported',
					satisfied: false,
					message: 'Cannot verify the Tailscale version before it is installed.',
				},
			};
		}
	}

	private async evaluateDaemonActive(signal?: AbortSignal): Promise<TailscaleRequirementBase> {
		const active = await this.isSystemdUnitActive('tailscaled', signal);

		return {
			code: 'daemon-active',
			satisfied: active,
			message: active ? 'tailscaled is active.' : 'tailscaled is not active. Run setup or start the service.',
		};
	}

	/**
	 * D1: verifies the operator grant via `tailscale debug prefs`
	 * (`OperatorUser === os.userInfo().username`) instead of trusting
	 * `status --json` succeeding — that call is read-only and succeeds for
	 * every local user regardless of the operator grant
	 * (`ipnauth.IsReadonlyConn` upstream), which is exactly the false
	 * positive this check exists to close. `debug` is an unstable namespace
	 * across Tailscale releases, so a command that fails outright or whose
	 * output cannot be parsed, explicit actions fall back to an idempotent write probe
	 * (`tailscale set --operator=<user>`) instead: harmless for the current
	 * operator, `permission-denied` for anyone else.
	 */
	private async evaluateOperatorGranted(
		generation = this.operations.getGeneration(),
		allowProbe = false,
		signal?: AbortSignal,
	): Promise<TailscaleRequirementBase> {
		const serviceUser = os.userInfo().username;

		try {
			const prefs = await this.cli.getPrefs(signal);

			return this.buildOperatorRequirement(prefs.OperatorUser === serviceUser, serviceUser);
		} catch (error) {
			if (!this.operations.isCurrent(generation)) {
				return { code: 'operator-granted', satisfied: false, message: 'The requirement observation was superseded.' };
			}
			if (error instanceof TailscaleCliError) {
				if (error.kind === 'daemon-down') {
					return {
						code: 'operator-granted',
						satisfied: false,
						message: 'Cannot verify the operator grant while tailscaled is not running.',
					};
				}

				if (error.kind === 'not-installed') {
					return {
						code: 'operator-granted',
						satisfied: false,
						message: 'Cannot verify the operator grant before Tailscale is installed.',
					};
				}
			}

			// `debug prefs` is unavailable on this Tailscale release, or its
			// output could not be parsed — fall back to the write probe,
			// which is authoritative either way.
			if (!allowProbe) {
				const verified = this.getRequirements().find((requirement) => requirement.code === 'operator-granted');
				return verified?.satisfied
					? verified
					: {
							code: 'operator-granted',
							satisfied: false,
							message:
								'The operator grant cannot be verified by this Tailscale version. Run Set up or Connect to verify management access.',
						};
			}
			return this.evaluateOperatorGrantedViaProbe(serviceUser);
		}
	}

	private async evaluateOperatorGrantedViaProbe(serviceUser: string): Promise<TailscaleRequirementBase> {
		try {
			// The same-value capability probe cannot change auth or transport;
			// it still owns a mutation slot and remains generation-cancellable.
			await this.operations.run('preferences', async () => this.cli.set([`--operator=${serviceUser}`]), false);

			return this.buildOperatorRequirement(true, serviceUser);
		} catch (error) {
			if (error instanceof TailscaleCliError) {
				if (error.kind === 'permission-denied') {
					return this.buildOperatorRequirement(false, serviceUser);
				}

				if (error.kind === 'daemon-down') {
					return {
						code: 'operator-granted',
						satisfied: false,
						message: 'Cannot verify the operator grant while tailscaled is not running.',
					};
				}

				if (error.kind === 'not-installed') {
					return {
						code: 'operator-granted',
						satisfied: false,
						message: 'Cannot verify the operator grant before Tailscale is installed.',
					};
				}
			}

			return { code: 'operator-granted', satisfied: false, message: 'Failed to verify the operator grant.' };
		}
	}

	private buildOperatorRequirement(satisfied: boolean, serviceUser: string): TailscaleRequirementBase {
		return {
			code: 'operator-granted',
			satisfied,
			message: satisfied
				? OPERATOR_GRANTED_SATISFIED_MESSAGE
				: `The ${serviceUser} user is not the tailscaled operator. Run Set up, or on the device run \`sudo tailscale set --operator=${serviceUser}\`.`,
		};
	}

	/** Live status, or null when the CLI call fails for any reason (used to gate preference/up calls, never surfaced as an error). */
	private async getStatusOrNull(): Promise<TailscaleStatus | null> {
		try {
			return await this.cli.getStatus();
		} catch {
			return null;
		}
	}

	private async isSystemdUnitActive(unit: string, signal?: AbortSignal): Promise<boolean> {
		try {
			const result = await cancellableExecFile(
				'systemctl',
				['is-active', unit],
				signal,
				TAILSCALE_SYSTEMCTL_PROBE_TIMEOUT_MS,
			);
			return result.exitCode === 0 && result.stdout.trim() === 'active';
		} catch {
			signal?.throwIfAborted();
			return false;
		}
	}

	// ─── Poller ───────────────────────────────────────────────────────

	/**
	 * True while the service is starting up or fully started — the only
	 * states in which the poller is allowed to hold a timer or emit.
	 * `pollTick()` reads outside a mutation owner (it is a `setTimeout` callback) so a tick whose
	 * `computeStatus()` was already in flight when `stop()` ran must not
	 * revive the poller or emit once it resolves; checking this before both
	 * the emit and the reschedule closes that race.
	 */
	private isPollable(): boolean {
		return this.state === 'starting' || this.state === 'started';
	}

	private schedulePoll(delayMs: number): void {
		this.clearPoll();

		if (!this.isPollable()) {
			return;
		}

		this.pollTimer = setTimeout(() => {
			this.operations.withoutOperation(() => void this.pollTick());
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
	 * Reads the live status exactly once (`computeStatusWithRawStatus()`,
	 * shared with `computeStatus()`), then — only while `getRequirements()`
	 * reports every requirement satisfied and the mapped state is
	 * `connected` — converges Serve/Funnel at most once via `convergeServe()`.
	 * A degraded node (an unsatisfied requirement, or not connected) never
	 * attempts a Serve/Funnel mutation; there is nothing for it to converge
	 * towards until the node itself is healthy again. `raw` is guaranteed
	 * non-null whenever `status.state === 'connected'` (both come from the
	 * same live branch of `computeStatusWithRawStatus()`) — the null check
	 * here is only for the type checker.
	 */
	private async pollTick(): Promise<void> {
		const generation = this.operations.getGeneration();
		let revision = this.operations.getObservationRevision();
		try {
			let { status, raw, requirements } = await this.computeStatusWithRawStatus();

			if (
				!this.isPollable() ||
				!this.operations.isCurrent(generation) ||
				!this.operations.isObservationCurrent(revision)
			) {
				// stop() ran while this tick's computeStatus() was in flight.
				return;
			}

			if (status.state === 'connected') {
				// Reset on every connected tick, not only inside attemptReconnect()'s own
				// success path — the node can also reach `connected` through a route that
				// never went through attemptReconnect() at all (e.g. onConfigChanged()'s own
				// reconnect, or simply never having disconnected this tick). Without this, a
				// later disconnect would reuse whatever backoff a previous, unrelated outage
				// left behind instead of starting fresh at the base delay.
				this.reconnectAttempts = 0;
				this.nextReconnectAttemptAt = 0;
			}

			if (
				status.state === 'disconnected' &&
				raw &&
				this.mapper.hasExistingKey(raw) &&
				this.requirementsSatisfied(this.getRequirements()) &&
				Date.now() >= this.nextReconnectAttemptAt
			) {
				const reconnected = await this.attemptReconnect();
				revision = this.operations.getObservationRevision();

				if (!this.isPollable() || !this.operations.isCurrent(generation)) {
					// stop() revoked this reconnect operation.
					return;
				}

				if (reconnected) {
					({ status, raw, requirements } = await this.computeStatusWithRawStatus());

					if (!this.isPollable() || !this.operations.isCurrent(generation)) {
						return;
					}
				}
			}

			if (
				!this.isPollable() ||
				!this.operations.isCurrent(generation) ||
				!this.operations.isObservationCurrent(revision)
			) {
				return;
			}
			if (this.hasStatusChanged(this.lastStatus, status)) {
				this.lastStatus = status;
				this.eventEmitter.emit(RemoteAccessEventType.PROVIDER_OBSERVATION, {
					status,
					metadata: { requirements, control: this.getControlState() },
				});
			}

			if (raw && status.state === 'connected' && this.requirementsSatisfied(this.getRequirements())) {
				await this.convergeServe(this.getPluginConfig(), this.getBackendPort(), raw);
			}

			if (!this.isPollable() || !this.operations.isCurrent(generation)) {
				return;
			}

			this.schedulePoll(
				status.state === 'connecting' ? TAILSCALE_POLL_INTERVAL_TRANSITIONING_MS : TAILSCALE_POLL_INTERVAL_STABLE_MS,
			);
		} catch (error) {
			if (!this.isPollable() || !this.operations.isCurrent(generation)) {
				return;
			}

			this.logger.error('Tailscale status poll failed', {
				message: error instanceof Error ? error.message : String(error),
			});

			this.schedulePoll(TAILSCALE_POLL_INTERVAL_STABLE_MS);
		}
	}

	/**
	 * Retries an unexpectedly stopped authenticated node with bounded backoff.
	 * The provider coordinator owns the set/up sequence; stop revokes it
	 * immediately, so a cancelled reconnect cannot continue or delay stop.
	 */
	private async attemptReconnect(): Promise<boolean> {
		return this.operations.run('reconnect', async (token) => {
			if (this.state !== 'started') {
				// stop() (or a fresh start() cycle) already changed things
				// while this call waited for the lock — nothing to reconnect.
				return false;
			}

			try {
				const config = this.getPluginConfig();

				await this.applyNodePreferences(config);
				this.operations.assertCurrent(token);

				this.reconnectAttempts = 0;
				this.nextReconnectAttemptAt = 0;

				this.logger.log('Tailscale node reconnected automatically after being found unexpectedly disconnected.');

				return true;
			} catch (error) {
				this.operations.assertCurrent(token);
				this.reconnectAttempts += 1;

				const delayMs = Math.min(
					TAILSCALE_RECONNECT_BASE_DELAY_MS * 2 ** (this.reconnectAttempts - 1),
					TAILSCALE_RECONNECT_MAX_DELAY_MS,
				);

				this.nextReconnectAttemptAt = Date.now() + delayMs;

				if (error instanceof TailscaleCliError && error.kind === 'permission-denied') {
					await this.refreshRequirements('permission-denied').catch(() => undefined);
				}

				this.logger.warn('Automatic Tailscale reconnect attempt failed; will retry with backoff.', {
					attempt: this.reconnectAttempts,
					nextAttemptInMs: delayMs,
					message: error instanceof Error ? error.message : String(error),
				});

				return false;
			}
		});
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

	// ─── Preferences ──────────────────────────────────────────────────

	private async applyNodePreferences(config: RemoteAccessTailscalePluginConfigModel): Promise<void> {
		this.operations.assertCurrent();
		const tags = config.advertiseTags.join(',');
		this.pendingAdvertiseTags = tags;
		await this.cli.set(this.buildPreferenceFlags(config));
		this.operations.assertCurrent();
		const upOnlyPreferencesMatch = await this.upOnlyPreferencesMatch(config);
		this.operations.assertCurrent();
		// Flagless up preserves every existing preference, including unmanaged
		// settings that a flagged up would refuse to omit. Changed or unknown
		// up-only settings still need the full flags and Tailscale's safety check.
		await this.cli.up(upOnlyPreferencesMatch ? [] : this.buildUpFlags(config));
		this.operations.assertCurrent();
		if (this.pendingAdvertiseTags === tags) {
			this.pendingAdvertiseTags = null;
		}
	}

	private async upOnlyPreferencesMatch(config: RemoteAccessTailscalePluginConfigModel): Promise<boolean> {
		try {
			// Read after set, rather than using the prerequisite observation, so
			// the reconnect decision uses fresh preferences owned by this operation.
			const prefs = await this.cli.getPrefs();
			this.operations.assertCurrent();
			if (typeof prefs.ControlURL !== 'string') {
				return false;
			}
			const controlUrl = prefs.ControlURL || TAILSCALE_DEFAULT_LOGIN_SERVER;
			const tags = prefs.AdvertiseTags === null ? [] : prefs.AdvertiseTags;
			if (controlUrl !== config.loginServer || !Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) {
				return false;
			}
			const advertisedTags = new Set(tags);
			const configuredTags = new Set(config.advertiseTags);
			return advertisedTags.size === configuredTags.size && [...configuredTags].every((tag) => advertisedTags.has(tag));
		} catch {
			this.operations.assertCurrent();
			// debug prefs is unstable upstream; inability to verify is never
			// permission to skip applying the configured tags or login server.
			return false;
		}
	}

	/**
	 * Preferences supported by `tailscale set`, which changes only the
	 * explicitly supplied flags. The sign-in flows reuse these via buildUpFlags.
	 */
	buildPreferenceFlags(config: RemoteAccessTailscalePluginConfigModel): string[] {
		return [
			`--hostname=${config.hostname}`,
			`--accept-dns=${config.acceptDns}`,
			`--accept-routes=${config.acceptRoutes}`,
			`--ssh=${config.ssh}`,
			`--operator=${os.userInfo().username}`,
		];
	}

	/** Public for the same reason as `buildPreferenceFlags` — the full flag set the sign-in flows' `up` calls reuse. */
	buildUpFlags(config: RemoteAccessTailscalePluginConfigModel): string[] {
		return [
			...this.buildPreferenceFlags(config),
			// Always include an empty value too, so removing configured tags clears them.
			`--advertise-tags=${config.advertiseTags.join(',')}`,
			`--login-server=${config.loginServer}`,
		];
	}

	private buildStatus(
		state: RemoteAccessProviderState,
		message?: string,
		details: Record<string, string | number | boolean | null> = {},
		proxyAddresses: string[] = [],
		endpoints: RemoteAccessEndpoint[] = [],
		advisories: RemoteAccessAdvisory[] = [],
	): RemoteAccessProviderStatus {
		return {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			state,
			endpoints,
			message,
			details,
			proxyAddresses,
			advisories,
			updatedAt: new Date().toISOString(),
		};
	}

	/** `FB_BACKEND_PORT` — the port Serve proxies to and the port the mapper's plain-HTTP endpoints advertise. */
	private getBackendPort(): number {
		return getEnvValue<number>(this.nestConfigService, 'FB_BACKEND_PORT', 3000);
	}

	/**
	 * `key-expiring`/`version-unsupported` — computed from the raw status
	 * alone (no extra CLI call), regardless of connection state, since a
	 * cached `KeyExpiry`/`Version` stays meaningful even while `disconnected`.
	 * Serve/Funnel's own advisories (`tailnet-https-disabled`,
	 * `funnel-not-allowed`, `public-exposure`) live in `TailscaleServeService`
	 * instead — they need `Self.CapMap`, which is only meaningful once
	 * connected.
	 */
	private buildPostureAdvisories(status: TailscaleStatus): RemoteAccessAdvisory[] {
		const advisories: RemoteAccessAdvisory[] = [];

		if (status.Version && compareTailscaleVersions(status.Version, TAILSCALE_MIN_VERSION) < 0) {
			advisories.push({
				code: 'version-unsupported',
				severity: 'warning',
				message: `Tailscale ${status.Version} is older than the minimum supported version ${TAILSCALE_MIN_VERSION}. Upgrade the tailscale package.`,
			});
		}

		const keyExpiry = status.Self?.KeyExpiry;
		const expiresAt = keyExpiry ? Date.parse(keyExpiry) : NaN;
		const now = Date.now();

		// `expiresAt > now` excludes an already-expired key: by the time that
		// happens the node has signed itself out and BackendState moves away
		// from Running (see the state machine doc on the class above), so it
		// surfaces through `setup-required`'s "sign in again" message
		// instead — not this advisory, which is specifically an early
		// warning ahead of that happening.
		if (!Number.isNaN(expiresAt) && expiresAt > now && expiresAt - now <= TAILSCALE_KEY_EXPIRY_ADVISORY_WINDOW_MS) {
			advisories.push({
				code: 'key-expiring',
				severity: 'warning',
				message: `The node key expires on ${keyExpiry}. Sign in again before it expires, or disable key expiry for this appliance node in the tailnet admin console.`,
			});
		}

		return advisories;
	}

	/** Public so `TailscaleLoginService` (RA-5) can build the same `up`/`set` flags via `buildUpFlags`/`buildPreferenceFlags` without duplicating config loading and its fallback-to-defaults handling. */
	getPluginConfig(): RemoteAccessTailscalePluginConfigModel {
		if (!this.pluginConfig) {
			try {
				this.pluginConfig = this.configService.getPluginConfig<RemoteAccessTailscalePluginConfigModel>(
					REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
				);
			} catch (error) {
				this.logger.warn('Failed to load the Tailscale plugin configuration, using defaults', {
					message: error instanceof Error ? error.message : String(error),
				});
				this.pluginConfig = new RemoteAccessTailscalePluginConfigModel();
			}
		}

		return this.pluginConfig;
	}
}
