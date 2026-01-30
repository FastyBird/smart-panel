export const SECURITY_MODULE_PREFIX = 'security';

export const SECURITY_MODULE_NAME = 'security-module';

export const SECURITY_MODULE_API_TAG_NAME = 'Security module';

export const SECURITY_MODULE_API_TAG_DESCRIPTION =
	'A collection of endpoints that provide security-related functionalities, such as retrieving armed state, alarm state, and active alerts.';

export const SECURITY_STATE_PROVIDERS = Symbol('SECURITY_STATE_PROVIDERS');

export enum ArmedState {
	DISARMED = 'disarmed',
	ARMED_HOME = 'armed_home',
	ARMED_AWAY = 'armed_away',
	ARMED_NIGHT = 'armed_night',
}

export enum AlarmState {
	IDLE = 'idle',
	PENDING = 'pending',
	TRIGGERED = 'triggered',
	SILENCED = 'silenced',
}

export enum Severity {
	INFO = 'info',
	WARNING = 'warning',
	CRITICAL = 'critical',
}
