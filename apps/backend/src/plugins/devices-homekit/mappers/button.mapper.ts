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
		const normalized = event.toLowerCase().trim();
		switch (normalized) {
			case 'press':
			case 'single':
			case 'single_press':
			case 'click':
			case 'button_1':
				return Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS;
			case 'double':
			case 'double_press':
			case 'double_click':
			case 'button_2':
				return Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS;
			case 'long_press':
			case 'hold':
			case 'long_click':
			case 'button_3':
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

		return valid.size > 0 ? Array.from(valid).sort((a, b) => a - b) : [];
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

			const eventProp =
				channel.properties?.find((p) => p.category === PropertyCategory.EVENT) ??
				channel.properties?.find((p) => p.permissions?.includes(PermissionType.EVENT_ONLY)) ??
				channel.properties?.[0];

			if (!eventProp) {
				return;
			}

			const validValues = ButtonMapper.resolveValidValues(eventProp);
			if (validValues.length === 0) {
				return;
			}

			const switchService = accessory.addService(Service.StatelessProgrammableSwitch, serviceName, channel.id);

			if (buttonChannels.length > 1) {
				const indexChar = switchService.getCharacteristic(Characteristic.ServiceLabelIndex);
				indexChar.setValue(serviceIndex);
			}

			const switchEventChar = switchService.getCharacteristic(Characteristic.ProgrammableSwitchEvent);

			// Stateless programmable switch has no persistent state; GET returns null.
			// Replays on startup/restart are strictly avoided.
			switchEventChar.onGet(() => null);

			switchEventChar.setProps({ validValues });

			context.registerOccurrenceListener?.({
				deviceId: device.id,
				channelId: channel.id,
				propertyId: eventProp.id,
				onOccurrence: (occurrence: ChannelInputOccurrencePayload) => {
					const hapEvent = ButtonMapper.mapEventToHap(occurrence.event);
					if (hapEvent === null) {
						ButtonMapper.logger.debug(
							`Dropping unsupported input occurrence event="${occurrence.event}" for device="${device.id}" channel="${channel.id}"`,
						);
						return;
					}

					if (!validValues.includes(hapEvent)) {
						ButtonMapper.logger.warn(
							`Dropping occurrence event="${occurrence.event}" (HAP ${hapEvent}) outside validValues=[${validValues.join(',')}] for channel="${channel.id}"`,
						);
						return;
					}

					// Apple HomeKit requires sendEventNotification to be called for stateless switches
					// to deliver consecutive presses of the same type even if the value has not changed.
					switchEventChar.sendEventNotification(hapEvent);
				},
			});
		});
	}
}
