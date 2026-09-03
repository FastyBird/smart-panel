import { Injectable } from '@nestjs/common';

import {
	RemoteAccessEndpoint,
	RemoteAccessProviderState,
} from '../../../modules/remote-access/platforms/remote-access-provider.platform';

import { TailscaleBackendState, TailscaleStatus } from './tailscale-cli.service';

export interface TailscaleMappedStatus {
	state: RemoteAccessProviderState;
	endpoints: RemoteAccessEndpoint[];
	message?: string;
	details: Record<string, string | number | boolean | null>;
	/** Always empty — Serve's loopback proxy declaration is RA-6's responsibility. */
	proxyAddresses: string[];
}

/** `BackendState` values reached before the node has ever completed sign-in. */
const STATES_WITHOUT_KEY: ReadonlySet<TailscaleBackendState> = new Set(['NoState', 'NeedsLogin']);

/**
 * Interprets a parsed `tailscale status --json` document (see
 * `TailscaleCliService`) into the generic `RemoteAccessProviderStatus` shape:
 * connection state, published endpoints and display-safe details. Serve/
 * Funnel endpoints and advisories are RA-6's responsibility — this mapper
 * only ever produces the private IPv4 and MagicDNS HTTP endpoints.
 */
@Injectable()
export class TailscaleStatusMapperService {
	map(status: TailscaleStatus, options: { port: number }): TailscaleMappedStatus {
		const state = this.mapState(status);

		return {
			state,
			endpoints: state === 'connected' ? this.buildEndpoints(status, options.port) : [],
			message: this.buildMessage(status, state),
			details: this.buildDetails(status),
			proxyAddresses: [],
		};
	}

	/** Whether this node has ever completed sign-in, regardless of whether it is currently connected. */
	hasExistingKey(status: TailscaleStatus): boolean {
		return !STATES_WITHOUT_KEY.has(status.BackendState);
	}

	private mapState(status: TailscaleStatus): RemoteAccessProviderState {
		switch (status.BackendState) {
			case 'NeedsLogin':
				return status.AuthURL ? 'pending-auth' : 'setup-required';
			case 'NeedsMachineAuth':
				return 'pending-approval';
			case 'Starting':
				return 'connecting';
			case 'Running':
				return status.Self?.Online ? 'connected' : 'connecting';
			case 'Stopped':
				return 'disconnected';
			case 'NoState':
				// Transient: the backend has not finished loading preferences yet.
				return 'connecting';
			case 'InUseOtherUser':
			default:
				return 'error';
		}
	}

	private buildMessage(status: TailscaleStatus, state: RemoteAccessProviderState): string | undefined {
		switch (state) {
			case 'pending-auth':
				return 'Sign-in approval is pending. Open the sign-in link to continue.';
			case 'pending-approval':
				return 'Waiting for this device to be approved in the tailnet admin console.';
			case 'setup-required':
				return status.BackendState === 'NeedsLogin' ? 'Tailscale needs to sign in again.' : undefined;
			case 'error':
				return `Tailscale reported an unexpected backend state: ${status.BackendState}.`;
			default:
				return undefined;
		}
	}

	private buildEndpoints(status: TailscaleStatus, port: number): RemoteAccessEndpoint[] {
		const endpoints: RemoteAccessEndpoint[] = [];
		const ipv4 = this.findIp(status, (ip) => ip.includes('.'));

		if (ipv4) {
			endpoints.push({ url: `http://${ipv4}:${port}`, scope: 'private', https: false, label: 'Tailscale IPv4' });
		}

		const dnsName = this.stripTrailingDot(status.Self?.DNSName);

		if (status.CurrentTailnet?.MagicDNSEnabled && dnsName) {
			endpoints.push({
				url: `http://${dnsName}:${port}`,
				scope: 'private',
				https: false,
				label: 'Tailscale (MagicDNS)',
			});
		}

		return endpoints;
	}

	private buildDetails(status: TailscaleStatus): Record<string, string | number | boolean | null> {
		const ipv4 = this.findIp(status, (ip) => ip.includes('.'));
		const ipv6 = this.findIp(status, (ip) => ip.includes(':'));
		const healthWarnings = status.Health && status.Health.length > 0 ? status.Health.join('; ') : null;
		const capMap = status.Self?.CapMap ?? {};

		return {
			tailnet: status.CurrentTailnet?.Name ?? null,
			dnsName: this.stripTrailingDot(status.Self?.DNSName) ?? null,
			ipv4: ipv4 ?? null,
			ipv6: ipv6 ?? null,
			version: status.Version ?? null,
			healthWarnings,
			keyExpiresAt: status.Self?.KeyExpiry ?? null,
			// Whether the tailnet grants this node the `https`/`funnel` ACL
			// capability — read by RA-6's TailscaleServeService from the raw
			// status directly; surfaced here too, display-only, so the admin
			// can see why Serve/Funnel is unavailable before toggling it.
			httpsCapable: Object.hasOwn(capMap, 'https'),
			funnelCapable: Object.hasOwn(capMap, 'funnel'),
			certDomains: status.CertDomains && status.CertDomains.length > 0 ? status.CertDomains.join(', ') : null,
		};
	}

	private findIp(status: TailscaleStatus, predicate: (ip: string) => boolean): string | undefined {
		const ips = status.Self?.TailscaleIPs ?? status.TailscaleIPs ?? [];

		return ips.find(predicate);
	}

	private stripTrailingDot(name?: string): string | undefined {
		return name ? name.replace(/\.$/, '') : undefined;
	}
}
