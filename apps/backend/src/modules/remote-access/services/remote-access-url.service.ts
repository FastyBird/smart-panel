import os from 'os';
import si from 'systeminformation';

import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { getEnvValue } from '../../../common/utils/config.utils';
import { isIpInCidr } from '../../api/utils/ip-match.utils';
import { EventType as ConfigEventType } from '../../config/config.constants';
import { ConfigService } from '../../config/services/config.service';
import { RemoteAccessConfigModel } from '../models/config.model';
import { RemoteAccessEndpoint } from '../platforms/remote-access-provider.platform';
import { EventType, REMOTE_ACCESS_MODULE_NAME } from '../remote-access.constants';
import { NoUrlAvailableException } from '../remote-access.exceptions';

import { RemoteAccessStatusService } from './remote-access-status.service';

export interface RemoteAccessUrlsSnapshot {
	/** Absolute origin, no path. */
	internal: string;
	/** Ranked: HTTPS before HTTP, public before private, then registration order. */
	external: RemoteAccessEndpoint[];
	/** `external[0].url`, or null when no external endpoint is available. */
	primaryExternalUrl: string | null;
}

export interface RemoteAccessGetUrlOptions {
	requireHttps?: boolean;
	requirePublic?: boolean;
	/** @default true */
	allowInternal?: boolean;
	/** @default true */
	allowExternal?: boolean;
	/** @default false */
	preferExternal?: boolean;
}

interface ConfigUpdatedEvent {
	source: string;
	type: 'module' | 'plugin';
}

/**
 * The system-wide URL registry, mirroring Home Assistant's
 * `helpers/network.py::get_url()`. Internal URL: `internal_url` from module
 * config, otherwise derived from `FB_APP_HOST`/`FB_BACKEND_PORT` exactly
 * like `LocationReplaceInterceptor`. External URLs: every connected
 * provider's endpoints (read from `RemoteAccessStatusService`'s
 * event-fed cache — never a live call, so this stays usable from a
 * per-request code path) plus the manual `external_url`.
 */
