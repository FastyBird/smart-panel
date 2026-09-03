// Config/extension identity - matches the backend's `RemoteAccessTailscalePluginDataConfig.type`
// and `ExtensionsService.registerPluginMetadata({ type })`. Every admin plugin registers its
// top-level `IPlugin.type` under this identity so it is found by `Config → Plugins` and by
// `useConfigPluginEditForm`/`usePlugin({ name: config.type })`.
export const REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME = 'remote-access-tailscale-plugin';

// Route prefix AND remote-access provider identity - mirrors the backend's own
// `REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX`, which is used for exactly the same two things there:
// the `/plugins/remote-access-tailscale/*` route prefix, and `TailscaleProviderService.type`
// (so it is also the `type` field of every `RemoteAccessModuleDataProvider` /
// `RemoteAccessModule.Provider.Status` payload). A second, separate `IPlugin` entry is
// registered under this identity because `useRemoteAccessProviders.getElement()` (remote-access
// module, already merged) matches a provider's owning plugin by `IPlugin.type === provider.type`
// directly - it does not look at an element's own `type`, unlike the devices module's plugin
// lookups. See `remote-access-tailscale.plugin.ts` for both registrations.
export const REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX = 'remote-access-tailscale';

// `RemoteAccessModule.Setup.Progress` events carry this as their `type` field (the plugin
// identity, not the provider identity - see `TailscaleSetupProgressEvent` on the backend).
export const REMOTE_ACCESS_TAILSCALE_SETUP_EVENT_TYPE = REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME;

// `useTailscaleLogin`: poll `GET /status` at this interval while the node is `pending-auth`.
export const TAILSCALE_LOGIN_POLL_INTERVAL_MS = 3_000;

// `useTailscaleLogin`: give up polling after this long even if the node never leaves
// `pending-auth` (matches the CLI's own `--timeout=10m` on the interactive sign-in).
export const TAILSCALE_LOGIN_POLL_TIMEOUT_MS = 10 * 60 * 1000;
