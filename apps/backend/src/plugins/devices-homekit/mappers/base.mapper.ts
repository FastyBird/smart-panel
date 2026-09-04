import { Accessory, Categories, Characteristic, CharacteristicValue, Service, uuid } from '@homebridge/hap-nodejs';

import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { HomeKitMapperContext, IHomeKitAccessoryMapper } from './homekit-mapper.interface';

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

	protected bindCharacteristic(
		context: HomeKitMapperContext,
		device: DeviceEntity,
		channel: ChannelEntity,
		property: ChannelPropertyEntity,
		characteristic: Characteristic,
		toHomeKit: (value: unknown) => CharacteristicValue = (val) => val as CharacteristicValue,
		fromHomeKit: (value: CharacteristicValue) => unknown = (val) => val,
	): void {
		characteristic.onGet(() => {
			return toHomeKit(property.value?.value);
		});

		characteristic.onSet(async (value: CharacteristicValue) => {
			const smartPanelValue = fromHomeKit(value);
			await context.commandDispatcher.dispatch(property.id, smartPanelValue);
		});

		context.registerBinding({
			deviceId: device.id,
			channelId: channel.id,
			propertyId: property.id,
			characteristic,
			toHomeKit,
			fromHomeKit,
		});
	}
}
