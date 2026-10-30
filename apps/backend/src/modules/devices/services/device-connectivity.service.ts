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
import { ControllerPublicationContext, ownControllerEffectValue } from './controller-publication-context';
import { CreationCapture, captureCreation } from './creation-capture';
import { DeviceConnectionStateService } from './device-connection-state.service';
import { DevicesService } from './devices.service';

interface ConnectivityDestinations {
	readonly devices: CreationCapture<DevicesService>;
	readonly channels: CreationCapture<ChannelsService>;
	readonly properties: CreationCapture<ChannelsPropertiesService>;
	readonly state: CreationCapture<DeviceConnectionStateService>;
	readonly events: CreationCapture<EventEmitter2>;
}

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
		await this.trySetConnectionState(deviceId, state);
	}

	async trySetConnectionState(
		deviceId: DeviceEntity['id'],
		state: { state: ConnectionState; reason?: string; ts?: number },
	): Promise<boolean> {
		const destinations: ConnectivityDestinations | undefined = ControllerPublicationContext.current()
			? {
					devices: captureCreation(this.devicesService, ['findOne']),
					channels: captureCreation(this.channelsService, ['findOneBy', 'create']),
					properties: captureCreation(this.channelsPropertiesService, ['findOneBy', 'create', 'update']),
					state: captureCreation(this.deviceConnectionStateService, ['readLatest', 'write']),
					events: captureCreation(this.eventEmitter, ['emit']),
				}
			: undefined;
		if (destinations) state = ownControllerEffectValue(state);
		return ControllerPublicationContext.effect('device-connectivity.state', async () => {
			let device = destinations
				? await destinations.devices.values.findOne.call(destinations.devices.receiver, deviceId)
				: await this.devicesService.findOne(deviceId);
			if (destinations && device) device = ownControllerEffectValue(device);

			if (!device) {
				// Device not found - this can happen during initialization, just skip
				return false;
			}

			let channel: ChannelEntity;
			let property: ChannelPropertyEntity;

			try {
				channel = await this.findOrCreateConnectionChannel(device, true, destinations);
				if (destinations) channel = ownControllerEffectValue(channel);
				property = await this.findOrCreateConnectionProperty(channel, true, destinations);
				if (destinations && property) property = ownControllerEffectValue(property);
			} catch {
				// Channel or property not found/created - this can happen during initialization
				// Just skip setting connection state, it will be set later when channels are created
				return false;
			}

			if (!property) {
				// Property not found - skip
				return false;
			}

			const last = property.value?.value;

			let changed = false;

			if (last !== String(state.state)) {
				try {
					const update = { type: property.type, value: String(state.state) };
					await (destinations
						? destinations.properties.values.update.call(destinations.properties.receiver, property.id, update)
						: this.channelsPropertiesService.update(property.id, update));

					changed = true;
				} catch {
					// Property may have been deleted or doesn't exist - skip
					return false;
				}
			}

			try {
				const connection = await (destinations
					? destinations.state.values.readLatest.call(destinations.state.receiver, device)
					: this.deviceConnectionStateService.readLatest(device));

				if (connection.status !== state.state) {
					await (destinations
						? destinations.state.values.write.call(destinations.state.receiver, device, property, state.state)
						: this.deviceConnectionStateService.write(device, property, state.state));

					changed = true;
				}
			} catch {
				// Connection state service error - skip
				return false;
			}

			if (changed) {
				// Update device status before emitting so the event contains the new values
				device.status.online = OnlineDeviceState.includes(state.state);
				device.status.status = state.state;
				device.status.lastChanged = new Date();

				const payload = { device, state: state.state, reason: state.reason };
				if (destinations)
					destinations.events.values.emit.call(
						destinations.events.receiver,
						EventType.DEVICE_CONNECTION_CHANGED,
						payload,
					);
				else this.eventEmitter.emit(EventType.DEVICE_CONNECTION_CHANGED, payload);
			}

			return true;
		});
	}

	private async findOrCreateConnectionChannel(
		device: DeviceEntity,
		create: boolean,
		destinations?: ConnectivityDestinations,
	): Promise<ChannelEntity> {
		let channel = await (destinations
			? destinations.channels.values.findOneBy.call(
					destinations.channels.receiver,
					'category',
					ChannelCategory.DEVICE_INFORMATION,
					device.id,
				)
			: this.channelsService.findOneBy('category', ChannelCategory.DEVICE_INFORMATION, device.id));

		if (channel === null && create) {
			try {
				const input = {
					device: device.id,
					type: device.type,
					identifier: 'device_information',
					category: ChannelCategory.DEVICE_INFORMATION,
					name: 'Device Information',
				};
				channel = destinations
					? await destinations.channels.values.create.call(destinations.channels.receiver, input)
					: await this.channelsService.create(input);
			} catch {
				// Handle race condition: channel may have been created by another process
				// Retry finding the channel
				channel = await (destinations
					? destinations.channels.values.findOneBy.call(
							destinations.channels.receiver,
							'category',
							ChannelCategory.DEVICE_INFORMATION,
							device.id,
						)
					: this.channelsService.findOneBy('category', ChannelCategory.DEVICE_INFORMATION, device.id));
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
		destinations?: ConnectivityDestinations,
	): Promise<ChannelPropertyEntity> {
		let property = await (destinations
			? destinations.properties.values.findOneBy.call(
					destinations.properties.receiver,
					'category',
					PropertyCategory.STATUS,
					channel.id,
				)
			: this.channelsPropertiesService.findOneBy('category', PropertyCategory.STATUS, channel.id));

		if (property === null && create) {
			try {
				const input = {
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
				};
				property = destinations
					? await destinations.properties.values.create.call(destinations.properties.receiver, channel.id, input)
					: await this.channelsPropertiesService.create(channel.id, input);
			} catch {
				// Handle race condition: property may have been created by another process
				// Retry finding the property
				property = await (destinations
					? destinations.properties.values.findOneBy.call(
							destinations.properties.receiver,
							'category',
							PropertyCategory.STATUS,
							channel.id,
						)
					: this.channelsPropertiesService.findOneBy('category', PropertyCategory.STATUS, channel.id));
			}
		}

		if (property === null) {
			throw new DevicesNotFoundException('Connection property not found');
		}

		return property;
	}
}
