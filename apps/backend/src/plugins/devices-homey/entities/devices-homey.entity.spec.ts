import { DEVICES_HOMEY_TYPE } from '../devices-homey.constants';

import { HomeyChannelEntity, HomeyChannelPropertyEntity, HomeyDeviceEntity } from './devices-homey.entity';

describe('Homey entities', () => {
	it('use the Homey discriminator while retaining generic identifiers', () => {
		const device = Object.assign(new HomeyDeviceEntity(), { id: 'device-id', identifier: 'homey-device-id' });
		const channel = Object.assign(new HomeyChannelEntity(), { id: 'channel-id', identifier: 'lighting' });
		const property = Object.assign(new HomeyChannelPropertyEntity(), {
			id: 'property-id',
			identifier: 'measure_temperature.inside',
		});

		expect(device.type).toBe(DEVICES_HOMEY_TYPE);
		expect(device.identifier).toBe('homey-device-id');
		expect(channel.type).toBe(DEVICES_HOMEY_TYPE);
		expect(channel.identifier).toBe('lighting');
		expect(property.type).toBe(DEVICES_HOMEY_TYPE);
		expect(property.identifier).toBe('measure_temperature.inside');
	});
});
