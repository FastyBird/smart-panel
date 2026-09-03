import { execFile } from 'node:child_process';
import os from 'os';

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
	RemoteAccessEndpoint,
	RemoteAccessProviderState,
	RemoteAccessProviderStatus,
} from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import { EventType as RemoteAccessEventType } from '../../../modules/remote-access/remote-access.constants';
import { RemoteAccessTailscalePluginConfigModel } from '../models/config.model';
import {
	REMOTE_ACCESS_TAILSCALE_ALLOW_DEV_ENV,
	REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
	REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX,
	TAILSCALE_MIN_VERSION,
	TAILSCALE_POLL_INTERVAL_STABLE_MS,
	TAILSCALE_POLL_INTERVAL_TRANSITIONING_MS,
	TAILSCALE_SYSTEMCTL_PROBE_TIMEOUT_MS,
} from '../remote-access-tailscale.constants';

import { TailscaleCliError, TailscaleCliService, TailscaleStatus } from './tailscale-cli.service';
import { TailscaleStatusMapperService } from './tailscale-status-mapper.service';

export type TailscaleRequirementCode =
	| 'platform-supported'
	| 'binary-installed'
	| 'daemon-active'
	| 'operator-granted'
	| 'version-supported';

export interface TailscaleRequirement {
	code: TailscaleRequirementCode;
	satisfied: boolean;
	message: string;
}

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
	private pluginConfig: RemoteAccessTailscalePluginConfigModel | null = null;

	constructor(
		private readonly cli: TailscaleCliService,
		private readonly mapper: TailscaleStatusMapperService,
		private readonly configService: ConfigService,
		private readonly nestConfigService: NestConfigService,
		private readonly platformService: PlatformService,
		private readonly eventEmitter: EventEmitter2,
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
			// Cache the config unconditionally, even when a prerequisite is
			// missing or the node holds no key and neither set nor up ever
			// runs below — onConfigChanged()'s login_server diff needs a known
			// "previous" value, otherwise a later login_server change (once the
			// prerequisite clears) would go undetected.
			const config = this.getPluginConfig();

			this.logger.log('Starting Tailscale node service');

			try {
				const requirements = await this.evaluateRequirements();

				if (requirements.every((requirement) => requirement.satisfied)) {
					const status = await this.getStatusOrNull();

					if (status && this.mapper.hasExistingKey(status)) {
						await this.cli.set(this.buildPreferenceFlags(config));
						await this.cli.up(this.buildUpFlags(config));
					}
				}
			} catch (error) {
				this.logger.warn(
					'Failed to bring the Tailscale node up during start; the poller keeps reporting live status.',
					{
						message: error instanceof Error ? error.message : String(error),
					},
				);
			}

			this.schedulePoll(0);

			this.state = 'started';

			this.logger.log('Tailscale node service started');
		});
	}

	async stop(): Promise<void> {
		await this.withLock(async () => {
			if (this.state === 'stopped') {
				return;
			}

			this.state = 'stopping';

			this.clearPoll();

			try {
				await this.cli.down();
			} catch (error) {
				// A node that was never brought up (not installed, daemon down, never
				// signed in) is expected to fail `down` — stop must still complete.
				this.logger.debug('tailscale down failed while stopping (safe to ignore if the node was already down)', {
					message: error instanceof Error ? error.message : String(error),
				});
			}

			this.state = 'stopped';

			this.logger.log('Tailscale node service stopped');
		});
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

			return { restartRequired: true };
		}

		try {
			const requirements = await this.evaluateRequirements();

			if (requirements.every((requirement) => requirement.satisfied)) {
				const status = await this.getStatusOrNull();

				if (status && this.mapper.hasExistingKey(status)) {
					await this.cli.set(this.buildPreferenceFlags(next));
				}
			}
		} catch (error) {
			this.logger.warn('Failed to apply changed Tailscale preferences', {
				message: error instanceof Error ? error.message : String(error),
			});
		}

		return { restartRequired: false };
	}

	async isHealthy(): Promise<boolean> {
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

	/** Used by `start()`/`onConfigChanged()` gating and the plugin's `GET /status` requirements list. */
	async evaluateRequirements(): Promise<TailscaleRequirement[]> {
		const platform = this.evaluatePlatformSupported();

		if (!platform.satisfied) {
			return [
				platform,
				{ code: 'binary-installed', satisfied: false, message: UNEVALUATED_MESSAGE },
				{ code: 'daemon-active', satisfied: false, message: UNEVALUATED_MESSAGE },
				{ code: 'operator-granted', satisfied: false, message: UNEVALUATED_MESSAGE },
				{ code: 'version-supported', satisfied: false, message: UNEVALUATED_MESSAGE },
			];
		}

		const [{ binary, version }, daemonActive, operatorGranted] = await Promise.all([
			this.evaluateBinaryAndVersion(),
			this.evaluateDaemonActive(),
			this.evaluateOperatorGranted(),
		]);

		return [platform, binary, daemonActive, operatorGranted, version];
	}

	/**
	 * Live status merged with the platform requirement, used by both the
	 * poller and `TailscaleProviderService.getStatus()`. Never throws — CLI
	 * failures are classified into `not-installed` / `setup-required` /
	 * `error` states instead.
	 */
	async computeStatus(): Promise<RemoteAccessProviderStatus> {
		const platform = this.evaluatePlatformSupported();

		if (!platform.satisfied) {
			return this.buildStatus('unsupported', platform.message);
		}

		try {
			const status = await this.cli.getStatus();
			const port = getEnvValue<number>(this.nestConfigService, 'FB_BACKEND_PORT', 3000);
			const mapped = this.mapper.map(status, { port });

			return this.buildStatus(mapped.state, mapped.message, mapped.details, mapped.proxyAddresses, mapped.endpoints);
		} catch (error) {
			if (error instanceof TailscaleCliError) {
				switch (error.kind) {
					case 'not-installed':
						return this.buildStatus('not-installed', 'Tailscale is not installed.');
					case 'permission-denied':
						return this.buildStatus('setup-required', 'The smart-panel operator has not been granted on tailscaled.');
					case 'daemon-down':
						return this.buildStatus('setup-required', 'The Tailscale daemon is not running.');
					default:
						return this.buildStatus('error', 'Failed to retrieve the Tailscale status.');
				}
			}

			throw error;
		}
	}

	// ─── Requirements ─────────────────────────────────────────────────

	private evaluatePlatformSupported(): TailscaleRequirement {
		const platformType = this.platformService.getPlatformType();

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

	private async evaluateBinaryAndVersion(): Promise<{ binary: TailscaleRequirement; version: TailscaleRequirement }> {
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

	private async evaluateDaemonActive(): Promise<TailscaleRequirement> {
		const active = await this.isSystemdUnitActive('tailscaled');

		return {
			code: 'daemon-active',
			satisfied: active,
			message: active ? 'tailscaled is active.' : 'tailscaled is not active. Run setup or start the service.',
		};
	}

	private async evaluateOperatorGranted(): Promise<TailscaleRequirement> {
		try {
			await this.cli.getStatus();

			return { code: 'operator-granted', satisfied: true, message: 'The smart-panel operator is granted.' };
		} catch (error) {
			if (error instanceof TailscaleCliError) {
				if (error.kind === 'permission-denied') {
					return {
						code: 'operator-granted',
						satisfied: false,
						message: 'The smart-panel operator has not been granted; run setup again.',
					};
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

	private async pollTick(): Promise<void> {
		try {
			const status = await this.computeStatus();

			if (!this.isPollable()) {
				// stop() ran while this tick's computeStatus() was in flight.
				return;
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

	private buildPreferenceFlags(config: RemoteAccessTailscalePluginConfigModel): string[] {
		return [
			`--hostname=${config.hostname}`,
			`--accept-dns=${config.acceptDns}`,
			`--accept-routes=${config.acceptRoutes}`,
			`--advertise-tags=${config.advertiseTags.join(',')}`,
			`--ssh=${config.ssh}`,
			`--operator=${os.userInfo().username}`,
		];
	}

	private buildUpFlags(config: RemoteAccessTailscalePluginConfigModel): string[] {
		return [...this.buildPreferenceFlags(config), `--login-server=${config.loginServer}`];
	}

	private buildStatus(
		state: RemoteAccessProviderState,
		message?: string,
		details: Record<string, string | number | boolean | null> = {},
		proxyAddresses: string[] = [],
		endpoints: RemoteAccessEndpoint[] = [],
	): RemoteAccessProviderStatus {
		return {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX,
			state,
			endpoints,
			message,
			details,
			proxyAddresses,
			advisories: [],
			updatedAt: new Date().toISOString(),
		};
	}

	private getPluginConfig(): RemoteAccessTailscalePluginConfigModel {
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
