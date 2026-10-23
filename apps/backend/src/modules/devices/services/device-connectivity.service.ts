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
import {
	DeviceCreationPublicationEngine,
	DeviceCreationPublicationLease,
	creationHasDataMethod,
	creationMethodCurrent,
	freezeCreationSnapshot,
} from './device-creation-context';
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

	captureCreatedMethodGuard(): () => boolean {
		const holders: readonly Readonly<{ receiver: object; keys: readonly string[] }>[] = [
			{ receiver: this, keys: ['setCreatedConnectionState'] },
			{ receiver: this.channelsPropertiesService, keys: ['updateCreatedValue', 'captureCreatedMethodGuard'] },
			{
				receiver: this.deviceConnectionStateService,
				keys: ['readCreated', 'writeCreated', 'captureCreatedMethodGuard'],
			},
			{ receiver: this.eventEmitter, keys: ['emit'] },
		];
		const pins: Readonly<{ receiver: object; key: string; method: unknown }>[] = [];
		for (const { receiver, keys } of holders)
			for (const key of keys) {
				if (!creationHasDataMethod(receiver, key)) throw new Error('Original connectivity pipeline unavailable');
				const method: unknown = Reflect.get(receiver, key);
				pins.push(Object.freeze({ receiver, key, method }));
			}
		const property = this.channelsPropertiesService.captureCreatedMethodGuard();
		const status = this.deviceConnectionStateService.captureCreatedMethodGuard();
		return () =>
			pins.every(({ receiver, key, method }) => creationMethodCurrent(receiver, key, method)) && property() && status();
	}

	async setCreatedConnectionState(
		lease: DeviceCreationPublicationLease,
		device: DeviceEntity,
		channel: ChannelEntity,
		property: ChannelPropertyEntity,
		state: { state: ConnectionState; reason?: string },
	): Promise<void> {
		DeviceCreationPublicationEngine.assert(lease);
		const child = DeviceCreationPublicationEngine.beginChild(lease, 'connectivity', device.id);
		const updateCreatedValueOriginalMethods: Readonly<{
			updateCreatedValue: DeviceConnectivityService['channelsPropertiesService']['updateCreatedValue'];
		}> = this.channelsPropertiesService;
		const { updateCreatedValue } = updateCreatedValueOriginalMethods;
		const readCreatedOriginalMethods: Readonly<{
			readCreated: DeviceConnectivityService['deviceConnectionStateService']['readCreated'];
			writeCreated: DeviceConnectivityService['deviceConnectionStateService']['writeCreated'];
		}> = this.deviceConnectionStateService;
		const { readCreated, writeCreated } = readCreatedOriginalMethods;
		const emitOriginalMethods: Readonly<{ emit: DeviceConnectivityService['eventEmitter']['emit'] }> =
			this.eventEmitter;
		const { emit } = emitOriginalMethods;
		const update: Readonly<{
			call: (
				receiver: ChannelsPropertiesService,
				...args: Parameters<ChannelsPropertiesService['updateCreatedValue']>
			) => Promise<boolean>;
		}> = updateCreatedValue;
		const read: Readonly<{
			call: (
				receiver: DeviceConnectionStateService,
				...args: Parameters<DeviceConnectionStateService['readCreated']>
			) => ReturnType<DeviceConnectionStateService['readCreated']>;
		}> = readCreated;
		const write: Readonly<{
			call: (
				receiver: DeviceConnectionStateService,
				...args: Parameters<DeviceConnectionStateService['writeCreated']>
			) => Promise<void>;
		}> = writeCreated;
		const notify: Readonly<{
			call: (receiver: EventEmitter2, ...args: Parameters<EventEmitter2['emit']>) => ReturnType<EventEmitter2['emit']>;
		}> = emit;

		let failure: { cause: unknown } | undefined;
		try {
			DeviceCreationPublicationEngine.assertProperty(lease, property);
			if (
				device !== DeviceCreationPublicationEngine.catalog(lease) ||
				!device.channels.includes(channel) ||
				!channel.properties.includes(property) ||
				channel.category !== ChannelCategory.DEVICE_INFORMATION ||
				property.category !== PropertyCategory.STATUS
			)
				throw new Error('Original connection catalog required');
			let changed = await update.call(this.channelsPropertiesService, lease, property, String(state.state));
			DeviceCreationPublicationEngine.assert(lease, device.id, property.id);
			const previous = read.call(this.deviceConnectionStateService, lease, device);
			// Always initialize THIS new incarnation's actual cache/status binding; equal unknown is
			// not permission to keep an unrelated old incarnation's ID-keyed state.
			await write.call(
				this.deviceConnectionStateService,
				lease,
				device,
				property,
				state.state,
				DeviceCreationPublicationEngine.storage(lease),
			);
			DeviceCreationPublicationEngine.assert(lease, device.id, property.id);
			if (previous.status !== state.state) changed = true;
			if (changed) {
				const objects: Readonly<{
					create: (prototype: object | null) => object;
					getPrototypeOf: (value: object) => object | null;
					assign: typeof Object.assign;
				}> = Object;
				const payload: DeviceEntity = objects.assign(objects.create(objects.getPrototypeOf(device)), device, {
					status: { online: OnlineDeviceState.includes(state.state), status: state.state, lastChanged: new Date() },
				});
				DeviceCreationPublicationEngine.assert(lease, device.id, property.id);
				freezeCreationSnapshot(payload);
				notify.call(
					this.eventEmitter,
					EventType.DEVICE_CONNECTION_CHANGED,
					Object.freeze({ device: payload, state: state.state, reason: state.reason }),
				);
				DeviceCreationPublicationEngine.assert(lease, device.id, property.id);
			}
		} catch (cause) {
			failure = { cause };
			throw cause;
		} finally {
			child.finish(failure);
		}
	}

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
		DeviceCreationPublicationEngine.invalidateIds([deviceId]);
		const device = await this.devicesService.findOne(deviceId);

		if (!device) {
			// Device not found - this can happen during initialization, just skip
			return false;
		}

		let channel: ChannelEntity;
		let property: ChannelPropertyEntity;

		try {
			channel = await this.findOrCreateConnectionChannel(device, true);
			property = await this.findOrCreateConnectionProperty(channel, true);
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
				await this.channelsPropertiesService.update(property.id, {
					type: property.type,
					value: String(state.state),
				});

				changed = true;
			} catch {
				// Property may have been deleted or doesn't exist - skip
				return false;
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
			return false;
		}

		if (changed) {
			// Update device status before emitting so the event contains the new values
			device.status.online = OnlineDeviceState.includes(state.state);
			device.status.status = state.state;
			device.status.lastChanged = new Date();

			this.eventEmitter.emit(EventType.DEVICE_CONNECTION_CHANGED, { device, state: state.state, reason: state.reason });
		}

		return true;
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
