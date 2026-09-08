import { execFile } from 'node:child_process';
import os from 'os';
import { join } from 'path';

import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
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
import { RemoteAccessTailscalePluginConfigModel } from '../models/config.model';
import {
	REMOTE_ACCESS_TAILSCALE_ALLOW_DEV_ENV,
	REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
	TAILSCALE_KEY_EXPIRY_ADVISORY_WINDOW_MS,
	TAILSCALE_MIN_VERSION,
	TAILSCALE_POLL_INTERVAL_STABLE_MS,
	TAILSCALE_POLL_INTERVAL_TRANSITIONING_MS,
	TAILSCALE_RECONNECT_BASE_DELAY_MS,
	TAILSCALE_RECONNECT_MAX_DELAY_MS,
	TAILSCALE_SYSTEMCTL_PROBE_TIMEOUT_MS,
} from '../remote-access-tailscale.constants';
import { TailscaleNodeStopFailedException } from '../remote-access-tailscale.exceptions';

import { TailscaleCliError, TailscaleCliService, TailscaleStatus } from './tailscale-cli.service';
import { TailscaleServeResult, TailscaleServeService } from './tailscale-serve.service';
import { TailscaleStatusMapperService } from './tailscale-status-mapper.service';

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

/**
 * Why `refreshRequirements()` was called — every reason other than
 * `'periodic'` always performs a fresh evaluation; `'periodic'` (the poller,
 * via `computeStatus()`) is throttled to at most once every
 * `TAILSCALE_REQUIREMENTS_PERIODIC_REFRESH_MS`, so the steady-state poll
 * stays at one `status --json` call per tick instead of also paying for the
 * operator write-probe's own CLI calls on every tick.
 */
export type TailscaleRequirementRefreshReason =
	| 'start'
	| 'permission-denied'
	| 'setup-complete'
	| 'status-read'
	| 'periodic';

/** Floor between two `'periodic'` requirement refreshes (see `TailscaleRequirementRefreshReason`'s own doc). */
const TAILSCALE_REQUIREMENTS_PERIODIC_REFRESH_MS = 5 * 60 * 1000;

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
 * Setup, sign-in, sign-out and reset-preferences are out of scope (RA-5):
 * `start()` never authenticates a node that has never signed in — it only
 * reconnects a node that already holds a key. `stop()` never signs out.
 *
 * A stopped managed service reports `disconnected` with no endpoints/proxy
 * addresses regardless of what the daemon itself last reported — every
 * lifecycle transition (`start()`, `stop()`) emits `PROVIDER_STATUS`
 * immediately instead of waiting for the next poll tick (D2/D3).
 */
