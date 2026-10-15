import { CharacteristicValue } from '@homebridge/hap-nodejs';
import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import {
	ChannelCategory,
	ConnectionState,
	EventType as DevicesEventType,
	OnlineDeviceState,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelInputOccurrencePayload } from '../../../modules/devices/models/channel-input-occurrence.model';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { HomeKitBridgeService } from '../services/homekit-bridge.service';
import { HomeKitMapperRegistryService } from '../services/homekit-mapper-registry.service';

@Injectable()
export class HomeKitEventListener implements OnModuleDestroy {
	private readonly logger = new Logger(HomeKitEventListener.name);

	private readonly rebuildTimers = new Map<string, ReturnType<typeof setTimeout>>();

	constructor(
		private readonly mapperRegistry: HomeKitMapperRegistryService,
		@Optional() private readonly bridge?: HomeKitBridgeService,
		@Optional() private readonly devicesService?: DevicesService,
		@Optional() private readonly channelsService?: ChannelsService,
	) {}

	onModuleDestroy(): void {
		for (const timer of this.rebuildTimers.values()) clearTimeout(timer);
		this.rebuildTimers.clear();
	}

	/** Keeps deletion-event delivery non-throwing after compensated mapping maintenance fails. */
	@OnEvent(DevicesEventType.DEVICE_DELETED)
	async handleDeviceDeleted(device: DeviceEntity): Promise<void> {
		if (!device?.id || !this.isMapped(device.id)) return;
		const timer = this.rebuildTimers.get(device.id);
		if (timer) clearTimeout(timer);
		this.rebuildTimers.delete(device.id);
		try {
			await this.bridge.maintainMapping({ removeDeviceIds: [device.id] });
		} catch (error) {
			this.logger.warn(
				`Failed to remove deleted HomeKit device ${device.id}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	@OnEvent(DevicesEventType.DEVICE_CONNECTION_CHANGED)
	async handleConnectionChanged(event: { device: DeviceEntity; state: ConnectionState }): Promise<void> {
		if (!event?.device?.id || !this.isMapped(event.device.id) || this.bridge?.getState() === 'stopped') return;
		const online = OnlineDeviceState.includes(event.state);
		const becameOnline = this.mapperRegistry.setDeviceOnline(event.device.id, online);
		if (!becameOnline || !this.devicesService) return;
		const isCurrent = this.mapperRegistry.captureRefresh(event.device.id);
		try {
			const device = await this.devicesService.findOne(event.device.id);
			if (!device || !isCurrent()) return;
			for (const channel of device.channels ?? []) {
				for (const property of channel.properties ?? []) {
					if (isCurrent(property.id)) this.handlePropertyValueChanged(property);
				}
			}
		} catch (error) {
			this.logger.warn(`Failed to refresh online HomeKit device ${event.device.id}: ${(error as Error).message}`);
		}
	}

	@OnEvent(DevicesEventType.CHANNEL_CREATED)
	@OnEvent(DevicesEventType.CHANNEL_DELETED)
	handleChannelStructureChanged(channel: ChannelEntity): void {
		const deviceId = typeof channel?.device === 'string' ? channel.device : channel?.device?.id;
		if (deviceId) this.scheduleRebuild(deviceId);
	}

	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_CREATED)
	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_DELETED)
	async handlePropertyStructureChanged(property: ChannelPropertyEntity): Promise<void> {
		if (!property?.id) return;
		const owner = this.mapperRegistry.getDeviceIdForProperty(property.id);
		if (owner) {
			this.scheduleRebuild(owner);
			return;
		}
		const channelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;
		const embeddedDevice = typeof property.channel === 'object' ? property.channel?.device : undefined;
		if (embeddedDevice) {
			this.scheduleRebuild(typeof embeddedDevice === 'string' ? embeddedDevice : embeddedDevice.id);
		} else if (channelId && this.channelsService) {
			const channel = await this.channelsService.findOne(channelId);
			if (channel) this.handleChannelStructureChanged(channel);
		}
	}

	/** CO2 numeric metadata determines service admission, including optional level withdrawal/recovery. */
	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_UPDATED)
	async handleCarbonDioxideMetadataChanged(property: ChannelPropertyEntity): Promise<void> {
		if (!property || ![PropertyCategory.CONCENTRATION, PropertyCategory.PEAK_LEVEL].includes(property.category)) return;
		const channel =
			typeof property.channel === 'string' ? await this.channelsService?.findOne(property.channel) : property.channel;
		if (channel?.category === ChannelCategory.CARBON_DIOXIDE) await this.handlePropertyStructureChanged(property);
	}

	private isMapped(deviceId: string): boolean {
		return this.bridge?.getConfig().mappedDeviceIds?.includes(deviceId) ?? false;
	}

	private scheduleRebuild(deviceId: string): void {
		if (!this.isMapped(deviceId)) return;
		const previous = this.rebuildTimers.get(deviceId);
		if (previous) clearTimeout(previous);
		this.rebuildTimers.set(
			deviceId,
			setTimeout(() => {
				this.rebuildTimers.delete(deviceId);
				void this.bridge.maintainMapping({ rebuildDeviceIds: [deviceId] }).catch((error: unknown) => {
					this.logger.warn(`Failed to rebuild HomeKit device ${deviceId}: ${(error as Error).message}`);
				});
			}, 100),
		);
	}

	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED)
	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_VALUE_SET)
	handlePropertyValueSet(property: ChannelPropertyEntity): void {
		// The backend command window has already accepted this value, including confirmations
		// from another alias and expiry reconciliation. A local pending SET must not hide it.
		this.handlePropertyValueChanged(property, true);
	}

	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_UPDATED)
	handlePropertyValueChanged(property: ChannelPropertyEntity, acceptedValue = false): void {
		if (!property || !property.id) {
			return;
		}

		this.mapperRegistry.notePropertyEvent(property.id);
		const bindings = this.mapperRegistry.getBindingsForProperty(property.id);
		const listeners = this.mapperRegistry.getListenersForProperty(property.id);

		if (bindings.length === 0 && listeners.length === 0) {
			return;
		}

		const rawValue = property.value?.value;

		for (const binding of bindings) {
			if (acceptedValue) {
				binding.revision++;
				binding.pendingWrite = undefined;
			}
			try {
				const hapValue: CharacteristicValue = binding.readValue
					? binding.readValue(property, !acceptedValue)
					: binding.toHomeKit
						? binding.toHomeKit(rawValue)
						: (rawValue as CharacteristicValue);
				if (!acceptedValue && binding.pendingWrite && Object.is(hapValue, binding.pendingWrite.previousValue)) {
					this.logger.debug(
						`Suppressing stale HomeKit characteristic update: property=${property.id} value=${JSON.stringify(rawValue)}`,
					);
					continue;
				}

				binding.revision++;
				binding.currentValue = hapValue;
				binding.pendingWrite = undefined;
				this.logger.debug(
					`Updating HomeKit characteristic: property=${property.id} value=${JSON.stringify(rawValue)} -> HAP=${JSON.stringify(hapValue)}`,
				);
				binding.characteristic.updateValue(hapValue);
			} catch (error) {
				const err = error as Error;
				binding.characteristic.updateValue(err);
				this.logger.warn(`Failed to update HomeKit characteristic for property=${property.id}: ${err.message}`);
			}
		}

		for (const listener of listeners) {
			try {
				listener.onPropertyChanged(property, rawValue, acceptedValue);
			} catch (error) {
				const err = error as Error;
				this.logger.warn(`Failed to notify HomeKit property listener for property=${property.id}: ${err.message}`);
			}
		}
	}

	@OnEvent(DevicesEventType.CHANNEL_INPUT_OCCURRENCE)
	handleChannelInputOccurrence(occurrence: ChannelInputOccurrencePayload): void {
		if (!occurrence || !occurrence.propertyId) {
			return;
		}

		const listeners = this.mapperRegistry.getOccurrenceListeners(occurrence.propertyId);
		for (const listener of listeners) {
			try {
				listener.onOccurrence(occurrence);
			} catch (error) {
				const err = error as Error;
				this.logger.warn(
					`Failed to process HomeKit input occurrence for device=${occurrence.deviceId} channel=${occurrence.channelId} property=${occurrence.propertyId}: ${err.message}`,
				);
			}
		}
	}
}
