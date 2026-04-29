import { describe, expect, it, vi } from 'vitest';

import { RouteNames } from '../devices.constants';

import { ModuleRoutes } from './index';

vi.mock('../../../locales', () => ({
	default: {
		global: {
			t: (key: string) => key,
		},
	},
}));

vi.mock('../../../openapi.constants', () => ({
	UsersModuleUserRole: {
		admin: 'admin',
		owner: 'owner',
	},
}));

vi.mock('../devices.constants', () => ({
	RouteNames: {
		DEVICES: 'devices',
		DEVICES_ADD: 'devices-add',
		DEVICES_EDIT: 'devices-edit',
		DEVICES_WIZARD: 'devices-wizard',
		DEVICE: 'device',
		DEVICE_EDIT: 'device-edit',
		DEVICE_CONTROL: 'device-control',
		DEVICE_ADD_CHANNEL: 'device-add-channel',
		DEVICE_EDIT_CHANNEL: 'device-edit-channel',
		DEVICE_CHANNEL_ADD_PROPERTY: 'device-channel-add-property',
		DEVICE_CHANNEL_EDIT_PROPERTY: 'device-channel-edit-property',
		CHANNELS: 'channels',
		CHANNELS_ADD: 'channels-add',
		CHANNELS_EDIT: 'channels-edit',
		CHANNEL: 'channel',
		CHANNEL_EDIT: 'channel-edit',
		CHANNEL_ADD_PROPERTY: 'channel-add-property',
		CHANNEL_EDIT_PROPERTY: 'channel-edit-property',
	},
}));

describe('devices module routes', () => {
	it('requires a plugin type for the devices wizard route', () => {
		const devicesRoute = ModuleRoutes.find((route) => route.name === RouteNames.DEVICES);
		const wizardRoute = devicesRoute?.children?.find((route) => route.name === RouteNames.DEVICES_WIZARD);

		expect(wizardRoute?.path).toBe('wizard/:type');
		expect(wizardRoute?.props).toBe(true);
	});

	it('redirects incomplete wizard paths before the edit route can match them as ids', () => {
		const devicesRoute = ModuleRoutes.find((route) => route.name === RouteNames.DEVICES);
		const children = devicesRoute?.children ?? [];
		const editIndex = children.findIndex((route) => route.name === RouteNames.DEVICES_EDIT);
		const wizardFallbackIndex = children.findIndex((route) => route.path === 'wizard');

		expect(wizardFallbackIndex).toBeGreaterThanOrEqual(0);
		expect(wizardFallbackIndex).toBeLessThan(editIndex);
		expect(children[wizardFallbackIndex]?.redirect).toEqual({ name: RouteNames.DEVICES });
	});
});
