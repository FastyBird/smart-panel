import { FieldType, ISchemaOptions } from 'influx';

export const DISPLAYS_MODULE_NAME = 'displays-module';
export const DISPLAYS_MODULE_PREFIX = 'displays';
export const DISPLAYS_MODULE_API_TAG_NAME = 'Displays module';
export const DISPLAYS_MODULE_API_TAG_DESCRIPTION =
	'Endpoints related to display device registration, authentication, and configuration management. ' +
	'This module handles the lifecycle of Smart Panel display devices, including initial registration, ' +
	'token management, and display-specific settings like brightness, dark mode, screen saver, and audio configuration.';

export enum EventType {
	DISPLAY_CREATED = 'DisplaysModule.Display.Created',
	DISPLAY_UPDATED = 'DisplaysModule.Display.Updated',
	DISPLAY_DELETED = 'DisplaysModule.Display.Deleted',
	DISPLAY_RESET = 'DisplaysModule.Display.Reset',
	DISPLAY_TOKEN_REVOKED = 'DisplaysModule.Display.TokenRevoked',
}

export const ALLOWED_USER_AGENTS = ['FastyBird Smart Panel', 'FastyBird-Display'];

export enum DeploymentMode {
	STANDALONE = 'standalone',
	ALL_IN_ONE = 'all-in-one',
	COMBINED = 'combined',
}

export const PERMIT_JOIN_DEFAULT_DURATION_MS = 2 * 60 * 1000; // 2 minutes
export const LOCALHOST_IPS = ['127.0.0.1', '::1', 'localhost'];

export enum ConnectionState {
	CONNECTED = 'connected',
	DISCONNECTED = 'disconnected',
	LOST = 'lost',
	UNKNOWN = 'unknown',
}

export enum HomeMode {
	AUTO_SPACE = 'auto_space',
	EXPLICIT = 'explicit',
	FIRST_PAGE = 'first_page',
}

export const OnlineDisplayState = [ConnectionState.CONNECTED];

export const DisplayStatusInfluxDbSchema: ISchemaOptions = {
	measurement: 'display_status',
	fields: { online: FieldType.BOOLEAN, onlineI: FieldType.INTEGER, status: FieldType.STRING },
	tags: ['displayId'],
};
