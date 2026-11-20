import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import {
	Zigbee2mqttChannelEntity,
	Zigbee2mqttChannelPropertyEntity,
	Zigbee2mqttDeviceEntity,
} from '../entities/devices-zigbee2mqtt.entity';
import { ConfigDrivenConverter } from '../mappings/config-driven.converter';
import { Z2mDeviceMapperService } from '../services/device-mapper.service';
import { Z2mVirtualPropertyService } from '../services/virtual-property.service';
import { Zigbee2mqttService } from '../services/zigbee2mqtt.service';

import { Zigbee2mqttDevicePlatform } from './zigbee2mqtt.device.platform';

describe('Zigbee2mqttDevicePlatform read requests', () => {
	let acknowledge: () => void;
	let adapter: {
		isConnected: jest.Mock<boolean, []>;
		whenCommandsAcknowledged: jest.Mock<Promise<void>, [string]>;
		requestState: jest.Mock<Promise<boolean>, [string, string[]?]>;
	};
	let service: { getActiveAdapter: jest.Mock };
	let mapper: { getPropertySampleMapping: jest.Mock };
	let platform: Zigbee2mqttDevicePlatform;

	const device = Object.assign(new Zigbee2mqttDeviceEntity(), { id: 'd', identifier: 'plug', enabled: true });
	const channel = Object.assign(new Zigbee2mqttChannelEntity(), { id: 'c', category: ChannelCategory.SWITCHER });
	const property = (identifier = 'state'): Zigbee2mqttChannelPropertyEntity =>
		Object.assign(new Zigbee2mqttChannelPropertyEntity(), { id: 'p', identifier, category: PropertyCategory.ON });
	const flush = async (): Promise<void> => {
		for (let i = 0; i < 5; i++) await Promise.resolve();
	};

	beforeEach(() => {
		adapter = {
			isConnected: jest.fn(() => true),
			whenCommandsAcknowledged: jest.fn<Promise<void>, [string]>(
				() =>
					new Promise<void>((resolve) => {
						acknowledge = resolve;
					}),
			),
			requestState: jest.fn<Promise<boolean>, [string, string[]?]>(() => Promise.resolve(true)),
		};
		service = { getActiveAdapter: jest.fn(() => adapter) };
		mapper = { getPropertySampleMapping: jest.fn(() => ({ field: 'state', transformer: null })) };
		platform = new Zigbee2mqttDevicePlatform(
			service as unknown as Zigbee2mqttService,
			{} as Z2mVirtualPropertyService,
			{} as ConfigDrivenConverter,
			mapper as unknown as Z2mDeviceMapperService,
		);
	});

	it('requests the mapped field only after pending commands to the device were acknowledged', async () => {
		const result = platform.requestPropertyRead({ device, channel, property: property() });
		await flush();
		expect(adapter.whenCommandsAcknowledged).toHaveBeenCalledWith('plug');
		expect(adapter.requestState).not.toHaveBeenCalled();

		acknowledge();
		await expect(result).resolves.toBe(true);
		expect(adapter.requestState).toHaveBeenCalledWith('plug', ['state']);
	});

	it('does not request when the connection was lost while waiting', async () => {
		const result = platform.requestPropertyRead({ device, channel, property: property() });
		await flush();
		adapter.isConnected.mockReturnValue(false);
		acknowledge();
		await expect(result).resolves.toBe(false);
		expect(adapter.requestState).not.toHaveBeenCalled();
	});

	it.each([
		['a virtual command property', property('fb_virtual_command'), 'state'],
		['a composite colour property', property('hue'), 'color'],
	])('does not request %s', async (_label, target, field) => {
		mapper.getPropertySampleMapping.mockReturnValue({ field, transformer: null });
		await expect(platform.requestPropertyRead({ device, channel, property: target })).resolves.toBe(false);
		expect(adapter.whenCommandsAcknowledged).not.toHaveBeenCalled();
	});

	it('does not request for a disabled device', async () => {
		const disabled = Object.assign(new Zigbee2mqttDeviceEntity(), { ...device, enabled: false });
		await expect(platform.requestPropertyRead({ device: disabled, channel, property: property() })).resolves.toBe(
			false,
		);
	});
});
