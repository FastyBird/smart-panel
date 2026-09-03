// Single identity for this plugin, used for everything: matches the backend's
// `RemoteAccessTailscalePluginDataConfig.type`, `ExtensionsService.registerPluginMetadata({ type
// })`, `TailscaleProviderService.type`, and therefore the `type` field of every
// `RemoteAccessModuleDataProvider` / `RemoteAccessModule.Provider.Status` /
// `RemoteAccessModule.Setup.Progress` payload too (backend fix #936, "report the Tailscale
// provider under its plugin name" - the provider identity used to be the shorter route prefix,
// which briefly required two separate `IPlugin` registrations here; the backend now reports the
// plugin name everywhere, so `remote-access-tailscale.plugin.ts` registers exactly one `IPlugin`
// with two elements). Found by `Config → Plugins`/`useConfigPluginEditForm`/`usePlugin({ name:
// config.type })` and by the remote-access module's `useRemoteAccessProviders.getElement()`
// (`IPlugin.type === provider.type`) alike.
export const REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME = 'remote-access-tailscale-plugin';

// HTTP route prefix only - `/plugins/remote-access-tailscale/*` - unrelated to any plugin/provider
// identity now (see `REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME` above).
export const REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX = 'remote-access-tailscale';

// `useTailscaleLogin`: poll `GET /status` at this interval while the node is `pending-auth`.
export const TAILSCALE_LOGIN_POLL_INTERVAL_MS = 3_000;

// `useTailscaleLogin`: give up polling after this long even if the node never leaves
// `pending-auth` (matches the CLI's own `--timeout=10m` on the interactive sign-in).
export const TAILSCALE_LOGIN_POLL_TIMEOUT_MS = 10 * 60 * 1000;
