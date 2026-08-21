import { EventEmitter2 } from '@nestjs/event-emitter';

import { ConnectionState } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';

import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DeviceConnectionStateService } from './device-connection-state.service';
import { DeviceConnectivityService } from './device-connectivity.service';
import { DevicesService } from './devices.service';

describe('DeviceConnectivityService', () => {
	const devicesService = { findOne: jest.fn() };
	const channelsService = { findOneBy: jest.fn(), create: jest.fn() };
	const channelsPropertiesService = { findOneBy: jest.fn(), create: jest.fn(), update: jest.fn() };
	const deviceConnectionStateService = { readLatest: jest.fn(), write: jest.fn() };
	const eventEmitter = { emit: jest.fn() };
	let service: DeviceConnectivityService;

	beforeEach(() => {
		jest.clearAllMocks();
		service = new DeviceConnectivityService(
			devicesService as unknown as DevicesService,
			channelsService as unknown as ChannelsService,
			channelsPropertiesService as unknown as ChannelsPropertiesService,
			deviceConnectionStateService as unknown as DeviceConnectionStateService,
			eventEmitter as unknown as EventEmitter2,
		);
	});

	it('reports when the requested state could not be applied while preserving the legacy void method', async () => {
		devicesService.findOne.mockResolvedValue(null);

		await expect(service.trySetConnectionState('missing-device', { state: ConnectionState.CONNECTED })).resolves.toBe(
			false,
		);
		await expect(service.setConnectionState('missing-device', { state: ConnectionState.CONNECTED })).resolves.toBe(
			undefined,
		);
	});

	it('reports an already-current persisted connection state as applied', async () => {
		const device = Object.assign(new DeviceEntity(), { id: 'device-id' });
		const channel = Object.assign(new ChannelEntity(), { id: 'channel-id' });
		const property = Object.assign(new ChannelPropertyEntity(), {
			id: 'property-id',
			value: { value: ConnectionState.CONNECTED },
		});
		devicesService.findOne.mockResolvedValue(device);
		channelsService.findOneBy.mockResolvedValue(channel);
		channelsPropertiesService.findOneBy.mockResolvedValue(property);
		deviceConnectionStateService.readLatest.mockResolvedValue({
			online: true,
			status: ConnectionState.CONNECTED,
			lastChanged: null,
		});

		await expect(service.trySetConnectionState(device.id, { state: ConnectionState.CONNECTED })).resolves.toBe(true);
		expect(channelsPropertiesService.update).not.toHaveBeenCalled();
		expect(deviceConnectionStateService.write).not.toHaveBeenCalled();
		expect(eventEmitter.emit).not.toHaveBeenCalled();
	});
});
