import { Inject, Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import { BaseManagedExtensionService } from '../../../modules/extensions/services/base-managed-extension.service';
import { ConfigChangeResult } from '../../../modules/extensions/services/managed-extension-service.interface';
import { PROTECT_API_CLIENT_FACTORY, ProtectApiClientFactory } from '../client/protect-api-client.factory';
import { ProtectApiClient } from '../client/protect-api.client';
import { isSupportedProtectVersion } from '../client/protect-version';
import {
	DEVICES_UNIFI_PROTECT_CONNECTOR_SERVICE_ID,
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	PROTECT_HEALTH_CHECK_INTERVAL_MS,
	PROTECT_MIN_VERSION,
	PROTECT_RECONNECT_MAX_DELAY_MS,
	ProtectConnectionState,
} from '../devices-unifi-protect.constants';
import {
	PROTECT_ERROR_MESSAGES,
	ProtectApiError,
	ProtectErrorCategory,
	toProtectApiError,
} from '../errors/protect-api.error';
import { toNvrMacKey } from '../mappings/mapping-evaluator';
import { ProtectConfigModel } from '../models/config.model';
import { ProtectStatusModel } from '../models/status.model';
import { findProtectConfigError } from '../validators/protect-config.validators';

import { calculateProtectReconnectDelay } from './protect-reconnect-backoff';

export interface ProtectConsoleIdentity {
	nvrId: string;
	nvrMacKey: string;
}

const AUTH_CATEGORIES: readonly ProtectErrorCategory[] = [
	ProtectErrorCategory.AUTHENTICATION,
	ProtectErrorCategory.AUTHORIZATION,
];

/**
 * Keeps one read-only connection to the Protect console: connects, gates the console version, checks health every
 * 60 s and reconnects with a growing delay. Console outcomes never throw from `start()`; they become status. Every
 * continuation compares its captured generation, so a stop or restart discards late results and closes their client.
 */
@Injectable()
export class ProtectConnectorService extends BaseManagedExtensionService {
	private readonly logger = createExtensionLogger(DEVICES_UNIFI_PROTECT_PLUGIN_NAME, 'ProtectConnectorService');

	readonly owner = { kind: 'plugin', type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME } as const;
	readonly serviceId = DEVICES_UNIFI_PROTECT_CONNECTOR_SERVICE_ID;

	private generation = 0;
	private startedConfig: ProtectConfigModel | null = null;
	private client: ProtectApiClient | null = null;
	private attemptClient: ProtectApiClient | null = null;
	private connectionState = ProtectConnectionState.DISCONNECTED;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private healthTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempt = 0;
	private nextRetryAt: Date | null = null;
	private applicationVersion: string | null = null;
	private nvrId: string | null = null;
	private nvrName: string | null = null;
	private nvrMacKey: string | null = null;
	private lastConnectedAt: Date | null = null;
	private lastErrorCategory: ProtectErrorCategory | null = null;
	private inflight: Promise<void> | null = null;

	constructor(
		private readonly configService: ConfigService,
		@Inject(PROTECT_API_CLIENT_FACTORY) private readonly clientFactory: ProtectApiClientFactory,
	) {
		super();
	}

	start(): Promise<void> {
		return this.withLock(() => {
			if (this.state === 'started') {
				return Promise.resolve();
			}

			this.state = 'starting';
			this.resetRuntime();

			const generation = ++this.generation;
			const config = this.readConfig();

			this.startedConfig = config;
			this.state = 'started';

			if (config === null) {
				this.connectionState = ProtectConnectionState.ERROR;
				this.lastErrorCategory = ProtectErrorCategory.VALIDATION;
				this.logger.warn(`UniFi Protect connection stopped (${ProtectErrorCategory.VALIDATION})`);
			} else if (findProtectConfigError(config as unknown as Record<string, unknown>) === null) {
				this.beginAttempt(generation);
			}

			// A config that is not ready never connects; getStatus() reports the readiness text.
			return Promise.resolve();
		});
	}

	stop(): Promise<void> {
		return this.withLock(() => {
			this.state = 'stopping';
			this.generation += 1;
			this.resetRuntime();
			this.startedConfig = null;
			this.state = 'stopped';
			this.logger.log('UniFi Protect connector stopped');

			return Promise.resolve();
		});
	}

	onConfigChanged(): Promise<ConfigChangeResult> {
		if (this.state !== 'started') {
			return Promise.resolve({ restartRequired: false });
		}

		const previous = this.startedConfig;
		const next = this.readConfig();

		if (previous === null || next === null) {
			return Promise.resolve({ restartRequired: true });
		}

		const restartRequired =
			previous.host !== next.host ||
			previous.port !== next.port ||
			previous.apiKey !== next.apiKey ||
			previous.tls.mode !== next.tls.mode ||
			previous.tls.serverName !== next.tls.serverName ||
			previous.tls.fingerprintSha256 !== next.tls.fingerprintSha256;

		return Promise.resolve({ restartRequired });
	}

	isHealthy(): Promise<boolean> {
		return Promise.resolve(this.isConnected());
	}

	getStatus(): ProtectStatusModel {
		const config = this.readConfig();
		const status = new ProtectStatusModel();
		let category = this.lastErrorCategory;
		let lastError = category === null ? null : PROTECT_ERROR_MESSAGES[category];

		const idle =
			this.connectionState === ProtectConnectionState.DISCONNECTED && category === null && this.client === null;
		const readiness =
			idle && config?.enabled === true ? findProtectConfigError(config as unknown as Record<string, unknown>) : null;

		if (readiness !== null) {
			category = ProtectErrorCategory.VALIDATION;
			lastError = readiness.message;
		}

		status.serviceState = this.getState();
		status.connectionState = this.connectionState;
		status.enabled = config?.enabled === true;
		status.configured = !!config && !!config.host?.trim() && !!config.apiKey?.trim();
		status.healthy = this.isConnected();
		status.tlsMode = config?.tls.mode ?? 'verify';
		status.applicationVersion = this.applicationVersion;
		status.minimumVersion = PROTECT_MIN_VERSION;
		status.nvrId = this.nvrId;
		status.nvrName = this.nvrName;
		status.lastConnectedAt = this.lastConnectedAt?.toISOString() ?? null;
		status.lastErrorCategory = category;
		status.lastError = lastError;
		status.reconnectAttempt = this.reconnectAttempt;
		status.nextRetryAt = this.nextRetryAt?.toISOString() ?? null;

		return status;
	}

	/** The live client for Plan 5 consumers; null unless the console is connected and supported. */
	getClient(): ProtectApiClient | null {
		return this.isConnected() ? this.client : null;
	}

	/** The console's id and MAC key; null unless connected and the NVR reported a valid MAC. */
	getConsoleIdentity(): ProtectConsoleIdentity | null {
		return this.isConnected() && this.nvrId !== null && this.nvrMacKey !== null
			? { nvrId: this.nvrId, nvrMacKey: this.nvrMacKey }
			: null;
	}

	/** Resolves when the current connection attempt or health check has finished (tests, e2e). */
	async settle(): Promise<void> {
		let pending = this.inflight;

		while (pending !== null) {
			await pending;

			pending = this.inflight === pending ? null : this.inflight;
		}
	}

	private isConnected(): boolean {
		return this.state === 'started' && this.connectionState === ProtectConnectionState.CONNECTED;
	}

	private isCurrent(generation: number): boolean {
		return this.generation === generation;
	}

	private readConfig(): ProtectConfigModel | null {
		try {
			return this.configService.getPluginConfig<ProtectConfigModel>(DEVICES_UNIFI_PROTECT_PLUGIN_NAME);
		} catch {
			// The config service has already logged the (redacted) reason; nothing from it is kept here.
			return null;
		}
	}

	private track(work: Promise<void>): void {
		const tracked: Promise<void> = work.finally(() => {
			if (this.inflight === tracked) {
				this.inflight = null;
			}
		});

		this.inflight = tracked;
	}

	private beginAttempt(generation: number): void {
		this.track(this.runAttempt(generation));
	}

	private async runAttempt(generation: number): Promise<void> {
		const config = this.startedConfig;
		let client: ProtectApiClient | null = null;

		this.nextRetryAt = null;
		this.connectionState = ProtectConnectionState.CONNECTING;

		try {
			if (config === null || config.host === null || config.apiKey === null) {
				throw new ProtectApiError(ProtectErrorCategory.VALIDATION, 'system');
			}

			client = this.clientFactory.create({
				host: config.host,
				port: config.port,
				apiKey: config.apiKey,
				tls: {
					mode: config.tls.mode,
					serverName: config.tls.serverName,
					fingerprintSha256: config.tls.fingerprintSha256,
				},
			});
			this.attemptClient = client;

			const meta = await client.getMetaInfo();

			if (!this.isCurrent(generation)) {
				this.discard(client);

				return;
			}

			this.applicationVersion = meta.applicationVersion;

			if (!isSupportedProtectVersion(meta.applicationVersion)) {
				this.discard(client);
				this.handleFailure(generation, new ProtectApiError(ProtectErrorCategory.VERSION_UNSUPPORTED, 'meta/info'));

				return;
			}

			const nvr = await client.getNvr();

			if (!this.isCurrent(generation)) {
				this.discard(client);

				return;
			}

			this.attemptClient = null;
			this.client = client;
			this.nvrId = nvr.id;
			this.nvrName = nvr.name;
			this.nvrMacKey = toNvrMacKey(nvr.mac);
			this.lastConnectedAt = new Date();
			this.lastErrorCategory = null;
			this.reconnectAttempt = 0;
			this.nextRetryAt = null;
			this.connectionState = ProtectConnectionState.CONNECTED;
			this.logger.log(`UniFi Protect connected (Protect ${meta.applicationVersion})`);
			this.scheduleHealthCheck(generation);
		} catch (error) {
			if (client !== null) {
				this.discard(client);
			}

			if (this.isCurrent(generation)) {
				this.handleFailure(generation, error);
			}
		}
	}

	private scheduleHealthCheck(generation: number): void {
		this.clearHealthTimer();
		this.healthTimer = this.unref(
			setTimeout(() => {
				this.healthTimer = null;

				if (this.isCurrent(generation)) {
					this.track(this.runHealthCheck(generation));
				}
			}, PROTECT_HEALTH_CHECK_INTERVAL_MS),
		);
	}

	private async runHealthCheck(generation: number): Promise<void> {
		const client = this.client;

		if (client === null) {
			return;
		}

		try {
			const meta = await client.getMetaInfo();

			if (!this.isCurrent(generation) || this.client !== client) {
				return;
			}

			this.applicationVersion = meta.applicationVersion;

			if (!isSupportedProtectVersion(meta.applicationVersion)) {
				this.handleFailure(generation, new ProtectApiError(ProtectErrorCategory.VERSION_UNSUPPORTED, 'meta/info'));

				return;
			}

			this.scheduleHealthCheck(generation);
		} catch (error) {
			if (this.isCurrent(generation) && this.client === client) {
				this.handleFailure(generation, error);
			}
		}
	}

	/** Maps a failed attempt or health check to a state; only retryable categories keep reconnecting. */
	private handleFailure(generation: number, error: unknown): void {
		const apiError = error instanceof ProtectApiError ? error : toProtectApiError(error, 'system');
		const category = apiError.category;

		this.closeConnected();
		this.lastErrorCategory = category;

		if (apiError.retryable) {
			this.scheduleReconnect(generation, category, apiError.retryAfterMs);

			return;
		}

		this.nextRetryAt = null;
		this.connectionState = AUTH_CATEGORIES.includes(category)
			? ProtectConnectionState.AUTH_FAILED
			: category === ProtectErrorCategory.VERSION_UNSUPPORTED
				? ProtectConnectionState.VERSION_UNSUPPORTED
				: ProtectConnectionState.ERROR;
		this.logger.warn(`UniFi Protect connection stopped (${category})`);
	}

	private scheduleReconnect(generation: number, category: ProtectErrorCategory, retryAfterMs: number | null): void {
		const backoff = calculateProtectReconnectDelay(this.reconnectAttempt);
		// A throttled console says when it will answer again; waiting less only earns another 429.
		const delay =
			category === ProtectErrorCategory.RATE_LIMITED && retryAfterMs !== null
				? Math.min(PROTECT_RECONNECT_MAX_DELAY_MS, Math.max(backoff, retryAfterMs))
				: backoff;

		this.clearReconnectTimer();

		this.reconnectAttempt += 1;
		this.connectionState = ProtectConnectionState.DISCONNECTED;
		this.nextRetryAt = new Date(Date.now() + delay);
		this.logger.warn(`UniFi Protect connection failed (${category}); retry in ${delay} ms`);
		this.reconnectTimer = this.unref(
			setTimeout(() => {
				this.reconnectTimer = null;

				if (this.isCurrent(generation)) {
					this.beginAttempt(generation);
				}
			}, delay),
		);
	}

	private discard(client: ProtectApiClient): void {
		client.close();

		if (this.attemptClient === client) {
			this.attemptClient = null;
		}
	}

	private closeConnected(): void {
		this.clearHealthTimer();

		if (this.client !== null) {
			this.client.close();
			this.client = null;
		}
	}

	private clearReconnectTimer(): void {
		if (this.reconnectTimer !== null) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	private clearHealthTimer(): void {
		if (this.healthTimer !== null) {
			clearTimeout(this.healthTimer);
			this.healthTimer = null;
		}
	}

	/** Closes every client and timer and clears the connection facts; the generation is bumped by the caller. */
	private resetRuntime(): void {
		this.clearHealthTimer();
		this.clearReconnectTimer();

		for (const client of [this.client, this.attemptClient]) {
			client?.close();
		}

		this.client = null;
		this.attemptClient = null;
		this.connectionState = ProtectConnectionState.DISCONNECTED;
		this.reconnectAttempt = 0;
		this.nextRetryAt = null;
		this.applicationVersion = null;
		this.nvrId = null;
		this.nvrName = null;
		this.nvrMacKey = null;
		this.lastConnectedAt = null;
		this.lastErrorCategory = null;
	}

	/** A pending timer never keeps the process alive. */
	private unref(timer: ReturnType<typeof setTimeout>): ReturnType<typeof setTimeout> {
		timer.unref?.();

		return timer;
	}
}
