export const REMOTE_ACCESS_MODULE_PREFIX = 'remote-access';

export const REMOTE_ACCESS_MODULE_NAME = 'remote-access-module';

export const REMOTE_ACCESS_MODULE_API_TAG_NAME = 'Remote access module';

export const REMOTE_ACCESS_MODULE_API_TAG_DESCRIPTION =
	'Endpoints for the internal/external URL registry, remote-access provider status and posture advisories.';

/**
 * Upper bound on a single `provider.getStatus()` call during aggregation.
 * `getAggregatedStatuses()` uses `Promise.all`, so one provider that never
 * settles would otherwise hang the whole aggregate forever; a deadline race
 * (not a real cancellation — the contract has no abort signal) converts a
 * timed-out provider into the same synthesized `error` status used for a
 * rejection, so aggregation always completes.
 */
export const REMOTE_ACCESS_PROVIDER_STATUS_TIMEOUT_MS = 5000;

export enum EventType {
	PROVIDER_STATUS = 'RemoteAccessModule.Provider.Status',
	URLS_CHANGED = 'RemoteAccessModule.Urls.Changed',
	// Consumed by RA-3/RA-5's privileged setup jobs; no emitter exists yet in this module.
	SETUP_PROGRESS = 'RemoteAccessModule.Setup.Progress',
}
