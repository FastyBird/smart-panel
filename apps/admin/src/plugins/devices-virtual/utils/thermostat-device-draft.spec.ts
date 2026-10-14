import { describe, expect, it } from 'vitest';

import { DevicesModuleChannelCategory as Channel, DevicesModuleChannelPropertyPermissions as Permission } from '../../../openapi.constants';

import { thermostatDeviceDraft } from './thermostat-device-draft';

describe('thermostat atomic create graph', () => {
	it('creates only the requested comfort branch with all command registrations and reported status', () => {
		const { device, settings } = thermostatDeviceDraft('Hall', true, false);
		expect(device.channels?.map((channel) => channel.category)).toEqual([
			Channel.temperature, Channel.thermostat, Channel.device_information, Channel.heater,
		]);
		expect(settings.map((setting) => setting.setting)).toEqual(['locked', 'heating_enabled', 'heating_setpoint']);
		const properties = device.channels?.flatMap((channel) => channel.properties ?? []) ?? [];
		expect(properties.every((property) => property.permissions.length === 1 && property.permissions[0] === Permission.ro)).toBe(true);
		expect(new Set([device.id, ...device.channels!.map((channel) => channel.id), ...properties.map((property) => property.id)]).size)
			.toBe(1 + device.channels!.length + properties.length);
		expect(device.channels?.find((channel) => channel.category === Channel.heater)?.properties?.map((property) => property.category))
			.toEqual(['on', 'temperature', 'status']);
	});
});
