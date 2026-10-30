import { EventEmitter2 } from '@nestjs/event-emitter';

import { VirtualChannelPropertyEntity } from '../../../plugins/devices-virtual/entities/devices-virtual.entity';
import { ConnectionState } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';

import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { ControllerPublicationContext } from './controller-publication-context';
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
	it('joins its finite original state write and event with captured input and destinations after observation retirement', async () => {
		let entered: () => void;
		let release: () => void;
		const entry = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const device = Object.assign(new DeviceEntity(), { id: 'original-device' });
		const channel = Object.assign(new ChannelEntity(), { id: 'original-channel' });
		const property = Object.assign(new VirtualChannelPropertyEntity(), { id: 'original-property' });
		devicesService.findOne.mockImplementation(async () => {
			entered();
			await gate;
			return device;
		});
		channelsService.findOneBy.mockResolvedValue(channel);
		channelsPropertiesService.findOneBy.mockResolvedValue(property);
		channelsPropertiesService.update.mockResolvedValue(property);
		deviceConnectionStateService.readLatest.mockResolvedValue({ status: ConnectionState.UNKNOWN });
		deviceConnectionStateService.write.mockResolvedValue(undefined);
		const originalWrite = deviceConnectionStateService.write;
		const originalEmit = eventEmitter.emit;
		const replacementWrite = jest.fn();
		const replacementEmit = jest.fn();
		let eligible = true;
		const publication = new ControllerPublicationContext(() => eligible);
		const input = { state: ConnectionState.CONNECTED, reason: 'original reason' };
		let settled = false;
		const completed = publication
			.run(() => {
				void service.setConnectionState(device.id, input);
				return Promise.resolve();
			})
			.then(() => {
				settled = true;
			});
		try {
			await entry;
			expect(settled).toBe(false);
			eligible = false;
			input.state = ConnectionState.ALERT;
			input.reason = 'replacement reason';
			deviceConnectionStateService.write = replacementWrite;
			eventEmitter.emit = replacementEmit;
			release();
			await completed;
			expect(originalWrite).toHaveBeenCalledWith(
				expect.objectContaining({ id: 'original-device' }),
				expect.objectContaining({ id: 'original-property' }),
				ConnectionState.CONNECTED,
			);
			expect(originalEmit).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ state: ConnectionState.CONNECTED, reason: 'original reason' }),
			);
			expect(replacementWrite).not.toHaveBeenCalled();
			expect(replacementEmit).not.toHaveBeenCalled();
			expect(publication.facts()).toContainEqual(
				expect.objectContaining({
					name: 'device-connectivity.state',
					submitted: true,
					settled: true,
					failed: false,
					retired: true,
				}),
			);
		} finally {
			release();
			await completed;
			deviceConnectionStateService.write = originalWrite;
			eventEmitter.emit = originalEmit;
		}
	});
});
