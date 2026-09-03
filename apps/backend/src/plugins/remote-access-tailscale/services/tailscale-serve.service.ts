import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import {
	RemoteAccessAdvisory,
	RemoteAccessEndpoint,
} from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import { RemoteAccessTailscalePluginConfigModel } from '../models/config.model';
import { REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME } from '../remote-access-tailscale.constants';

import { TailscaleCliService, TailscaleServeStatus, TailscaleStatus } from './tailscale-cli.service';

export interface TailscaleServeApplyResult {
	/** `https://<dnsname>` when Serve is active (private, or public once Funnel reads back active too); empty otherwise. */
	endpoints: RemoteAccessEndpoint[];
	/** `['127.0.0.1', '::1']` while Serve is active; empty otherwise. */
	proxyAddresses: string[];
	/** `tailnet-https-disabled`, `funnel-not-allowed`, `public-exposure` — see the class doc. */
	advisories: RemoteAccessAdvisory[];
}

/**
 * Applies and reads back Tailscale Serve (HTTPS on the tailnet) and Funnel
 * (public exposure through Serve) for the `node` managed service's apply
 * step. Called only once the node is `connected` — `Self.CapMap` (the ACL
 * capabilities granted by the control plane) is only meaningful then.
 *
 * Every decision is driven by a fresh `serve status --json` / `funnel status
 * --json` read, both before deciding whether to change anything and again
 * after a mutating call, so the returned endpoints/proxyAddresses/advisories
 * always reflect what Tailscale actually reports — never the wish. A failed
 * read or mutating call is caught and logged; `apply()` itself never throws,
 * so a CLI hiccup degrades this one poll tick's Serve/Funnel contribution
 * instead of failing the whole status computation.
 */
@Injectable()
export class TailscaleServeService {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME, 'TailscaleServeService');

	constructor(private readonly cli: TailscaleCliService) {}

	async apply(
		config: RemoteAccessTailscalePluginConfigModel,
		port: number,
		status: TailscaleStatus,
	): Promise<TailscaleServeApplyResult> {
		const capMap = status.Self?.CapMap ?? {};
		const hasHttpsCap = Object.hasOwn(capMap, 'https');
		const hasFunnelCap = Object.hasOwn(capMap, 'funnel');

		const serveActive = await this.applyServe(config, port, hasHttpsCap);
		const funnelActive = await this.applyFunnel(config, hasFunnelCap);

		const endpoints: RemoteAccessEndpoint[] = [];
		const proxyAddresses: string[] = [];
		const dnsName = this.stripTrailingDot(status.Self?.DNSName);

		if (serveActive && dnsName) {
			endpoints.push({
				url: `https://${dnsName}`,
				scope: funnelActive ? 'public' : 'private',
				https: true,
				label: funnelActive ? 'Tailscale (Funnel)' : 'Tailscale (HTTPS)',
			});
			proxyAddresses.push('127.0.0.1', '::1');
		}

		const advisories: RemoteAccessAdvisory[] = [];

		if (config.serveHttps && !hasHttpsCap) {
			advisories.push({
				code: 'tailnet-https-disabled',
				severity: 'warning',
				message:
					'HTTPS Serve was requested, but this tailnet does not have HTTPS certificates enabled. Enable them at https://login.tailscale.com/admin/dns.',
			});
		}

		if (config.funnel && !hasFunnelCap) {
			advisories.push({
				code: 'funnel-not-allowed',
				severity: 'warning',
				message:
					'Funnel was requested, but this node is not allowed to use it. Grant the `funnel` attribute for this node in the tailnet ACL policy.',
			});
		}

		if (funnelActive) {
			advisories.push({
				code: 'public-exposure',
				severity: 'warning',
				message:
					'This node is publicly reachable through Tailscale Funnel. The Smart Panel login is the only gate — multi-factor authentication is not available.',
			});
		}

		return { endpoints, proxyAddresses, advisories };
	}

	private async applyServe(
		config: RemoteAccessTailscalePluginConfigModel,
		port: number,
		hasHttpsCap: boolean,
	): Promise<boolean> {
		const wantServe = config.serveHttps && hasHttpsCap;

		let serveStatus = await this.readServeStatus();
		let active = this.isServeActive(serveStatus);

		if (wantServe && !active) {
			try {
				await this.cli.serve(port);
				serveStatus = await this.readServeStatus();
				active = this.isServeActive(serveStatus);
			} catch (error) {
				this.logger.warn('Failed to enable Tailscale Serve', {
					message: error instanceof Error ? error.message : String(error),
				});
			}
		} else if (!wantServe && active) {
			try {
				await this.cli.serveReset();
				serveStatus = await this.readServeStatus();
				active = this.isServeActive(serveStatus);
			} catch (error) {
				this.logger.warn('Failed to reset Tailscale Serve', {
					message: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return active;
	}

	private async applyFunnel(config: RemoteAccessTailscalePluginConfigModel, hasFunnelCap: boolean): Promise<boolean> {
		const wantFunnel = config.funnel && hasFunnelCap;

		let funnelStatus = await this.readFunnelStatus();
		let active = this.isFunnelActive(funnelStatus);

		if (wantFunnel && !active) {
			try {
				await this.cli.funnel('on');
				funnelStatus = await this.readFunnelStatus();
				active = this.isFunnelActive(funnelStatus);
			} catch (error) {
				this.logger.warn('Failed to enable Tailscale Funnel', {
					message: error instanceof Error ? error.message : String(error),
				});
			}
		} else if (!wantFunnel && active) {
			try {
				await this.cli.funnel('off');
				funnelStatus = await this.readFunnelStatus();
				active = this.isFunnelActive(funnelStatus);
			} catch (error) {
				this.logger.warn('Failed to disable Tailscale Funnel', {
					message: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return active;
	}

	private async readServeStatus(): Promise<TailscaleServeStatus | null> {
		try {
			return await this.cli.serveStatus();
		} catch (error) {
			this.logger.warn('Failed to read the Tailscale Serve status', {
				message: error instanceof Error ? error.message : String(error),
			});

			return null;
		}
	}

	private async readFunnelStatus(): Promise<TailscaleServeStatus | null> {
		try {
			return await this.cli.funnelStatus();
		} catch (error) {
			this.logger.warn('Failed to read the Tailscale Funnel status', {
				message: error instanceof Error ? error.message : String(error),
			});

			return null;
		}
	}

	private isServeActive(status: TailscaleServeStatus | null): boolean {
		if (!status) {
			return false;
		}

		return Object.keys(status.TCP ?? {}).length > 0 || Object.keys(status.Web ?? {}).length > 0;
	}

	private isFunnelActive(status: TailscaleServeStatus | null): boolean {
		if (!status) {
			return false;
		}

		return Object.values(status.AllowFunnel ?? {}).some(Boolean);
	}

	private stripTrailingDot(name?: string): string | undefined {
		return name ? name.replace(/\.$/, '') : undefined;
	}
}
