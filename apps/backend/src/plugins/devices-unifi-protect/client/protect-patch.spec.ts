import { readFileSync } from 'fs';
import { join, resolve } from 'path';

import { PROTECT_PATCHABLE_FIELDS, PROTECT_PATCH_RESOURCES, isAllowedProtectPatch } from './protect-patch';

const FIXTURE = JSON.parse(readFileSync(join(resolve(__dirname, '../__fixtures__'), 'device-patch.json'), 'utf8')) as {
	camera: { request: Record<string, unknown> };
	light: { request: Record<string, unknown> };
};

describe('isAllowedProtectPatch', () => {
	it('lists the writable resources and leaves', () => {
		expect(PROTECT_PATCH_RESOURCES).toEqual(['cameras', 'lights']);
		expect(PROTECT_PATCHABLE_FIELDS.cameras).toEqual(['ledSettings.isEnabled', 'micVolume']);
	});

	it.each([
		['cameras', { ledSettings: { isEnabled: true } }],
		['cameras', { micVolume: 60 }],
		['cameras', { micVolume: 0 }],
		['cameras', { micVolume: 100 }],
		['lights', { isLightForceEnabled: false, lightDeviceSettings: { ledLevel: 6, isIndicatorEnabled: true } }],
	] as const)('accepts %s %j', (resource, body) => {
		expect(isAllowedProtectPatch(resource, body)).toBe(true);
	});

	it.each([
		['cameras', {}],
		['cameras', { isMicEnabled: false }],
		['cameras', { ledSettings: { isEnabled: true, floodLed: true } }],
		['cameras', { micVolume: '60' }],
		['cameras', { micVolume: 1.5 }],
		['cameras', { micVolume: 101 }],
		['cameras', { micVolume: -1 }],
		['cameras', { ledSettings: true }],
		['cameras', { ledSettings: { isEnabled: { deep: true } } }],
		['cameras', null],
		['cameras', [{ micVolume: 1 }]],
		['lights', { lightDeviceSettings: { ledLevel: 3, pirSensitivity: 50 } }],
		['lights', { name: 'x' }],
		['sensors', { mountType: 'door' }],
		['lights', { isLightForceEnabled: 7 }],
		['lights', { isLightForceEnabled: 1 }],
		['cameras', { micVolume: true }],
		['cameras', { ledSettings: { isEnabled: 1 } }],
		['lights', { lightDeviceSettings: { ledLevel: 0 } }],
		['lights', { lightDeviceSettings: { ledLevel: 7 } }],
		['lights', { lightDeviceSettings: { ledLevel: true } }],
		['lights', { lightDeviceSettings: { isIndicatorEnabled: 1 } }],
		['cameras', { 'ledSettings.isEnabled': true }],
		['lights', { 'lightDeviceSettings.ledLevel': 3 }],
		['lights', JSON.parse('{"__proto__":{"isLightForceEnabled":true}}') as unknown],
	] as const)('refuses %s %j', (resource, body) => {
		expect(isAllowedProtectPatch(resource as never, body)).toBe(false);
	});

	it('matches the documented synthetic request shapes', () => {
		expect(isAllowedProtectPatch('cameras', FIXTURE.camera.request)).toBe(true);
		expect(isAllowedProtectPatch('lights', FIXTURE.light.request)).toBe(true);
	});
});
