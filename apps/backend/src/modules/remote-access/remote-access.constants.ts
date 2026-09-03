export const REMOTE_ACCESS_MODULE_PREFIX = 'remote-access';

export const REMOTE_ACCESS_MODULE_NAME = 'remote-access-module';

export const REMOTE_ACCESS_MODULE_API_TAG_NAME = 'Remote access module';

export const REMOTE_ACCESS_MODULE_API_TAG_DESCRIPTION =
	'Endpoints for the internal/external URL registry, remote-access provider status and posture advisories.';

export enum EventType {
	PROVIDER_STATUS = 'RemoteAccessModule.Provider.Status',
	URLS_CHANGED = 'RemoteAccessModule.Urls.Changed',
	// Consumed by RA-3/RA-5's privileged setup jobs; no emitter exists yet in this module.
	SETUP_PROGRESS = 'RemoteAccessModule.Setup.Progress',
}
