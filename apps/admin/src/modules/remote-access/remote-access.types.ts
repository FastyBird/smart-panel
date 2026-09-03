/*
eslint-disable @typescript-eslint/no-empty-object-type
*/
import type { ComponentOptionsMixin, DefineComponent } from 'vue';

import type { IRemoteAccessProvider } from './store/remote-access-status.store.types';

// Contract every remote access provider plugin's card component implements. Rendered by
// `provider-cards.vue` for the entry in `RemoteAccessModuleDataStatus.providers` whose `type`
// matches the owning plugin's own `IPlugin.type`.
export interface IRemoteAccessProviderCardProps {
	provider: IRemoteAccessProvider;
}

// Provider plugins (Tailscale, and later Cloudflare Tunnel / WireGuard) register an element of
// this shape under `type: REMOTE_ACCESS_MODULE_PROVIDER_TYPE`. `providerSetup` is only ever
// rendered by the plugin's own setup views, never by this module - kept loosely typed here since
// its concrete props belong to whichever plugin defines them.
export type IRemoteAccessProviderPluginsComponents = {
	providerCard?: DefineComponent<IRemoteAccessProviderCardProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}>;
	providerSetup?: DefineComponent<{}, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}>;
};
