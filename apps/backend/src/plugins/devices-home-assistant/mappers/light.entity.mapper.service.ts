import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import {
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	ENTITY_MAIN_STATE_ATTRIBUTE,
	HomeAssistantDomain,
	LightEntityAttribute,
} from '../devices-home-assistant.constants';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { HomeAssistantChannelPropertyEntity } from '../entities/devices-home-assistant.entity';

import { EntityMapper } from './entity.mapper';

@Injectable()
export class LightEntityMapperService extends EntityMapper {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'LightEntityMapperService',
	);

	get domain(): HomeAssistantDomain {
		return HomeAssistantDomain.LIGHT;
	}

	async mapFromHA(
		properties: HomeAssistantChannelPropertyEntity[],
		state: HomeAssistantStateDto,
	): Promise<Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null>> {
		const mapped: Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null> = new Map();

		// Debug: Log available properties and their haAttribute values
		this.logger.debug(
			`[LIGHT ENTITY MAPPER] mapFromHA called with ${properties.length} properties for entity ${state.entity_id}`,
		);
		this.logger.debug(
			`[LIGHT ENTITY MAPPER] Properties: ${properties.map((p) => `${p.category}:${p.haAttribute}`).join(', ')}`,
		);
		this.logger.debug(`[LIGHT ENTITY MAPPER] State attributes: ${Object.keys(state.attributes).join(', ')}`);

		const brightness = state.attributes[LightEntityAttribute.BRIGHTNESS];

		this.logger.debug(`[LIGHT ENTITY MAPPER] Brightness from HA: ${String(brightness)} (type: ${typeof brightness})`);

		if (typeof brightness === 'number') {
			const brightnessProp = await this.getValidProperty(
				properties,
				PropertyCategory.BRIGHTNESS,
				LightEntityAttribute.BRIGHTNESS,
				[ChannelCategory.LIGHT],
			);

			this.logger.debug(
				`[LIGHT ENTITY MAPPER] Brightness prop found: ${!!brightnessProp}, ` +
					`looking for haAttribute='${LightEntityAttribute.BRIGHTNESS}'`,
			);

			if (brightnessProp) {
				const mappedValue = Math.round((brightness / 255) * 100);
				mapped.set(brightnessProp.id, mappedValue);
				this.logger.debug(`[LIGHT ENTITY MAPPER] Mapped brightness: ${brightness} (0-255) -> ${mappedValue}% (0-100)`);
			} else {
				// Check what haAttribute the brightness property actually has
				const anyBrightnessProp = properties.find((p) => p.category === PropertyCategory.BRIGHTNESS);
				if (anyBrightnessProp) {
					this.logger.warn(
						`[LIGHT ENTITY MAPPER] Brightness property exists but haAttribute mismatch: ` +
							`expected '${LightEntityAttribute.BRIGHTNESS}', got '${anyBrightnessProp.haAttribute}'`,
					);
				} else {
					this.logger.warn(`[LIGHT ENTITY MAPPER] No brightness property found at all`);
				}
			}
		}

		const brightnessPct = state.attributes[LightEntityAttribute.BRIGHTNESS_PCT];

		if (typeof brightnessPct === 'number') {
			const brightnessProp = await this.getValidProperty(
				properties,
				PropertyCategory.BRIGHTNESS,
				LightEntityAttribute.BRIGHTNESS_PCT,
				[ChannelCategory.LIGHT],
			);

			if (brightnessProp) {
				mapped.set(brightnessProp.id, brightnessPct);
			}
		}

		const colorTemperature = state.attributes[LightEntityAttribute.COLOR_TEMP_KELVIN];

		if (typeof colorTemperature === 'number') {
			const temperatureProp = await this.getValidProperty(
				properties,
				PropertyCategory.COLOR_TEMPERATURE,
				LightEntityAttribute.COLOR_TEMP_KELVIN,
				[ChannelCategory.LIGHT],
			);

			if (temperatureProp) {
				mapped.set(temperatureProp.id, colorTemperature);
			}
		}

		const colorWhite = state.attributes[LightEntityAttribute.WHITE];

		if (typeof colorWhite === 'number') {
			const temperatureProp = await this.getValidProperty(
				properties,
				PropertyCategory.COLOR_WHITE,
				LightEntityAttribute.WHITE,
				[ChannelCategory.LIGHT],
			);

			if (temperatureProp) {
				mapped.set(temperatureProp.id, colorWhite);
			}
		}

		const hsColor = state.attributes[LightEntityAttribute.HS_COLOR];

		if (Array.isArray(hsColor) && hsColor.length === 2) {
			const [hue, saturation] = hsColor as [number, number];

			const hueProp = await this.getValidProperty(properties, PropertyCategory.HUE, LightEntityAttribute.HS_COLOR, [
				ChannelCategory.LIGHT,
			]);
			const saturationProp = await this.getValidProperty(
				properties,
				PropertyCategory.SATURATION,
				LightEntityAttribute.HS_COLOR,
				[ChannelCategory.LIGHT],
			);

			if (hueProp && typeof hue === 'number' && saturationProp && typeof saturation === 'number') {
				mapped.set(hueProp.id, hue);
				mapped.set(saturationProp.id, saturation);
			}
		}

		const rgbColor = state.attributes[LightEntityAttribute.RGB_COLOR];

		if (Array.isArray(rgbColor) && rgbColor.length === 3) {
			const [r, g, b] = rgbColor as [number, number, number];

			const redProp = await this.getValidProperty(
				properties,
				PropertyCategory.COLOR_RED,
				LightEntityAttribute.RGB_COLOR,
				[ChannelCategory.LIGHT],
			);
			const greenProp = await this.getValidProperty(
				properties,
				PropertyCategory.COLOR_GREEN,
				LightEntityAttribute.RGB_COLOR,
				[ChannelCategory.LIGHT],
			);
			const blueProp = await this.getValidProperty(
				properties,
				PropertyCategory.COLOR_BLUE,
				LightEntityAttribute.RGB_COLOR,
				[ChannelCategory.LIGHT],
			);

			if (redProp && typeof r === 'number' && greenProp && typeof g === 'number' && blueProp && typeof b === 'number') {
				mapped.set(redProp.id, r);
				mapped.set(greenProp.id, g);
				mapped.set(blueProp.id, b);
			}
		}

		const rgbwColor = state.attributes[LightEntityAttribute.RGBW_COLOR];

		if (Array.isArray(rgbwColor) && rgbwColor.length === 4) {
			const [r, g, b, w] = rgbwColor as [number, number, number, number];

			this.logger.debug(`[LIGHT ENTITY MAPPER] Received rgbw_color: [${r}, ${g}, ${b}, ${w}]`);

			const redProp = await this.getValidProperty(
				properties,
				PropertyCategory.COLOR_RED,
				LightEntityAttribute.RGBW_COLOR,
				[ChannelCategory.LIGHT],
			);
			const greenProp = await this.getValidProperty(
				properties,
				PropertyCategory.COLOR_GREEN,
				LightEntityAttribute.RGBW_COLOR,
				[ChannelCategory.LIGHT],
			);
			const blueProp = await this.getValidProperty(
				properties,
				PropertyCategory.COLOR_BLUE,
				LightEntityAttribute.RGBW_COLOR,
				[ChannelCategory.LIGHT],
			);
			const whiteProp = await this.getValidProperty(
				properties,
				PropertyCategory.COLOR_WHITE,
				LightEntityAttribute.RGBW_COLOR,
				[ChannelCategory.LIGHT],
			);

			this.logger.debug(
				`[LIGHT ENTITY MAPPER] RGBW props found: red=${!!redProp}, green=${!!greenProp}, blue=${!!blueProp}, white=${!!whiteProp}`,
			);

			if (
				redProp &&
				typeof r === 'number' &&
				greenProp &&
				typeof g === 'number' &&
				blueProp &&
				typeof b === 'number' &&
				whiteProp &&
				typeof w === 'number'
			) {
				mapped.set(redProp.id, r);
				mapped.set(greenProp.id, g);
				mapped.set(blueProp.id, b);
				mapped.set(whiteProp.id, w);
				this.logger.debug(`[LIGHT ENTITY MAPPER] Mapped RGBW values: r=${r}, g=${g}, b=${b}, w=${w}`);
			} else {
				this.logger.warn(
					`[LIGHT ENTITY MAPPER] Could not map RGBW - missing properties or invalid values. ` +
						`Props: red=${!!redProp}, green=${!!greenProp}, blue=${!!blueProp}, white=${!!whiteProp}`,
				);
			}
		}

		const stateProp = await this.getValidProperty(properties, PropertyCategory.ON, ENTITY_MAIN_STATE_ATTRIBUTE, [
			ChannelCategory.LIGHT,
		]);

		if (stateProp) {
			mapped.set(stateProp.id, state.state.toLowerCase() === 'on');
		} else {
			this.logger.warn('[LIGHT ENTITY MAPPER] Missing main state property');
		}

		this.logger.debug('[LIGHT ENTITY MAPPER] Received light entity state was mapped to system properties');

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
		const onProp = await this.getValidProperty(properties, PropertyCategory.ON, ENTITY_MAIN_STATE_ATTRIBUTE, [
			ChannelCategory.LIGHT,
		]);

		if (!onProp) {
			this.logger.warn('[LIGHT ENTITY MAPPER] Missing main state property');
			return null;
		}

		const isOn = values.has(onProp.id) ? values.get(onProp.id) : onProp.value;

		const state = isOn === true ? 'on' : 'off';

		const service = isOn === true ? 'turn_on' : 'turn_off';

		const attributes: Map<string, string | number | number[] | boolean | null> = new Map();

		const hueProp = await this.getValidProperty(properties, PropertyCategory.HUE, LightEntityAttribute.HS_COLOR, [
			ChannelCategory.LIGHT,
		]);

		const saturationProp = await this.getValidProperty(
			properties,
			PropertyCategory.SATURATION,
			LightEntityAttribute.HS_COLOR,
			[ChannelCategory.LIGHT],
		);

		if (hueProp && saturationProp && (values.has(hueProp.id) || values.has(saturationProp.id))) {
			const hue = this.toNumber(values.has(hueProp.id) ? values.get(hueProp.id) : hueProp.value);
			const saturation = this.toNumber(
				values.has(saturationProp.id) ? values.get(saturationProp.id) : saturationProp.value,
			);

			if (hue !== null && saturation !== null) {
				attributes.set(LightEntityAttribute.HS_COLOR, [hue, saturation]);
			}
		}

		const rgbRProp = await this.getValidProperty(
			properties,
			PropertyCategory.COLOR_RED,
			LightEntityAttribute.RGB_COLOR,
			[ChannelCategory.LIGHT],
		);
		const rgbGProp = await this.getValidProperty(
			properties,
			PropertyCategory.COLOR_GREEN,
			LightEntityAttribute.RGB_COLOR,
			[ChannelCategory.LIGHT],
		);
		const rgbBProp = await this.getValidProperty(
			properties,
			PropertyCategory.COLOR_BLUE,
			LightEntityAttribute.RGB_COLOR,
			[ChannelCategory.LIGHT],
		);

		if (
			rgbRProp &&
			rgbGProp &&
			rgbBProp &&
			(values.has(rgbRProp.id) || values.has(rgbGProp.id) || values.has(rgbBProp.id))
		) {
			const rgbR = this.toNumber(values.has(rgbRProp.id) ? values.get(rgbRProp.id) : rgbRProp.value);
			const rgbG = this.toNumber(values.has(rgbGProp.id) ? values.get(rgbGProp.id) : rgbGProp.value);
			const rgbB = this.toNumber(values.has(rgbBProp.id) ? values.get(rgbBProp.id) : rgbBProp.value);

			if (rgbR !== null && rgbG !== null && rgbB !== null) {
				attributes.set(LightEntityAttribute.RGB_COLOR, [rgbR, rgbG, rgbB]);
			}
		}

		const rgbwRProp = await this.getValidProperty(
			properties,
			PropertyCategory.COLOR_RED,
			LightEntityAttribute.RGBW_COLOR,
			[ChannelCategory.LIGHT],
		);
		const rgbwGProp = await this.getValidProperty(
			properties,
			PropertyCategory.COLOR_GREEN,
			LightEntityAttribute.RGBW_COLOR,
			[ChannelCategory.LIGHT],
		);
		const rgbwBProp = await this.getValidProperty(
			properties,
			PropertyCategory.COLOR_BLUE,
			LightEntityAttribute.RGBW_COLOR,
			[ChannelCategory.LIGHT],
		);
		const rgbwWProp = await this.getValidProperty(
			properties,
			PropertyCategory.COLOR_WHITE,
			LightEntityAttribute.RGBW_COLOR,
			[ChannelCategory.LIGHT],
		);

		if (
			rgbwRProp &&
			rgbwGProp &&
			rgbwBProp &&
			rgbwWProp &&
			(values.has(rgbwRProp.id) || values.has(rgbwGProp.id) || values.has(rgbwBProp.id) || values.has(rgbwWProp.id))
		) {
			const rgbwR = this.toNumber(values.has(rgbwRProp.id) ? values.get(rgbwRProp.id) : rgbwRProp.value);
			const rgbwG = this.toNumber(values.has(rgbwGProp.id) ? values.get(rgbwGProp.id) : rgbwGProp.value);
			const rgbwB = this.toNumber(values.has(rgbwBProp.id) ? values.get(rgbwBProp.id) : rgbwBProp.value);
			const rgbwW = this.toNumber(values.has(rgbwWProp.id) ? values.get(rgbwWProp.id) : rgbwWProp.value);

			if (rgbwR !== null && rgbwG !== null && rgbwB !== null && rgbwW !== null) {
				attributes.set(LightEntityAttribute.RGBW_COLOR, [rgbwR, rgbwG, rgbwB, rgbwW]);
			}
		}

		const colorWhiteProp = await this.getValidProperty(
			properties,
			PropertyCategory.COLOR_WHITE,
			LightEntityAttribute.WHITE,
			[ChannelCategory.LIGHT],
		);

		if (colorWhiteProp && values.has(colorWhiteProp.id)) {
			if (typeof values.get(colorWhiteProp.id) === 'number') {
				attributes.set(LightEntityAttribute.WHITE, values.get(colorWhiteProp.id));
			}
		}

		const colorTemperatureProp = await this.getValidProperty(
			properties,
			PropertyCategory.COLOR_TEMPERATURE,
			LightEntityAttribute.COLOR_TEMP_KELVIN,
			[ChannelCategory.LIGHT],
		);

		if (colorTemperatureProp && values.has(colorTemperatureProp.id)) {
			if (typeof values.get(colorTemperatureProp.id) === 'number') {
				attributes.set(LightEntityAttribute.COLOR_TEMP_KELVIN, values.get(colorTemperatureProp.id));
			}
		}

		const brightnessProp = await this.getValidProperty(
			properties,
			PropertyCategory.BRIGHTNESS,
			LightEntityAttribute.BRIGHTNESS,
			[ChannelCategory.LIGHT],
		);

		if (brightnessProp && values.has(brightnessProp.id) && typeof values.get(brightnessProp.id) === 'number') {
			if (typeof values.get(brightnessProp.id) === 'number') {
				attributes.set(
					LightEntityAttribute.BRIGHTNESS,
					Math.round((Number(values.get(brightnessProp.id)) / 100) * 255),
				);
			}
		}

		const brightnessPctProp = await this.getValidProperty(
			properties,
			PropertyCategory.BRIGHTNESS,
			LightEntityAttribute.BRIGHTNESS_PCT,
			[ChannelCategory.LIGHT],
		);

		if (brightnessPctProp && values.has(brightnessPctProp.id) && typeof values.get(brightnessPctProp.id) === 'number') {
			if (typeof values.get(brightnessPctProp.id) === 'number') {
				attributes.set(LightEntityAttribute.BRIGHTNESS_PCT, values.get(brightnessPctProp.id));
			}
		}

		this.logger.debug('[LIGHT ENTITY MAPPER] Received properties were mapped to Home Assistant entity state');

		return { state, service, attributes };
	}

	/**
	 * Convert a value to a number, handling strings stored in the database
	 */
	private toNumber(value: string | number | boolean | null | undefined): number | null {
		if (value === null || value === undefined) {
			return null;
		}

		if (typeof value === 'number') {
			return value;
		}

		if (typeof value === 'string') {
			const parsed = parseFloat(value);
			return isNaN(parsed) ? null : parsed;
		}

		if (typeof value === 'boolean') {
			return value ? 1 : 0;
		}

		return null;
	}
}
