export const REMOTE_ACCESS_MODULE_PREFIX = 'remote-access';

export const REMOTE_ACCESS_MODULE_NAME = 'remote-access-module';

export const REMOTE_ACCESS_MODULE_API_TAG_NAME = 'Remote access module';

export const REMOTE_ACCESS_MODULE_API_TAG_DESCRIPTION =
	'Endpoints for the internal/external URL registry, remote-access provider status and posture advisories.';

/** Deadline for a coalesced observation. Abort is requested on expiry; ownership remains until it settles. */
export const REMOTE_ACCESS_PROVIDER_STATUS_TIMEOUT_MS = 7000;

/**
 * How long `RemoteAccessProxyContributionService` waits before retrying a
 * `getModuleConfig()` call that previously threw. A failed read is
 * fail-closed (contributes no trusted proxies) but must not memoise that
 * `[]` the same way a valid empty result is memoised — otherwise recovery
 * depends entirely on a `CONFIG_UPDATED`/`PROVIDER_STATUS` event happening
 * to arrive, which is not guaranteed. This bounds how stale a "the config
 * store is broken" state can get without one.
 */
export const REMOTE_ACCESS_CONFIG_READ_RETRY_INTERVAL_MS = 30_000;

export enum EventType {
	/** Internal unversioned provider observation; only the status service consumes this. */
	PROVIDER_OBSERVATION = 'RemoteAccessModule.Provider.Observation',
	/** Accepted, versioned publication; the cache is committed before this event is emitted. */
	PROVIDER_STATUS = 'RemoteAccessModule.Provider.Status',
	URLS_CHANGED = 'RemoteAccessModule.Urls.Changed',
	// Consumed by RA-3/RA-5's privileged setup jobs; no emitter exists yet in this module.
	SETUP_PROGRESS = 'RemoteAccessModule.Setup.Progress',
}
