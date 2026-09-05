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

import { CharacteristicBinding, HomeKitMapperContext, IHomeKitAccessoryMapper } from './homekit-mapper.interface';

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
		return channel.properties?.find((property) => property.category === category);
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
	): void {
		const initialValue = toHomeKit(property.value?.value);
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

		characteristic.onGet(() => {
			return binding.currentValue;
		});

		if (initialValue !== undefined && initialValue !== null) {
			try {
				characteristic.updateValue(initialValue);
			} catch {
				// Ignore if initial value does not match characteristic constraints
			}
		}

		const isPropertyWritable =
			Array.isArray(property.permissions) &&
			property.permissions.some((p) => [PermissionType.READ_WRITE, PermissionType.WRITE_ONLY].includes(p));
		const isCharacteristicWritable = characteristic.props.perms.includes(Perms.PAIRED_WRITE);

		if (isPropertyWritable && isCharacteristicWritable) {
			characteristic.onSet(async (value: CharacteristicValue) => {
				const targetRev = ++binding.revision;
				const smartPanelValue = fromHomeKit(value);
				await context.commandDispatcher.dispatch(property.id, smartPanelValue);
				if (binding.revision === targetRev) {
					binding.currentValue = value;
				}
			});
		}

		context.registerBinding(binding);
	}
}
