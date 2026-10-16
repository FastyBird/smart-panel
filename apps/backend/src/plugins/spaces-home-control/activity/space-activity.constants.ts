export enum ActivityMode {
	WORK = 'work',
	RELAX = 'relax',
	SLEEP = 'sleep',
	ENTERTAINMENT = 'entertainment',
	AWAY = 'away',
}
export enum ActivityDomain {
	LIGHTING = 'lighting',
	CLIMATE = 'climate',
	COVERS = 'covers',
	MEDIA = 'media',
	SECURITY = 'security',
}
export enum ActivityDomainStatus {
	DISABLED = 'disabled',
	NO_TARGETS = 'no_targets',
	UNSUPPORTED = 'unsupported',
	FAILED = 'failed',
	SUCCEEDED = 'succeeded',
	READY = 'ready',
}
export enum ActivityActivationStatus {
	ACTIVATING = 'activating',
	ACTIVE = 'active',
	PARTIAL = 'partial',
	FAILED = 'failed',
	DEACTIVATED = 'deactivated',
	INTERRUPTED = 'interrupted',
}
export const ACTIVITY_CONFIG_CHANGED = 'SpacesModule.ActivityMode.ConfigChanged';
export const ACTIVITY_STATE_CHANGED = 'SpacesModule.ActivityMode.StateChanged';
