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
				this.logger.debug(`HVAC action → heater state: ${heating}`);

				mapped.set(heaterStateProp.id, heating);
			}

			const coolerStateProp = await this.getValidProperty(
				properties,
				PropertyCategory.STATUS,
				ClimateEntityAttribute.HVAC_ACTION,
				[ChannelCategory.COOLER],
			);

			if (coolerStateProp) {
				this.logger.debug(`HVAC action → cooler state: ${cooling}`);

				mapped.set(coolerStateProp.id, cooling);
			}
		}

		let thermostatState: boolean = false;
		let heaterOnState: boolean = false;
		let coolerOnState: boolean = false;
		let thermostatMode: string | null = null;

		switch (state.state.toLowerCase()) {
			case 'off':
				thermostatState = false;
				thermostatMode = 'auto';
				break;

			case 'heat':
				thermostatState = true;
				heaterOnState = true;
				thermostatMode = 'heat';
				break;

			case 'cool':
				thermostatState = true;
				coolerOnState = true;
				thermostatMode = 'cool';
				break;

			case 'heat_cool':
			case 'auto':
				thermostatState = true;
				heaterOnState = true;
				coolerOnState = true;
				thermostatMode = 'auto';
				break;
		}

		const thermostatStateProp = await this.getValidProperty(
			properties,
			PropertyCategory.ACTIVE,
			ENTITY_MAIN_STATE_ATTRIBUTE,
			[ChannelCategory.THERMOSTAT],
		);

		if (thermostatStateProp) {
			mapped.set(thermostatStateProp.id, thermostatState);
		}

		const thermostatModeProp = await this.getValidProperty(
			properties,
			PropertyCategory.MODE,
			ENTITY_MAIN_STATE_ATTRIBUTE,
			[ChannelCategory.THERMOSTAT],
		);

		if (thermostatModeProp) {
			mapped.set(thermostatModeProp.id, thermostatMode);
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

		this.logger.debug('Received climate entity state was mapped to system properties');

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

			this.logger.debug(`Setting target HEATER temperature to ${values.get(heaterTargetTemperatureProp.id)}`);

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

			this.logger.debug(`Setting target COOLER temperature to ${values.get(coolerTargetTemperatureProp.id)}`);

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

			this.logger.debug(`Setting target HEATER low temperature to ${values.get(heaterTargetTemperatureLowProp.id)}`);

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

			this.logger.debug(`Setting target COOLER high temperature to ${values.get(coolerTargetTemperatureHighProp.id)}`);

			return {
				state: values.get(coolerTargetTemperatureHighProp.id).toString(),
				service: 'set_temperature',
				attributes,
			};
		}

		const thermostatActiveProp = await this.getValidProperty(
			properties,
			PropertyCategory.ACTIVE,
			ENTITY_MAIN_STATE_ATTRIBUTE,
			[ChannelCategory.THERMOSTAT],
		);

		if (thermostatActiveProp && values.has(thermostatActiveProp.id)) {
			return {
				state: values.get(thermostatActiveProp.id) === true ? 'auto' : 'off',
				service: values.get(thermostatActiveProp.id) === true ? 'turn_on' : 'turn_off',
			};
		}

		const thermostatModeProp = await this.getValidProperty(
			properties,
			PropertyCategory.MODE,
			ENTITY_MAIN_STATE_ATTRIBUTE,
			[ChannelCategory.THERMOSTAT],
		);

		if (thermostatModeProp && values.has(thermostatModeProp.id)) {
			return {
				state: values.get(thermostatModeProp.id).toString(),
				service: 'set_hvac_mode',
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
