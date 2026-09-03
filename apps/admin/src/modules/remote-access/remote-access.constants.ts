export const REMOTE_ACCESS_MODULE_PREFIX = 'remote-access';

export const REMOTE_ACCESS_MODULE_NAME = 'remote-access-module';

export const REMOTE_ACCESS_MODULE_EVENT_PREFIX = 'RemoteAccessModule.';

// Well-known plugin element `type`, mirroring `CONFIG_MODULE_MODULE_TYPE`: every remote access
// provider plugin (Tailscale, and later Cloudflare Tunnel / WireGuard) registers its provider card
// under this element type, scoped to this module through `modules: [REMOTE_ACCESS_MODULE_NAME]`.
// The plugin itself is identified separately by `IPlugin.type` (e.g. `remote-access-tailscale`),
// which is matched against `RemoteAccessModuleDataProvider.type` from the status payload.
export const REMOTE_ACCESS_MODULE_PROVIDER_TYPE = 'provider';

export enum EventType {
	PROVIDER_STATUS = 'RemoteAccessModule.Provider.Status',
	URLS_CHANGED = 'RemoteAccessModule.Urls.Changed',
	SETUP_PROGRESS = 'RemoteAccessModule.Setup.Progress',
}

export enum RouteNames {
	REMOTE_ACCESS = 'remote_access_module-module',
}
