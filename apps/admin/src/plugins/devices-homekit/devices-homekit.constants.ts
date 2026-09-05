export const DEVICES_HOMEKIT_PLUGIN_PREFIX = 'devices-homekit';

export const DEVICES_HOMEKIT_PLUGIN_NAME = 'devices-homekit';

export const DEVICES_HOMEKIT_SOURCE = 'com.fastybird.smart-panel.plugin.devices-homekit';

export const DEVICES_HOMEKIT_PLUGIN_EVENT_PREFIX = 'DevicesHomeKitPlugin';

export enum EventType {
	BRIDGE_STATUS_CHANGED = 'DevicesHomeKitPlugin.Bridge.StatusChanged',
}

export const HOMEKIT_FORBIDDEN_PINS = new Set([
	'000-00-000',
	'111-11-111',
	'222-22-222',
	'333-33-333',
	'444-44-444',
	'555-55-555',
	'666-66-666',
	'777-77-777',
	'888-88-888',
	'999-99-999',
	'123-45-678',
	'876-54-321',
]);
