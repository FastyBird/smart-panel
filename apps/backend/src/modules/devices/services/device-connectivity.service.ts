import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	EventType,
	OnlineDeviceState,
	PermissionType,
	PropertyCategory,
} from '../devices.constants';
import { DevicesNotFoundException } from '../devices.exceptions';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';

import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DeviceConnectionStateService } from './device-connection-state.service';
import { DevicesService } from './devices.service';

@Injectable()
export class DeviceConnectivityService {
	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectionStateService: DeviceConnectionStateService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async setConnectionState(
		deviceId: DeviceEntity['id'],
		state: { state: ConnectionState; reason?: string; ts?: number },
	): Promise<void> {
		const device = await this.devicesService.findOne(deviceId);

		if (!device) {
			// Device not found - this can happen during initialization, just skip
			return;
		}

		let channel: ChannelEntity | null = null;
		let property: ChannelPropertyEntity | null = null;

		try {
			channel = await this.findOrCreateConnectionChannel(device, true);
			property = await this.findOrCreateConnectionProperty(channel, true);
		} catch {
			// Channel or property not found/created - this can happen during initialization
			// Just skip setting connection state, it will be set later when channels are created
			return;
		}

		if (!property) {
			// Property not found - skip
			return;
		}

		const last = property.value;

		let changed = false;

		if (last !== String(state.state)) {
			try {
				await this.channelsPropertiesService.update(property.id, {
					type: property.type,
					value: String(state.state),
				});

				changed = true;
			} catch {
				// Property may have been deleted or doesn't exist - skip
				return;
			}
		}

		try {
			const connection = await this.deviceConnectionStateService.readLatest(device);

			if (connection.status !== state.state) {
				await this.deviceConnectionStateService.write(device, property, state.state);

				changed = true;
			}
		} catch {
			// Connection state service error - skip
			return;
		}

		if (changed) {
			// Update device status before emitting so the event contains the new values
			device.status.online = OnlineDeviceState.includes(state.state);
			device.status.status = state.state;
			device.status.lastChanged = new Date();

			this.eventEmitter.emit(EventType.DEVICE_CONNECTION_CHANGED, { device, state: state.state, reason: state.reason });
		}
	}

	private async findOrCreateConnectionChannel(device: DeviceEntity, create: boolean): Promise<ChannelEntity> {
		let channel = await this.channelsService.findOneBy('category', ChannelCategory.DEVICE_INFORMATION, device.id);

		if (channel === null && create) {
			try {
				channel = await this.channelsService.create({
					device: device.id,
					type: device.type,
					identifier: 'device_information',
					category: ChannelCategory.DEVICE_INFORMATION,
					name: 'Device Information',
				});
			} catch {
				// Handle race condition: channel may have been created by another process
				// Retry finding the channel
				channel = await this.channelsService.findOneBy('category', ChannelCategory.DEVICE_INFORMATION, device.id);
			}
		}

		if (channel === null) {
			throw new DevicesNotFoundException('Connection channel not found');
		}

		return channel;
	}

	private async findOrCreateConnectionProperty(
		channel: ChannelEntity,
		create: boolean,
	): Promise<ChannelPropertyEntity> {
		let property = await this.channelsPropertiesService.findOneBy('category', PropertyCategory.STATUS, channel.id);

		if (property === null && create) {
			try {
				property = await this.channelsPropertiesService.create(channel.id, {
					type: channel.type,
					identifier: 'connection_state',
					name: 'Connection State',
					category: PropertyCategory.STATUS,
					permissions: [PermissionType.READ_ONLY],
					data_type: DataTypeType.ENUM,
					format: [
						ConnectionState.CONNECTED,
						ConnectionState.DISCONNECTED,
						ConnectionState.INIT,
						ConnectionState.READY,
						ConnectionState.RUNNING,
						ConnectionState.SLEEPING,
						ConnectionState.STOPPED,
						ConnectionState.LOST,
						ConnectionState.ALERT,
						ConnectionState.UNKNOWN,
					],
				});
			} catch {
				// Handle race condition: property may have been created by another process
				// Retry finding the property
				property = await this.channelsPropertiesService.findOneBy('category', PropertyCategory.STATUS, channel.id);
			}
		}

		if (property === null) {
			throw new DevicesNotFoundException('Connection property not found');
		}

		return property;
	}
}
