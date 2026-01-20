import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import {
	ClimateEntityAttribute,
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	ENTITY_MAIN_STATE_ATTRIBUTE,
	HomeAssistantDomain,
} from '../devices-home-assistant.constants';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { HomeAssistantChannelPropertyEntity } from '../entities/devices-home-assistant.entity';

import { EntityMapper } from './entity.mapper';

@Injectable()
export class ClimateEntityMapperService extends EntityMapper {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'ClimateEntityMapperService',
	);

	get domain(): HomeAssistantDomain {
		return HomeAssistantDomain.CLIMATE;
	}

	async mapFromHA(
		properties: HomeAssistantChannelPropertyEntity[],
		state: HomeAssistantStateDto,
	): Promise<Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null>> {
		const mapped: Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null> = new Map();

		const currentTemperature = state.attributes[ClimateEntityAttribute.CURRENT_TEMPERATURE];

		if (typeof currentTemperature === 'number') {
			const temperatureProp = await this.getValidProperty(
				properties,
				PropertyCategory.TEMPERATURE,
				ClimateEntityAttribute.CURRENT_TEMPERATURE,
				[ChannelCategory.TEMPERATURE],
			);

			if (temperatureProp) {
				mapped.set(temperatureProp.id, currentTemperature);
			}
		}

		const currentHumidity = state.attributes[ClimateEntityAttribute.CURRENT_HUMIDITY];

		if (typeof currentHumidity === 'number') {
			const humidityProp = await this.getValidProperty(
				properties,
				PropertyCategory.HUMIDITY,
				ClimateEntityAttribute.CURRENT_HUMIDITY,
				[ChannelCategory.HUMIDITY],
			);

			if (humidityProp) {
				mapped.set(humidityProp.id, currentHumidity);
			}
		}

		const targetTemperature = state.attributes[ClimateEntityAttribute.TEMPERATURE];

		if (typeof targetTemperature === 'number') {
			const heaterTargetTemperatureProp = await this.getValidProperty(
				properties,
				PropertyCategory.TEMPERATURE,
				ClimateEntityAttribute.TEMPERATURE,
				[ChannelCategory.HEATER],
			);

			if (heaterTargetTemperatureProp) {
				mapped.set(heaterTargetTemperatureProp.id, targetTemperature);
			}

			const coolerTargetTemperatureProp = await this.getValidProperty(
				properties,
				PropertyCategory.TEMPERATURE,
				ClimateEntityAttribute.TEMPERATURE,
				[ChannelCategory.COOLER],
			);

			if (coolerTargetTemperatureProp) {
				mapped.set(coolerTargetTemperatureProp.id, targetTemperature);
			}
		}

		const targetTemperatureLow = state.attributes[ClimateEntityAttribute.TARGET_TEMP_LOW];

		if (typeof targetTemperatureLow === 'number') {
			const heaterTargetTemperatureProp = await this.getValidProperty(
				properties,
				PropertyCategory.TEMPERATURE,
				ClimateEntityAttribute.TARGET_TEMP_LOW,
				[ChannelCategory.HEATER],
			);

			if (heaterTargetTemperatureProp) {
				mapped.set(heaterTargetTemperatureProp.id, targetTemperatureLow);
			}
		}

		const targetTemperatureHigh = state.attributes[ClimateEntityAttribute.TARGET_TEMP_HIGH];

		if (typeof targetTemperatureHigh === 'number') {
			const coolerTargetTemperatureProp = await this.getValidProperty(
				properties,
				PropertyCategory.TEMPERATURE,
				ClimateEntityAttribute.TARGET_TEMP_HIGH,
				[ChannelCategory.COOLER],
			);

			if (coolerTargetTemperatureProp) {
				mapped.set(coolerTargetTemperatureProp.id, targetTemperatureHigh);
			}
		}

		const hvacAction = state.attributes[ClimateEntityAttribute.HVAC_ACTION];

		if (typeof hvacAction === 'string') {
			const heating = hvacAction.toLowerCase() === 'heating';
			const cooling = hvacAction.toLowerCase() === 'cooling';

			const heaterStateProp = await this.getValidProperty(
				properties,
				PropertyCategory.STATUS,
				ClimateEntityAttribute.HVAC_ACTION,
				[ChannelCategory.HEATER],
			);

			if (heaterStateProp) {
				mapped.set(heaterStateProp.id, heating);
			}

			const coolerStateProp = await this.getValidProperty(
				properties,
				PropertyCategory.STATUS,
				ClimateEntityAttribute.HVAC_ACTION,
				[ChannelCategory.COOLER],
			);

			if (coolerStateProp) {
				mapped.set(coolerStateProp.id, cooling);
			}
		}

		let heaterOnState: boolean = false;
		let coolerOnState: boolean = false;

		switch (state.state.toLowerCase()) {
			case 'off':
				break;

			case 'heat':
				heaterOnState = true;
				break;

			case 'cool':
				coolerOnState = true;
				break;

			case 'heat_cool':
			case 'auto':
				heaterOnState = true;
				coolerOnState = true;
				break;
		}

		const heaterOnProp = await this.getValidProperty(properties, PropertyCategory.ON, ENTITY_MAIN_STATE_ATTRIBUTE, [
			ChannelCategory.HEATER,
		]);

		if (heaterOnProp) {
			mapped.set(heaterOnProp.id, heaterOnState);
		}

		const coolerOnProp = await this.getValidProperty(properties, PropertyCategory.ON, ENTITY_MAIN_STATE_ATTRIBUTE, [
			ChannelCategory.COOLER,
		]);

		if (coolerOnProp) {
			mapped.set(coolerOnProp.id, coolerOnState);
		}

		return mapped;
	}

	async mapToHA(
		properties: HomeAssistantChannelPropertyEntity[],
		values: Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean>,
	): Promise<{
		state: string;
		service: string;
		attributes?: Map<string, string | number | number[] | boolean | null>;
	} | null> {
		const attributes: Map<string, string | number | number[] | boolean | null> = new Map();

		const heaterTargetTemperatureProp = await this.getValidProperty(
			properties,
			PropertyCategory.TEMPERATURE,
			ClimateEntityAttribute.TEMPERATURE,
			[ChannelCategory.HEATER],
		);

		if (heaterTargetTemperatureProp && values.has(heaterTargetTemperatureProp.id)) {
			attributes.set(ClimateEntityAttribute.TEMPERATURE, values.get(heaterTargetTemperatureProp.id));

			return { state: values.get(heaterTargetTemperatureProp.id).toString(), service: 'set_temperature', attributes };
		}

		const coolerTargetTemperatureProp = await this.getValidProperty(
			properties,
			PropertyCategory.TEMPERATURE,
			ClimateEntityAttribute.TEMPERATURE,
			[ChannelCategory.COOLER],
		);

		if (coolerTargetTemperatureProp && values.has(coolerTargetTemperatureProp.id)) {
			attributes.set(ClimateEntityAttribute.TEMPERATURE, values.get(coolerTargetTemperatureProp.id));

			return { state: values.get(coolerTargetTemperatureProp.id).toString(), service: 'set_temperature', attributes };
		}

		const heaterTargetTemperatureLowProp = await this.getValidProperty(
			properties,
			PropertyCategory.TEMPERATURE,
			ClimateEntityAttribute.TARGET_TEMP_LOW,
			[ChannelCategory.HEATER],
		);

		if (heaterTargetTemperatureLowProp && values.has(heaterTargetTemperatureLowProp.id)) {
			attributes.set(ClimateEntityAttribute.TARGET_TEMP_LOW, values.get(heaterTargetTemperatureLowProp.id));

			return {
				state: values.get(heaterTargetTemperatureLowProp.id).toString(),
				service: 'set_temperature',
				attributes,
			};
		}

		const coolerTargetTemperatureHighProp = await this.getValidProperty(
			properties,
			PropertyCategory.TEMPERATURE,
			ClimateEntityAttribute.TARGET_TEMP_HIGH,
			[ChannelCategory.COOLER],
		);

		if (coolerTargetTemperatureHighProp && values.has(coolerTargetTemperatureHighProp.id)) {
			attributes.set(ClimateEntityAttribute.TARGET_TEMP_HIGH, values.get(coolerTargetTemperatureHighProp.id));

			return {
				state: values.get(coolerTargetTemperatureHighProp.id).toString(),
				service: 'set_temperature',
				attributes,
			};
		}

		const heaterOnProp = await this.getValidProperty(properties, PropertyCategory.ON, ENTITY_MAIN_STATE_ATTRIBUTE, [
			ChannelCategory.HEATER,
		]);

		if (heaterOnProp && values.has(heaterOnProp.id)) {
			return {
				state: values.get(heaterOnProp.id) === true ? 'heat' : 'off',
				service: 'set_hvac_mode',
			};
		}

		const coolerOnProp = await this.getValidProperty(properties, PropertyCategory.ON, ENTITY_MAIN_STATE_ATTRIBUTE, [
			ChannelCategory.COOLER,
		]);

		if (coolerOnProp && values.has(coolerOnProp.id)) {
			return {
				state: values.get(coolerOnProp.id) === true ? 'cool' : 'off',
				service: 'set_hvac_mode',
			};
		}

		this.logger.warn('Could not map any property to Home Assistant climate entity state');

		return null;
	}
}
