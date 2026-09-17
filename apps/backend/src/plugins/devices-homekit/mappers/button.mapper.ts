import { Accessory, Categories, Characteristic, Service } from '@homebridge/hap-nodejs';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelInputOccurrencePayload } from '../../../modules/devices/models/channel-input-occurrence.model';
import { DEVICES_HOMEKIT_PLUGIN_NAME } from '../devices-homekit.constants';

import { BaseHomeKitMapper } from './base.mapper';
import { HomeKitMapperContext } from './homekit-mapper.interface';

/**
 * Maps hardware input channels (buttons, event-capable binary inputs) to Apple HomeKit
 * StatelessProgrammableSwitch services.
 *
 * Supports single, double, and long press interactions while explicitly dropping unsupported
 * gestures (e.g. triple press, release, rotary, analog) without misleading coercion.
 */
export class ButtonMapper extends BaseHomeKitMapper {
	private static readonly logger = createExtensionLogger(DEVICES_HOMEKIT_PLUGIN_NAME, 'ButtonMapper');

	canMap(device: DeviceEntity): boolean {
		return ButtonMapper.getButtonChannels(device).length > 0;
	}

	getSuggestedServiceType(_device: DeviceEntity): string {
		return 'button';
	}

	buildAccessory(device: DeviceEntity, context: HomeKitMapperContext): Accessory | null {
		const buttonChannels = ButtonMapper.getButtonChannels(device);
		if (buttonChannels.length === 0) {
			return null;
		}

		const accessory = this.createBaseAccessory(device, Categories.PROGRAMMABLE_SWITCH);
		ButtonMapper.attachButtonServices(accessory, device, context);

		return accessory;
	}

	static isButtonChannel(channel: ChannelEntity): boolean {
		if (channel.category === ChannelCategory.BUTTON) {
			return true;
		}
		if (channel.category === ChannelCategory.BINARY_INPUT) {
			return (
				channel.properties?.some(
					(p) => p.category === PropertyCategory.EVENT || p.permissions?.includes(PermissionType.EVENT_ONLY),
				) ?? false
			);
		}
		return false;
	}

	static getButtonChannels(device: DeviceEntity): ChannelEntity[] {
		return device.channels?.filter((channel) => ButtonMapper.isButtonChannel(channel)) ?? [];
	}

	static mapEventToHap(event?: string): number | null {
		if (!event) {
			return null;
		}
		switch (event.toLowerCase()) {
			case 'press':
			case 'single_press':
			case 'single':
				return Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS;
			case 'double_press':
			case 'double':
				return Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS;
			case 'long_press':
			case 'long':
				return Characteristic.ProgrammableSwitchEvent.LONG_PRESS;
			default:
				return null;
		}
	}

	static resolveValidValues(property?: ChannelPropertyEntity): number[] {
		if (!property || !property.format) {
			return [
				Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
				Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS,
				Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
			];
		}

		const formats = Array.isArray(property.format)
			? property.format.map((f) => String(f).toLowerCase())
			: [String(property.format).toLowerCase()];

		const valid = new Set<number>();
		for (const f of formats) {
			const hap = ButtonMapper.mapEventToHap(f);
			if (hap !== null) {
				valid.add(hap);
			}
		}

		return valid.size > 0
			? Array.from(valid).sort((a, b) => a - b)
			: [
					Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
					Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS,
					Characteristic.ProgrammableSwitchEvent.LONG_PRESS,
				];
	}

	static attachButtonServices(accessory: Accessory, device: DeviceEntity, context: HomeKitMapperContext): void {
		const buttonChannels = ButtonMapper.getButtonChannels(device);
		if (buttonChannels.length === 0) {
			return;
		}

		if (buttonChannels.length > 1) {
			let labelService = accessory.getService(Service.ServiceLabel);
			if (!labelService) {
				labelService = accessory.addService(Service.ServiceLabel, `${device.name} Buttons`);
				labelService
					.getCharacteristic(Characteristic.ServiceLabelNamespace)
					.setValue(Characteristic.ServiceLabelNamespace.ARABIC_NUMERALS);
			}
		}

		buttonChannels.forEach((channel, index) => {
			if (accessory.getServiceById(Service.StatelessProgrammableSwitch, channel.id)) {
				return;
			}

			const serviceIndex = index + 1;
			const serviceName =
				buttonChannels.length === 1 ? device.name : `${device.name} ${channel.name || `Button ${serviceIndex}`}`;

			const switchService = accessory.addService(Service.StatelessProgrammableSwitch, serviceName, channel.id);

			if (buttonChannels.length > 1) {
				const indexChar = switchService.getCharacteristic(Characteristic.ServiceLabelIndex);
				indexChar.setValue(serviceIndex);
			}

			const eventProp =
				channel.properties?.find((p) => p.category === PropertyCategory.EVENT) ??
				channel.properties?.find((p) => p.permissions?.includes(PermissionType.EVENT_ONLY)) ??
				channel.properties?.[0];

			if (!eventProp) {
				return;
			}

			const switchEventChar = switchService.getCharacteristic(Characteristic.ProgrammableSwitchEvent);

			// Stateless programmable switch has no persistent state; GET returns null.
			// Replays on startup/restart are strictly avoided.
			switchEventChar.onGet(() => null);

			const validValues = ButtonMapper.resolveValidValues(eventProp);
			switchEventChar.setProps({ validValues });

			context.registerOccurrenceListener({
				deviceId: device.id,
				channelId: channel.id,
				propertyId: eventProp.id,
				onOccurrence: (occurrence: ChannelInputOccurrencePayload) => {
					const hapValue = ButtonMapper.mapEventToHap(occurrence.event);
					if (hapValue === null) {
						ButtonMapper.logger.debug(
							`[HOMEKIT INPUT] Dropping unsupported HomeKit interaction '${occurrence.event}' for device=${device.id} channel=${channel.id}`,
						);
						return;
					}

					if (!validValues.includes(hapValue)) {
						ButtonMapper.logger.debug(
							`[HOMEKIT INPUT] Event '${occurrence.event}' (${hapValue}) not supported by HomeKit configuration for channel=${channel.id}`,
						);
						return;
					}

					// Use sendEventNotification to force event delivery to HomeKit clients,
					// preserving rapid repeated identical presses without debounce or suppression.
					switchEventChar.sendEventNotification(hapValue);
				},
			});
		});
	}
}
