import { Injectable, Logger } from '@nestjs/common';

import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import {
	ENTITY_MAIN_STATE_ATTRIBUTE,
	HomeAssistantDomain,
	LightEntityAttribute,
} from '../devices-home-assistant.constants';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { HomeAssistantChannelPropertyEntity } from '../entities/devices-home-assistant.entity';

import { EntityMapper } from './entity.mapper';

@Injectable()
export class LightEntityMapperService extends EntityMapper {
	private readonly logger = new Logger(LightEntityMapperService.name);

	get domain(): HomeAssistantDomain {
		return HomeAssistantDomain.LIGHT;
	}

	async mapFromHA(
		properties: HomeAssistantChannelPropertyEntity[],
		state: HomeAssistantStateDto,
	): Promise<Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null>> {
		const mapped: Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null> = new Map();

		const brightness = state.attributes[LightEntityAttribute.BRIGHTNESS];

		if (typeof brightness === 'number') {
			const brightnessProp = await this.getValidProperty(
				properties,
				PropertyCategory.BRIGHTNESS,
				LightEntityAttribute.BRIGHTNESS,
				[ChannelCategory.LIGHT],
			);

			if (brightnessProp) {
				mapped.set(brightnessProp.id, Math.round((brightness / 255) * 100));
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
			return null;
		} else {
			this.logger.warn('[LIGHT ENTITY MAPPER] Missing main state property');
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
			const hue = values.has(hueProp.id) ? values.get(hueProp.id) : hueProp.value;
			const saturation = values.has(saturationProp.id) ? values.get(saturationProp.id) : saturationProp.value;

			if (typeof hue === 'number' && typeof saturation === 'number') {
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
			const rgbR = values.has(rgbRProp.id) ? values.get(rgbRProp.id) : rgbRProp.value;
			const rgbG = values.has(rgbGProp.id) ? values.get(rgbGProp.id) : rgbGProp.value;
			const rgbB = values.has(rgbBProp.id) ? values.get(rgbBProp.id) : rgbBProp.value;

			if (typeof rgbR === 'number' && typeof rgbG === 'number' && typeof rgbB === 'number') {
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
			(values.has(rgbRProp.id) || values.has(rgbwGProp.id) || values.has(rgbwBProp.id) || values.has(rgbwWProp.id))
		) {
			const rgbwR = values.has(rgbwRProp.id) ? values.get(rgbwRProp.id) : rgbwRProp.value;
			const rgbwG = values.has(rgbwGProp.id) ? values.get(rgbwGProp.id) : rgbwGProp.value;
			const rgbwB = values.has(rgbwBProp.id) ? values.get(rgbwBProp.id) : rgbwBProp.value;
			const rgbwW = values.has(rgbwWProp.id) ? values.get(rgbwWProp.id) : rgbwWProp.value;

			if (
				typeof rgbwR === 'number' &&
				typeof rgbwG === 'number' &&
				typeof rgbwB === 'number' &&
				typeof rgbwW === 'number'
			) {
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
				attributes.set(LightEntityAttribute.WHITE, values.get(colorTemperatureProp.id));
			}
		}

		const colorBrightnessProp = await this.getValidProperty(
			properties,
			PropertyCategory.BRIGHTNESS,
			LightEntityAttribute.BRIGHTNESS,
			[ChannelCategory.LIGHT],
		);

		if (colorBrightnessProp && values.has(colorBrightnessProp.id)) {
			if (typeof values.get(colorBrightnessProp.id) === 'number') {
				attributes.set(LightEntityAttribute.WHITE, values.get(colorBrightnessProp.id));
			}
		}

		const colorBrightnessPctProp = await this.getValidProperty(
			properties,
			PropertyCategory.BRIGHTNESS,
			LightEntityAttribute.BRIGHTNESS_PCT,
			[ChannelCategory.LIGHT],
		);

		if (colorBrightnessPctProp && values.has(colorBrightnessPctProp.id)) {
			if (typeof values.get(colorBrightnessPctProp.id) === 'number') {
				attributes.set(LightEntityAttribute.WHITE, values.get(colorBrightnessPctProp.id));
			}
		}

		this.logger.debug('[LIGHT ENTITY MAPPER] Received properties were mapped to Home Assistant entity state');

		return { state, service, attributes };
	}
}
