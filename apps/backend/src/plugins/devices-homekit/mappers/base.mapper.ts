import {
	Accessory,
	Categories,
	Characteristic,
	CharacteristicValue,
	Perms,
	Service,
	uuid,
} from '@homebridge/hap-nodejs';

import { ChannelCategory, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { bindCharacteristicGet } from './characteristic-get';
import { bindCharacteristicWrite } from './characteristic-write';
import { CharacteristicBinding, HomeKitMapperContext, IHomeKitAccessoryMapper } from './homekit-mapper.interface';
import { readMappedProperty } from './property-read';

export abstract class BaseHomeKitMapper implements IHomeKitAccessoryMapper {
	abstract canMap(device: DeviceEntity): boolean;
	abstract getSuggestedServiceType(device: DeviceEntity): string;
	abstract buildAccessory(device: DeviceEntity, context: HomeKitMapperContext): Accessory | null;

	protected createBaseAccessory(device: DeviceEntity, category: Categories): Accessory {
		const accessoryUuid = uuid.generate(`fastybird.smart-panel.device.${device.id}`);
		const accessory = new Accessory(device.name, accessoryUuid);
		accessory.category = category;

		const infoService =
			accessory.getService(Service.AccessoryInformation) ?? accessory.addService(Service.AccessoryInformation);
		infoService
			.setCharacteristic(Characteristic.Name, device.name)
			.setCharacteristic(Characteristic.Manufacturer, device.type || 'FastyBird')
			.setCharacteristic(Characteristic.Model, device.category || 'Smart Device')
			.setCharacteristic(Characteristic.SerialNumber, device.id)
			.setCharacteristic(Characteristic.FirmwareRevision, '1.0.0');

		return accessory;
	}

	protected findChannel(device: DeviceEntity, category: ChannelCategory): ChannelEntity | undefined {
		return device.channels?.find((channel) => channel.category === category);
	}

	protected findChannels(device: DeviceEntity, category: ChannelCategory): ChannelEntity[] {
		return device.channels?.filter((channel) => channel.category === category) ?? [];
	}

	protected findProperty(channel: ChannelEntity, category: PropertyCategory): ChannelPropertyEntity | undefined {
		return channel.properties?.find(
			(property) =>
				property.category === category &&
				(property as ChannelPropertyEntity & { measurementQuantity?: string }).measurementQuantity !== 'dew_point',
		);
	}

	protected unwrapValue(val: unknown): unknown {
		if (val !== null && typeof val === 'object' && 'value' in (val as Record<string, unknown>)) {
			return (val as Record<string, unknown>).value;
		}
		return val;
	}

	protected bindCharacteristic(
		context: HomeKitMapperContext,
		device: DeviceEntity,
		channel: ChannelEntity,
		property: ChannelPropertyEntity,
		characteristic: Characteristic,
		toHomeKit: (value: unknown) => CharacteristicValue = (val) => val as CharacteristicValue,
		fromHomeKit: (value: CharacteristicValue) => unknown = (val) => val,
		fault?: Characteristic,
	): void {
		let currentProperty = property;
		let initialValue: CharacteristicValue;
		try {
			initialValue = readMappedProperty(context, property, characteristic, toHomeKit, fault);
		} catch {
			initialValue = undefined;
		}
		const binding: CharacteristicBinding = {
			deviceId: device.id,
			channelId: channel.id,
			propertyId: property.id,
			characteristic,
			toHomeKit,
			fromHomeKit,
			currentValue: initialValue,
			revision: 0,
		};

		binding.readValue = (event, metadataUpdate = false) => {
			if (event)
				currentProperty = Object.assign(
					Object.create(Object.getPrototypeOf(currentProperty) as object) as ChannelPropertyEntity,
					currentProperty,
					metadataUpdate ? event : { value: event.value },
					{ channel: currentProperty.channel },
				);
			const state = context.propertyState?.read(currentProperty);
			if (!event && !currentProperty.requiresLiveValue && (!state || state.quality === null))
				return binding.currentValue;
			return readMappedProperty(context, currentProperty, characteristic, toHomeKit, fault);
		};
		bindCharacteristicGet(context, characteristic, () => binding.readValue());
		if (fault)
			bindCharacteristicGet(context, fault, () => {
				try {
					binding.readValue(currentProperty);
				} catch {
					/* Fault remains readable for unavailable sensors. */
				}
				return fault.value;
			});

		if (initialValue !== undefined && initialValue !== null) {
			try {
				characteristic.updateValue(initialValue);
			} catch {
				// Ignore if initial value does not match characteristic constraints
			}
		}

		const isComposite = context.commandDispatcher.canExecuteCompositeProperty?.(property) ?? false;
		const isPropertyWritable =
			(Array.isArray(property.permissions) &&
				property.permissions.some((p) => [PermissionType.READ_WRITE, PermissionType.WRITE_ONLY].includes(p))) ||
			isComposite;
		const isCharacteristicWritable = characteristic.props.perms.includes(Perms.PAIRED_WRITE);

		if (isPropertyWritable && isCharacteristicWritable) {
			bindCharacteristicWrite(
				characteristic,
				async (value: CharacteristicValue) => {
					const startingRevision = binding.revision;
					const token = (binding.nextWriteToken ?? 0) + 1;
					binding.nextWriteToken = token;
					binding.revision = startingRevision + 1;
					binding.pendingWrite = {
						token,
						previousValue: binding.currentValue,
						requestedValue: value,
						startingRevision,
					};
					if (!isComposite) binding.currentValue = value;
					const smartPanelValue = fromHomeKit(value);

					try {
						await context.commandDispatcher.dispatch(property.id, smartPanelValue);
					} catch (error) {
						if (
							binding.pendingWrite?.token === token &&
							binding.revision === startingRevision + 1 &&
							Object.is(binding.currentValue, value)
						) {
							binding.currentValue = binding.pendingWrite.previousValue;
							binding.characteristic.updateValue(binding.pendingWrite.previousValue);
						}

						throw error;
					} finally {
						if (binding.pendingWrite?.token === token) {
							binding.pendingWrite = undefined;
						}
					}
				},
				() => binding.readValue(),
				() => context.availability?.assertAvailable(),
			);
		}

		context.registerBinding(binding);
	}
}
