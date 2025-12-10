export const DISPLAYS_MODULE_NAME = 'displays';
export const DISPLAYS_MODULE_PREFIX = 'displays-module';
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
}

export const ALLOWED_USER_AGENTS = ['FastyBird Smart Panel', 'FastyBird-Display'];
