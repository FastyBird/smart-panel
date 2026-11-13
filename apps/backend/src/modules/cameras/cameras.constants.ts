export const CAMERAS_MODULE_PREFIX = 'cameras';

export const CAMERAS_MODULE_NAME = 'cameras-module';

export const CAMERAS_MODULE_API_TAG_NAME = 'Cameras module';

export const CAMERAS_MODULE_API_TAG_DESCRIPTION =
	'Endpoints for listing cameras, fetching snapshots and opening live view sessions.';

export enum EventType {
	SESSION_REVOKED = 'CamerasModule.Session.Revoked',
}
