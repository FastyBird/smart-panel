import { Injectable } from '@nestjs/common';

import {
	IRemoteAccessProvider,
	RemoteAccessProviderCapabilities,
	RemoteAccessProviderKind,
	RemoteAccessProviderStatus,
} from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import { REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME } from '../remote-access-tailscale.constants';

import { TailscaleNodeManagedService } from './tailscale-node-managed.service';

/**
 * `IRemoteAccessProvider` adapter registered with
 * `RemoteAccessProviderRegistryService`. All the actual runtime state lives
 * in `TailscaleNodeManagedService` (the managed service already computes and
 * polls live status); this class only exposes the static provider metadata
 * and delegates `getStatus()` to it, so the two never duplicate the CLI +
 * mapper composition.
 */
@Injectable()
export class TailscaleProviderService implements IRemoteAccessProvider {
	readonly type = REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME;
	readonly kind: RemoteAccessProviderKind = 'mesh';
	readonly capabilities: RemoteAccessProviderCapabilities = {
		https: true,
		publicUrl: true,
		identityHeaders: true,
		ssh: true,
	};

	constructor(private readonly nodeManagedService: TailscaleNodeManagedService) {}

	getStatus(): Promise<RemoteAccessProviderStatus> {
		return this.nodeManagedService.computeStatus();
	}
}
