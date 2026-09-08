import { Injectable } from '@nestjs/common';

import {
	IRemoteAccessProvider,
	RemoteAccessProviderCapabilities,
	RemoteAccessProviderKind,
	RemoteAccessProviderStatus,
} from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import { REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME } from '../remote-access-cloudflare-tunnel.constants';

import { CloudflareTunnelManagedService } from './cloudflare-tunnel-managed.service';

/**
 * `IRemoteAccessProvider` adapter registered with `RemoteAccessProviderRegistryService`. All the
 * actual runtime state lives in `CloudflareTunnelManagedService`; this class only exposes the
 * static provider metadata and delegates `getStatus()` to it — mirrors `TailscaleProviderService`.
 */
@Injectable()
export class CloudflareTunnelProviderService implements IRemoteAccessProvider {
	readonly type = REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME;
	readonly kind: RemoteAccessProviderKind = 'tunnel';
	readonly capabilities: RemoteAccessProviderCapabilities = {
		https: true,
		publicUrl: true,
		identityHeaders: false,
		ssh: false,
	};

	constructor(private readonly tunnelManagedService: CloudflareTunnelManagedService) {}

	getStatus(): Promise<RemoteAccessProviderStatus> {
		return this.tunnelManagedService.computeStatus();
	}
}
