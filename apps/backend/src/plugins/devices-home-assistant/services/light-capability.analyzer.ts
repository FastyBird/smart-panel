import { Injectable, Logger } from '@nestjs/common';

import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { LightColorMode } from '../devices-home-assistant.constants';
import { HomeAssistantStateModel } from '../models/home-assistant.model';

/**
 * Maps color modes to the properties they support
 */
export const COLOR_MODE_PROPERTIES: Record<LightColorMode, PropertyCategory[]> = {
	[LightColorMode.UNKNOWN]: [PropertyCategory.ON],
	[LightColorMode.ONOFF]: [PropertyCategory.ON],
	[LightColorMode.BRIGHTNESS]: [PropertyCategory.ON, PropertyCategory.BRIGHTNESS],
	[LightColorMode.COLOR_TEMP]: [PropertyCategory.ON, PropertyCategory.BRIGHTNESS, PropertyCategory.COLOR_TEMPERATURE],
	[LightColorMode.HS]: [
		PropertyCategory.ON,
		PropertyCategory.BRIGHTNESS,
		PropertyCategory.HUE,
		PropertyCategory.SATURATION,
	],
	[LightColorMode.XY]: [
		PropertyCategory.ON,
		PropertyCategory.BRIGHTNESS,
		// XY is typically converted to HS internally
		PropertyCategory.HUE,
		PropertyCategory.SATURATION,
	],
	[LightColorMode.RGB]: [
		PropertyCategory.ON,
		PropertyCategory.BRIGHTNESS,
		PropertyCategory.COLOR_RED,
		PropertyCategory.COLOR_GREEN,
		PropertyCategory.COLOR_BLUE,
	],
	[LightColorMode.RGBW]: [
		PropertyCategory.ON,
		PropertyCategory.BRIGHTNESS,
		PropertyCategory.COLOR_RED,
		PropertyCategory.COLOR_GREEN,
		PropertyCategory.COLOR_BLUE,
		PropertyCategory.COLOR_WHITE,
	],
	[LightColorMode.RGBWW]: [
		PropertyCategory.ON,
		PropertyCategory.BRIGHTNESS,
		PropertyCategory.COLOR_RED,
		PropertyCategory.COLOR_GREEN,
		PropertyCategory.COLOR_BLUE,
		PropertyCategory.COLOR_WHITE,
		PropertyCategory.COLOR_TEMPERATURE,
	],
	[LightColorMode.WHITE]: [PropertyCategory.ON, PropertyCategory.BRIGHTNESS, PropertyCategory.COLOR_WHITE],
};

export interface LightCapabilities {
	supportedColorModes: LightColorMode[];
	hasBrightness: boolean;
	hasColorTemp: boolean;
	hasHS: boolean;
	hasRGB: boolean;
	hasWhite: boolean;
	minColorTempKelvin?: number;
	maxColorTempKelvin?: number;
	effectList?: string[];
}

@Injectable()
export class LightCapabilityAnalyzer {
	private readonly logger = new Logger(LightCapabilityAnalyzer.name);

	/**
	 * Analyze light entity capabilities from its attributes
	 */
	analyzeCapabilities(state: HomeAssistantStateModel): LightCapabilities {
		const supportedModes = ((state.attributes?.supported_color_modes as string[]) ?? []).map(
			(m) => m as LightColorMode,
		);

		const hasColorTemp =
			supportedModes.includes(LightColorMode.COLOR_TEMP) || supportedModes.includes(LightColorMode.RGBWW);

		const hasRGB =
			supportedModes.includes(LightColorMode.RGB) ||
			supportedModes.includes(LightColorMode.RGBW) ||
			supportedModes.includes(LightColorMode.RGBWW);

		const hasHS = supportedModes.includes(LightColorMode.HS) || supportedModes.includes(LightColorMode.XY);

		const hasWhite =
			supportedModes.includes(LightColorMode.WHITE) ||
			supportedModes.includes(LightColorMode.RGBW) ||
			supportedModes.includes(LightColorMode.RGBWW);

		const hasBrightness =
			supportedModes.length > 0 &&
			!supportedModes.every((m) => m === LightColorMode.ONOFF || m === LightColorMode.UNKNOWN);

		return {
			supportedColorModes: supportedModes,
			hasBrightness,
			hasColorTemp,
			hasHS,
			hasRGB,
			hasWhite,
			minColorTempKelvin: state.attributes?.min_color_temp_kelvin as number | undefined,
			maxColorTempKelvin: state.attributes?.max_color_temp_kelvin as number | undefined,
			effectList: state.attributes?.effect_list as string[] | undefined,
		};
	}

	/**
	 * Get all properties that should be offered for a light based on capabilities
	 */
	getAvailableProperties(capabilities: LightCapabilities): PropertyCategory[] {
		const properties = new Set<PropertyCategory>([PropertyCategory.ON]);

		// Add properties based on each supported color mode
		for (const mode of capabilities.supportedColorModes) {
			const modeProperties = COLOR_MODE_PROPERTIES[mode] ?? [];
			for (const prop of modeProperties) {
				properties.add(prop);
			}
		}

		// If no modes specified but we have brightness attribute, add it
		if (capabilities.hasBrightness) {
			properties.add(PropertyCategory.BRIGHTNESS);
		}

		this.logger.debug(
			`[LIGHT CAPABILITY] Detected properties: ${Array.from(properties).join(', ')} ` +
				`from modes: ${capabilities.supportedColorModes.join(', ')}`,
		);

		return Array.from(properties);
	}

	/**
	 * Get the HA attribute name for a property category based on light capabilities
	 */
	getHaAttributeForProperty(propertyCategory: PropertyCategory, capabilities?: LightCapabilities): string {
		// For color properties, we need to check the light's actual color modes
		if (
			propertyCategory === PropertyCategory.COLOR_RED ||
			propertyCategory === PropertyCategory.COLOR_GREEN ||
			propertyCategory === PropertyCategory.COLOR_BLUE
		) {
			if (capabilities) {
				// Check color modes in order of specificity
				if (capabilities.supportedColorModes.includes(LightColorMode.RGBWW)) {
					return 'rgbww_color';
				}
				if (capabilities.supportedColorModes.includes(LightColorMode.RGBW)) {
					return 'rgbw_color';
				}
			}
			return 'rgb_color';
		}

		if (propertyCategory === PropertyCategory.COLOR_WHITE) {
			if (capabilities) {
				// For RGBW/RGBWW lights, white is in the color array
				if (capabilities.supportedColorModes.includes(LightColorMode.RGBWW)) {
					return 'rgbww_color';
				}
				if (capabilities.supportedColorModes.includes(LightColorMode.RGBW)) {
					return 'rgbw_color';
				}
			}
			return 'white';
		}

		const attributeMap: Partial<Record<PropertyCategory, string>> = {
			[PropertyCategory.ON]: 'fb.main_state',
			[PropertyCategory.BRIGHTNESS]: 'brightness',
			[PropertyCategory.COLOR_TEMPERATURE]: 'color_temp_kelvin',
			[PropertyCategory.HUE]: 'hs_color',
			[PropertyCategory.SATURATION]: 'hs_color',
		};

		return attributeMap[propertyCategory] ?? 'fb.main_state';
	}
}
