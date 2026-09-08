// Single identity for this plugin, used for everything: matches the backend's
// `RemoteAccessCloudflareTunnelPluginDataConfig.type`, `ExtensionsService.registerPluginMetadata({
// type })`, `CloudflareTunnelProviderService.type`, and therefore the `type` field of every
// `RemoteAccessModuleDataProvider` / `RemoteAccessModule.Provider.Status` /
// `RemoteAccessModule.Setup.Progress` payload too - mirrors
// `REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME`'s own doc comment. Found by `Config →
// Plugins`/`useConfigPluginEditForm`/`usePlugin({ name: config.type })` and by the remote-access
// module's `useRemoteAccessProviders.getElement()` (`IPlugin.type === provider.type`) alike.
export const REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME = 'remote-access-cloudflare-tunnel-plugin';

// HTTP route prefix only - `/plugins/remote-access-cloudflare-tunnel/*` - unrelated to any
// plugin/provider identity (see `REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME` above).
export const REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_PREFIX = 'remote-access-cloudflare-tunnel';

// `useCloudflareTunnelSetup`: poll `GET /status` at this interval while a privileged setup job's
// `state` is `running` - a fallback to the `RemoteAccessModule.Setup.Progress` websocket event so
// a lost websocket or a page reload never strands the wizard's spinner. Mirrors
// `TAILSCALE_SETUP_POLL_INTERVAL_MS`.
export const CLOUDFLARE_TUNNEL_SETUP_POLL_INTERVAL_MS = 3_000;