@Injectable()
export class RemoteAccessUrlService {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_MODULE_NAME, 'RemoteAccessUrlService');

	private lastSnapshot: RemoteAccessUrlsSnapshot | null = null;

	constructor(
		private readonly configService: ConfigService,
		private readonly nestConfigService: NestConfigService,
		private readonly statusService: RemoteAccessStatusService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/** Pure, synchronous computation of the current internal/external URLs. */
	getUrls(): RemoteAccessUrlsSnapshot {
		const config = this.configService.getModuleConfig<RemoteAccessConfigModel>(REMOTE_ACCESS_MODULE_NAME);
		const internal = this.resolveInternalUrl(config);

		if (!config.enabled) {
			return { internal, external: [], primaryExternalUrl: null };
		}

		const external = this.rank(this.collectExternalEndpoints(config));

		return { internal, external, primaryExternalUrl: external[0]?.url ?? null };
	}

	/**
	 * Resolves a single URL matching the given constraints, in the style of
	 * Home Assistant's `get_url()`. Throws `NoUrlAvailableException` when
	 * nothing satisfies the combination of options.
	 */
	getUrl(options: RemoteAccessGetUrlOptions = {}): string {
		const {
			requireHttps = false,
			requirePublic = false,
			allowInternal = true,
			allowExternal = true,
			preferExternal = false,
		} = options;

		const { internal, external } = this.getUrls();

		const tryInternal = (): string | null => {
			// The internal URL is always private-scope: it can never satisfy requirePublic.
			if (!allowInternal || requirePublic) {
				return null;
			}

			if (requireHttps && !internal.startsWith('https:')) {
				return null;
			}

			return internal;
		};

		const tryExternal = (): string | null => {
			if (!allowExternal) {
				return null;
			}

			const match = external.find(
				(endpoint) => (!requireHttps || endpoint.https) && (!requirePublic || endpoint.scope === 'public'),
			);

			return match?.url ?? null;
		};

		const order = preferExternal ? [tryExternal, tryInternal] : [tryInternal, tryExternal];

		for (const attempt of order) {
			const result = attempt();

			if (result) {
				return result;
			}
		}

		throw new NoUrlAvailableException('No URL is available that satisfies the requested constraints.');
	}

	/**
	 * Display-only candidates for reaching the internal URL: non-internal LAN
	 * IPv4/IPv6 addresses and `http://<hostname>.local:<port>`. Never throws,
	 * during bootstrap or a request — a detection failure just yields fewer
	 * candidates.
	 */
	async getCandidates(): Promise<string[]> {
		// The actual bound port, regardless of any `internal_url` override
		// (which relabels how the server is reached, not where it listens).
		const port = getEnvValue<number>(this.nestConfigService, 'FB_BACKEND_PORT', 3000);
		const candidates: string[] = [];

		try {
			const interfaces = await si.networkInterfaces();
			const list = Array.isArray(interfaces) ? interfaces : [interfaces];

			for (const iface of list) {
				if (iface.internal) {
					continue;
				}

				if (iface.ip4) {
					candidates.push(`http://${iface.ip4}:${port}`);
				}

				// fe80::/10 (link-local) is scoped to a single interface and unreachable
				// from anywhere it'd be dialled back from; a prefix check like
				// startsWith('fe80') would miss most of that range (fe81:: .. febf::).
				if (iface.ip6 && !isIpInCidr(iface.ip6, 'fe80::/10')) {
					candidates.push(`http://[${iface.ip6}]:${port}`);
				}
			}
		} catch (error) {
			const err = error instanceof Error ? error : new Error('Unknown network interface detection error');

			this.logger.warn('Failed to detect LAN network interfaces for URL candidates', {
				message: err.message,
				stack: err.stack,
			});
		}

		try {
			candidates.push(`http://${os.hostname()}.local:${port}`);
		} catch (error) {
			const err = error instanceof Error ? error : new Error('Unknown hostname detection error');

			this.logger.warn('Failed to detect the local hostname for a URL candidate', {
				message: err.message,
				stack: err.stack,
			});
		}

		return candidates;
	}

	/** Recomputes the snapshot and emits `URLS_CHANGED` only when it differs from the last one. */
	refresh(): void {
		const next = this.getUrls();

		if (this.lastSnapshot && this.snapshotsEqual(this.lastSnapshot, next)) {
			return;
		}

		this.lastSnapshot = next;

		this.eventEmitter.emit(EventType.URLS_CHANGED, {
			internal: next.internal,
			external: next.external,
			primaryExternalUrl: next.primaryExternalUrl,
		});
	}

	@OnEvent(EventType.PROVIDER_STATUS)
	onProviderStatus(): void {
		this.refresh();
	}

	@OnEvent(ConfigEventType.CONFIG_UPDATED)
	onConfigUpdated(event: ConfigUpdatedEvent): void {
		// A provider plugin being enabled or disabled changes which endpoints exist.
		if (event.type === 'plugin' && this.statusService.hasProvider(event.source)) {
			this.refresh();

			return;
		}

		if (event.type !== 'module' || event.source !== REMOTE_ACCESS_MODULE_NAME) {
			return;
		}

		this.refresh();
	}

	private resolveInternalUrl(config: RemoteAccessConfigModel): string {
		if (config.internalUrl) {
			return config.internalUrl;
		}

		const host = getEnvValue<string>(this.nestConfigService, 'FB_APP_HOST', 'http://localhost');
		const port = getEnvValue<number>(this.nestConfigService, 'FB_BACKEND_PORT', 3000);

		return `${host}:${port}`;
	}

	private collectExternalEndpoints(config: RemoteAccessConfigModel): RemoteAccessEndpoint[] {
		const endpoints: RemoteAccessEndpoint[] = [];

		if (config.externalUrl) {
			endpoints.push({
				url: config.externalUrl,
				scope: 'public',
				https: config.externalUrl.startsWith('https:'),
				label: 'Manual external URL',
			});
		}

		for (const status of this.statusService.getCachedStatuses()) {
			if (status.state !== 'connected') {
				continue;
			}

			endpoints.push(...status.endpoints);
		}

		return endpoints;
	}

	/** HTTPS before HTTP, public before private, then original (registration) order. */
	private rank(endpoints: RemoteAccessEndpoint[]): RemoteAccessEndpoint[] {
		return endpoints
			.map((endpoint, index) => ({ endpoint, index }))
			.sort((a, b) => {
				if (a.endpoint.https !== b.endpoint.https) {
					return a.endpoint.https ? -1 : 1;
				}

				const aPublic = a.endpoint.scope === 'public';
				const bPublic = b.endpoint.scope === 'public';

				if (aPublic !== bPublic) {
					return aPublic ? -1 : 1;
				}

				return a.index - b.index;
			})
			.map((entry) => entry.endpoint);
	}

	private snapshotsEqual(a: RemoteAccessUrlsSnapshot, b: RemoteAccessUrlsSnapshot): boolean {
		return (
			a.internal === b.internal &&
			a.primaryExternalUrl === b.primaryExternalUrl &&
			JSON.stringify(a.external) === JSON.stringify(b.external)
		);
	}
}
