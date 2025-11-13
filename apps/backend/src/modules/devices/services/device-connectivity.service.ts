import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	EventType,
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
			throw new DevicesNotFoundException(`Device ${deviceId} not found`);
		}

		const channel = await this.findOrCreateConnectionChannel(device, true);
		const property = await this.findOrCreateConnectionProperty(channel, true);

		const last = property.value;

		if (last === String(state.state)) {
			return;
		}

		await this.channelsPropertiesService.update(property.id, {
			type: property.type,
			value: String(state.state),
		});

		await this.deviceConnectionStateService.write(device, property, state.state);

		this.eventEmitter.emit(EventType.DEVICE_CONNECTION_CHANGED, { device, state: state.state, reason: state.reason });
	}

	private async findOrCreateConnectionChannel(device: DeviceEntity, create: boolean): Promise<ChannelEntity> {
		let channel = await this.channelsService.findOneBy('category', ChannelCategory.DEVICE_INFORMATION, device.id);

		if (channel === null && create) {
			channel = await this.channelsService.create({
				device: device.id,
				type: device.type,
				category: ChannelCategory.DEVICE_INFORMATION,
				name: 'Device information',
			});
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
			property = await this.channelsPropertiesService.create(channel.id, {
				type: channel.type,
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
		}

		if (property === null) {
			throw new DevicesNotFoundException('Connection property not found');
		}

		return property;
	}
}
