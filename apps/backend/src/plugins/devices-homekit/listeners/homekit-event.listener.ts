import { CharacteristicValue } from '@homebridge/hap-nodejs';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { EventType as DevicesEventType } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { HomeKitMapperRegistryService } from '../services/homekit-mapper-registry.service';

@Injectable()
export class HomeKitEventListener {
	private readonly logger = new Logger(HomeKitEventListener.name);

	constructor(private readonly mapperRegistry: HomeKitMapperRegistryService) {}

	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_VALUE_SET)
	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_UPDATED)
	handlePropertyValueChanged(property: ChannelPropertyEntity): void {
		if (!property || !property.id) {
			return;
		}

		const bindings = this.mapperRegistry.getBindingsForProperty(property.id);
		const listeners = this.mapperRegistry.getListenersForProperty(property.id);

		if (bindings.length === 0 && listeners.length === 0) {
			return;
		}

		const rawValue = property.value?.value;

		for (const binding of bindings) {
			try {
				binding.revision++;
				const hapValue: CharacteristicValue = binding.toHomeKit
					? binding.toHomeKit(rawValue)
					: (rawValue as CharacteristicValue);
				binding.currentValue = hapValue;
				this.logger.debug(
					`Updating HomeKit characteristic: property=${property.id} value=${JSON.stringify(rawValue)} -> HAP=${JSON.stringify(hapValue)}`,
				);
				binding.characteristic.updateValue(hapValue);
			} catch (error) {
				const err = error as Error;
				this.logger.warn(`Failed to update HomeKit characteristic for property=${property.id}: ${err.message}`);
			}
		}

		for (const listener of listeners) {
			try {
				listener.onPropertyChanged(property, rawValue);
			} catch (error) {
				const err = error as Error;
				this.logger.warn(`Failed to notify HomeKit property listener for property=${property.id}: ${err.message}`);
			}
		}
	}
}
