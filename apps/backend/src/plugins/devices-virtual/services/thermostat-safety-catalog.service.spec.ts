import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { SUPERVISED_SWITCH_PROFILE } from '../contracts/thermostat-actuation.contract';

import {
	ThermostatSafetyCatalog,
	ThermostatSafetyExtension,
	ThermostatTarget,
} from './thermostat-safety-catalog.service';

describe('thermostat safety catalog', () => {
	const target = { device: new DeviceEntity(), channel: new ChannelEntity(), property: new ChannelPropertyEntity() };
	const extension = (id: string): ThermostatSafetyExtension => ({
		offer: { id, version: 1, name: id, roles: ['cooling'], requires_cooling_protection: true, installation_path: null },
		qualificationTables: ['fixture_protection'],
		supports: (candidate: ThermostatTarget) => candidate.device === target.device,
		describe: () =>
			Promise.resolve({
				candidates: [],
				reasons: [],
				device_hardware_id: null,
				firmware: null,
				switch_configuration_json: null,
			}),
	});

	it('advertises a device-owned extension only for matching targets, role and policy', () => {
		const catalog = new ThermostatSafetyCatalog();
		const fixture = extension('test.remote-surface');
		const dispose = catalog.register(fixture);
		expect(catalog.offers(target)).toEqual([fixture.offer]);
		expect(catalog.offers(target, 'cooling', true)).toEqual([fixture.offer]);
		expect(catalog.offers(target, 'heating', true)).toEqual([]);
		expect(catalog.offers(target, 'cooling', false)).toEqual([]);
		expect(catalog.offers({ ...target, device: new DeviceEntity() })).toEqual([]);
		expect(catalog.invalidatesQualification('fixture_protection')).toBe(true);
		expect(() => catalog.register(fixture)).toThrow('already registered');
		dispose();
		expect(catalog.offers(target)).toEqual([]);
		expect(catalog.invalidatesQualification('fixture_protection')).toBe(false);
		catalog.register(extension(fixture.offer.id));
		dispose();
		expect(catalog.offers(target)).toHaveLength(1);
	});

	it('reserves the built-in supervised profile for software control', () => {
		expect(() => new ThermostatSafetyCatalog().register(extension(SUPERVISED_SWITCH_PROFILE))).toThrow('Invalid');
	});
});