@Injectable()
export class TailscaleNodeManagedService extends BaseManagedExtensionService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
		'TailscaleNodeManagedService',
	);

	readonly owner = { kind: 'plugin', type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME } as const;
	readonly serviceId = 'node';
	readonly activationPolicy = 'owner-enabled' as const;

	private pollTimer: NodeJS.Timeout | null = null;
	private lastStatus: RemoteAccessProviderStatus | null = null;
	/** Set by `stop()` when the underlying `down` call fails with a non-tolerated outcome — read back by `computeStatus()` while `this.state === 'error'`. */
	private lastError: string | null = null;
	private pluginConfig: RemoteAccessTailscalePluginConfigModel | null = null;
	/** Cached `refreshRequirements()` snapshot — see `getRequirements()`/`refreshRequirements()`. */
	private requirementsCache: TailscaleRequirement[] | null = null;
	private requirementsRefreshedAt = 0;
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
	) {
		super();
	}

	async start(): Promise<void> {
		await this.withLock(async () => {
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

			this.logger.log('Starting Tailscale node service');

			try {
				const requirements = await this.refreshRequirements('start');

				if (this.requirementsSatisfied(requirements)) {
					const status = await this.getStatusOrNull();

					if (status && this.mapper.hasExistingKey(status)) {
						await this.cli.set(this.buildPreferenceFlags(config));
						await this.cli.up(this.buildUpFlags(config));
					}
				}
			} catch (error) {
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

			this.schedulePoll(0);

			this.state = 'started';

			this.logger.log('Tailscale node service started');
		});
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
		await this.withLock(async () => {
			if (this.state === 'stopped') {
				return;
			}

			this.state = 'stopping';

			this.clearPoll();

			try {
				await this.cli.down();

				this.state = 'stopped';
			} catch (error) {
				if (await this.isStopFailureTolerated(error)) {
					// A node that was never brought up (not installed, daemon down, never
					// signed in) is expected to fail `down` — stop must still complete.
					this.logger.debug('tailscale down failed while stopping (safe to ignore if the node was already down)', {
						message: error instanceof Error ? error.message : String(error),
					});

					this.state = 'stopped';
				} else {
					const message = error instanceof Error ? error.message : String(error);

					this.state = 'error';
					this.lastError = message;

					this.logger.error('Failed to stop the Tailscale node service', { message });

					await this.emitStatus();

					throw new TailscaleNodeStopFailedException(message);
				}
			}

			await this.emitStatus();

			this.logger.log('Tailscale node service stopped');
		});
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

		const status = await this.getStatusOrNull();

		return status?.BackendState === 'Stopped';
	}

	/** Computes the current status and pushes it as `PROVIDER_STATUS`, unconditionally (unlike the poller's own `pollTick()`, which only emits on change) — used by `stop()` (both outcomes) and by `start()` after a failed `set`/`up` call. */
	private async emitStatus(): Promise<void> {
		const status = await this.computeStatus();

		this.lastStatus = status;
		this.eventEmitter.emit(RemoteAccessEventType.PROVIDER_STATUS, status);
	}

	async onConfigChanged(): Promise<ConfigChangeResult> {
		const previous = this.pluginConfig;
		this.pluginConfig = null;
		const next = this.getPluginConfig();

		// `start()` always caches the config, so `previous` should never be
		// null here — but if it somehow is (config cleared or never cached),
		// treat the prior login_server as unknown and restart defensively
		// rather than risk silently missing a real change.
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

			return { restartRequired: true };
		}

		try {
			// A config change is a rare, admin-triggered event (never the
			// poller), so a fresh evaluation here is cheap enough — reuses
			// the 'start' reason since both represent "about to apply
			// preferences, recheck gating first" (only the poller's own
			// 'periodic' reason is throttled; see `refreshRequirements`'s doc).
			const requirements = await this.refreshRequirements('start');

			if (this.requirementsSatisfied(requirements)) {
				const status = await this.getStatusOrNull();

				if (status && this.mapper.hasExistingKey(status)) {
					await this.cli.set(this.buildPreferenceFlags(next));

					const port = this.getBackendPort();

					// Converged immediately here for a responsive config change,
					// rather than waiting for the next poll tick to pick it up
					// (pollTick() runs the same converge step, at most once per
					// tick, gated on requirements satisfied + connected).
					if (this.mapper.map(status, { port }).state === 'connected') {
						await this.convergeServe(next, port, status);
					}
				}
			}
		} catch (error) {
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
	 * keeps that cache fresh at most every five minutes, see
	 * `refreshRequirements`'s own doc) AND the daemon backend itself reports
	 * `Running` with `Self.Online`.
	 */
	async isHealthy(): Promise<boolean> {
		if (!this.requirementsSatisfied(this.getRequirements())) {
			return false;
		}

		try {
			const status = await this.cli.getStatus();

			return status.BackendState === 'Running' && status.Self?.Online === true;
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
		await this.cli.serveReset().catch(() => undefined);

		try {
			await this.cli.logout();

			return { success: true };
		} catch (error) {
			if (error instanceof TailscaleCliError && (error.kind === 'not-installed' || error.kind === 'needs-login')) {
				return { success: true };
			}

			return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
		}
	}

	/**
	 * Backward-compatible alias kept for `StatusController.getStatus()` and
	 * `TailscaleSetupService`'s post-job refresh (both outside this task's
	 * file ownership) — always forces a fresh evaluation via
	 * `refreshRequirements('status-read')`, same as before this method grew
	 * a cache.
	 */
	async evaluateRequirements(): Promise<TailscaleRequirement[]> {
		return this.refreshRequirements('status-read');
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

	/**
	 * Re-evaluates every prerequisite and updates the cache `getRequirements()`
	 * reads — except for `reason: 'periodic'` (the poller, via
	 * `computeStatus()`), which is throttled to at most once every
	 * `TAILSCALE_REQUIREMENTS_PERIODIC_REFRESH_MS` and otherwise just returns
	 * the existing cache: this is what keeps the steady-state poll at one
	 * `status --json` call per tick instead of also paying for
	 * `evaluateOperatorGranted()`'s own `debug prefs`/write-probe CLI calls
	 * on every tick. Every other reason ('start', 'permission-denied',
	 * 'setup-complete', 'status-read') always performs a fresh evaluation —
	 * these are all rare, admin/lifecycle-triggered events, never the poller.
	 */
	async refreshRequirements(reason: TailscaleRequirementRefreshReason): Promise<TailscaleRequirement[]> {
		if (
			reason === 'periodic' &&
			this.requirementsCache &&
			Date.now() - this.requirementsRefreshedAt < TAILSCALE_REQUIREMENTS_PERIODIC_REFRESH_MS
		) {
			return this.requirementsCache;
		}

		const requirements = await this.evaluateRequirementsLive();

		this.requirementsCache = requirements;
		this.requirementsRefreshedAt = Date.now();

		return requirements;
	}

	/** `true` only when the list is non-empty and every requirement is satisfied — an empty (never-evaluated) list is treated as "not ready", not vacuously true. */
	private requirementsSatisfied(requirements: TailscaleRequirement[]): boolean {
		return requirements.length > 0 && requirements.every((requirement) => requirement.satisfied);
	}

	/** The actual, always-live evaluation — reached only through `refreshRequirements()`, which owns the cache and the periodic throttle. */
	private async evaluateRequirementsLive(): Promise<TailscaleRequirement[]> {
		const platform = await this.evaluatePlatformSupported();

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

		const [{ binary, version }, daemonActive, operatorGranted] = await Promise.all([
			this.evaluateBinaryAndVersion(),
			this.evaluateDaemonActive(),
			this.evaluateOperatorGranted(),
		]);

		return this.attachRemedies([platform, binary, daemonActive, operatorGranted, version]);
	}

	private unevaluatedRequirement(code: TailscaleRequirementCode): TailscaleRequirement {
		return { code, satisfied: false, message: UNEVALUATED_MESSAGE, remedy: null };
	}

	/** Attaches `remedy` to each requirement: `null` when satisfied (D12: "remedy is null when the requirement is satisfied"), otherwise the manual remedy for its code. */
	private async attachRemedies(requirements: TailscaleRequirementBase[]): Promise<TailscaleRequirement[]> {
		// Memoized as a shared *promise* (not just the resolved value) so
		// `binary-installed` and `version-supported` — both unsatisfied
		// together on a freshly detected missing install, and both mapped to
		// this same script call — never spawn `tailscale-setup.sh
		// --print-plan` twice for the one request evaluating them
		// concurrently below.
		let installRemedyPromise: Promise<TailscaleRequirementRemedy> | null = null;

		const getInstallRemedy = (): Promise<TailscaleRequirementRemedy> => {
			installRemedyPromise ??= this.buildInstallRemedy();

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
	private async buildInstallRemedy(): Promise<TailscaleRequirementRemedy> {
		try {
			const stdout = await this.runSetupScriptPrintPlan('install');
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

	private runSetupScriptPrintPlan(step: 'install' | 'daemon' | 'operator'): Promise<string> {
		const script = join(__dirname, '..', 'scripts', 'tailscale-setup.sh');

		return new Promise((resolve, reject) => {
			execFile(
				'bash',
				[script, '--print-plan', `--step=${step}`],
				{ timeout: TAILSCALE_PRINT_PLAN_TIMEOUT_MS },
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
	 * `error` reports the `lastError` `stop()` recorded. Neither branch
	 * touches the CLI at all.
	 *
	 * `requirementsReason` controls how fresh the internal `operator-granted`
	 * gate below is: every caller except the poller's own tick wants the
	 * live truth (default `'status-read'`, always fresh — this is what makes
	 * `GET /status`, "Re-check" and every action's post-call refresh reflect
	 * an operator grant fixed a moment ago instead of the periodic cache).
	 * Only `pollTick()` passes `'periodic'`, which is what keeps the
	 * continuous background poll at one `status --json` call per tick
	 * instead of also paying for `evaluateOperatorGranted()`'s own CLI calls
	 * on every tick (see `refreshRequirements`'s own doc).
	 */
	async computeStatus(
		requirementsReason: TailscaleRequirementRefreshReason = 'status-read',
	): Promise<RemoteAccessProviderStatus> {
		return (await this.computeStatusWithRawStatus(requirementsReason)).status;
	}

	/**
	 * Shared by `computeStatus()` and `pollTick()`: computes the exact same
	 * status `computeStatus()` returns, but also hands back the raw
	 * `status --json` read this call made (or `null` when one was never
	 * made — every short-circuit branch and the catch block below), so
	 * `pollTick()` can pass it straight to `serveService.converge()` without
	 * paying for a second `status --json` call just to converge Serve/Funnel.
	 */
	private async computeStatusWithRawStatus(
		requirementsReason: TailscaleRequirementRefreshReason = 'status-read',
	): Promise<{
		status: RemoteAccessProviderStatus;
		raw: TailscaleStatus | null;
	}> {
		if (this.state === 'stopped' || this.state === 'stopping') {
			return { status: this.buildStatus('disconnected', 'The node service is stopped.'), raw: null };
		}

		if (this.state === 'error') {
			return { status: this.buildStatus('error', this.lastError ?? 'The Tailscale node service failed.'), raw: null };
		}

		const platform = await this.evaluatePlatformSupported();

		if (!platform.satisfied) {
			return { status: this.buildStatus('unsupported', platform.message), raw: null };
		}

		try {
			const status = await this.cli.getStatus();
			const port = this.getBackendPort();
			const postureAdvisories = this.buildPostureAdvisories(status);

			// Only throttled (at most once every five minutes) when the poller's
			// own tick passes 'periodic' — see this method's and
			// `refreshRequirements`'s own docs. Every other caller (GET /status,
			// Re-check, every action's post-call refresh) gets `requirementsReason`'s
			// default 'status-read', always fresh.
			const requirements = await this.refreshRequirements(requirementsReason);
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
			const serveResult = await this.serveService.read(config, port, status);

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
		const result = await this.serveService.converge(config, port, status);

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

	private async evaluateBinaryAndVersion(): Promise<{
		binary: TailscaleRequirementBase;
		version: TailscaleRequirementBase;
	}> {
		try {
			const info = await this.cli.getVersion();
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

	private async evaluateDaemonActive(): Promise<TailscaleRequirementBase> {
		const active = await this.isSystemdUnitActive('tailscaled');

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
	 * output cannot be parsed falls back to an idempotent write probe
	 * (`tailscale set --operator=<user>`) instead: harmless for the current
	 * operator, `permission-denied` for anyone else.
	 */
	private async evaluateOperatorGranted(): Promise<TailscaleRequirementBase> {
		const serviceUser = os.userInfo().username;

		try {
			const prefs = await this.cli.getPrefs();

			return this.buildOperatorRequirement(prefs.OperatorUser === serviceUser, serviceUser);
		} catch (error) {
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
			return this.evaluateOperatorGrantedViaProbe(serviceUser);
		}
	}

	private async evaluateOperatorGrantedViaProbe(serviceUser: string): Promise<TailscaleRequirementBase> {
		try {
			await this.cli.set([`--operator=${serviceUser}`]);

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

	private isSystemdUnitActive(unit: string): Promise<boolean> {
		return new Promise((resolve) => {
			execFile('systemctl', ['is-active', unit], { timeout: TAILSCALE_SYSTEMCTL_PROBE_TIMEOUT_MS }, (error, stdout) => {
				if (error) {
					resolve(false);

					return;
				}

				resolve((stdout ?? '').trim() === 'active');
			});
		});
	}

	// ─── Poller ───────────────────────────────────────────────────────

	/**
	 * True while the service is starting up or fully started — the only
	 * states in which the poller is allowed to hold a timer or emit.
	 * `pollTick()` runs outside `withLock` (it is a `setTimeout` callback,
	 * not part of `start()`/`stop()`'s own critical section) so a tick whose
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
		try {
			let { status, raw } = await this.computeStatusWithRawStatus('periodic');

			if (!this.isPollable()) {
				// stop() ran while this tick's computeStatus() was in flight.
				return;
			}

			if (
				status.state === 'disconnected' &&
				raw &&
				this.mapper.hasExistingKey(raw) &&
				this.requirementsSatisfied(this.getRequirements()) &&
				Date.now() >= this.nextReconnectAttemptAt
			) {
				const reconnected = await this.attemptReconnect();

				if (!this.isPollable()) {
					// stop() ran while attemptReconnect() held the lock.
					return;
				}

				if (reconnected) {
					({ status, raw } = await this.computeStatusWithRawStatus('periodic'));

					if (!this.isPollable()) {
						return;
					}
				}
			}

			if (raw && status.state === 'connected' && this.requirementsSatisfied(this.getRequirements())) {
				await this.convergeServe(this.getPluginConfig(), this.getBackendPort(), raw);
			}

			if (this.hasStatusChanged(this.lastStatus, status)) {
				this.lastStatus = status;
				this.eventEmitter.emit(RemoteAccessEventType.PROVIDER_STATUS, status);
			}

			this.schedulePoll(
				status.state === 'connecting' ? TAILSCALE_POLL_INTERVAL_TRANSITIONING_MS : TAILSCALE_POLL_INTERVAL_STABLE_MS,
			);
		} catch (error) {
			if (!this.isPollable()) {
				return;
			}

			this.logger.error('Tailscale status poll failed', {
				message: error instanceof Error ? error.message : String(error),
			});

			this.schedulePoll(TAILSCALE_POLL_INTERVAL_STABLE_MS);
		}
	}

	/**
	 * Retries bringing the node back up when the poller finds it unexpectedly
	 * `Stopped` (mapped to `disconnected`) while this managed service is
	 * still `started` and every requirement is satisfied — the same
	 * `set`/`up` pair `start()` runs once, given another chance instead of
	 * leaving a transient failure (or a `stop()`/`start()` reconnect whose
	 * `up` call missed) stuck until a human intervenes. Shares `withLock()`
	 * with `start()`/`stop()` so a concurrent manual stop is never raced —
	 * `stop()` simply waits for this attempt to finish first, same as it
	 * already does for a concurrent `start()`. Never throws: failure only
	 * schedules the next backoff attempt via `nextReconnectAttemptAt`.
	 */
	private async attemptReconnect(): Promise<boolean> {
		return this.withLock(async () => {
			if (this.state !== 'started') {
				// stop() (or a fresh start() cycle) already changed things
				// while this call waited for the lock — nothing to reconnect.
				return false;
			}

			try {
				const config = this.getPluginConfig();

				await this.cli.set(this.buildPreferenceFlags(config));
				await this.cli.up(this.buildUpFlags(config));

				this.reconnectAttempts = 0;
				this.nextReconnectAttemptAt = 0;

				this.logger.log('Tailscale node reconnected automatically after being found unexpectedly disconnected.');

				return true;
			} catch (error) {
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

	/**
	 * Public so the sign-in flows (RA-5: `TailscaleLoginService`) can build the
	 * exact same `--operator=` + preference flags this service applies on
	 * `start()`/`onConfigChanged()`, instead of re-deriving them.
	 */
	buildPreferenceFlags(config: RemoteAccessTailscalePluginConfigModel): string[] {
		return [
			`--hostname=${config.hostname}`,
			`--accept-dns=${config.acceptDns}`,
			`--accept-routes=${config.acceptRoutes}`,
			`--advertise-tags=${config.advertiseTags.join(',')}`,
			`--ssh=${config.ssh}`,
			`--operator=${os.userInfo().username}`,
		];
	}

	/** Public for the same reason as `buildPreferenceFlags` — the full flag set the sign-in flows' `up` calls reuse. */
	buildUpFlags(config: RemoteAccessTailscalePluginConfigModel): string[] {
		return [...this.buildPreferenceFlags(config), `--login-server=${config.loginServer}`];
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
