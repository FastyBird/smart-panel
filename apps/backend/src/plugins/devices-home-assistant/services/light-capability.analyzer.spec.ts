import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { LightColorMode } from '../devices-home-assistant.constants';
import { HomeAssistantStateModel } from '../models/home-assistant.model';

import { COLOR_MODE_PROPERTIES, LightCapabilities, LightCapabilityAnalyzer } from './light-capability.analyzer';

describe('LightCapabilityAnalyzer', () => {
	let analyzer: LightCapabilityAnalyzer;

	beforeEach(() => {
		analyzer = new LightCapabilityAnalyzer();
	});

	describe('COLOR_MODE_PROPERTIES', () => {
		it('should include ON for all color modes', () => {
			for (const mode of Object.values(LightColorMode)) {
				const properties = COLOR_MODE_PROPERTIES[mode];
				expect(properties).toContain(PropertyCategory.ON);
			}
		});

		it('should include brightness for brightness mode', () => {
			expect(COLOR_MODE_PROPERTIES[LightColorMode.BRIGHTNESS]).toContain(PropertyCategory.BRIGHTNESS);
		});

		it('should include color temperature for color_temp mode', () => {
			const props = COLOR_MODE_PROPERTIES[LightColorMode.COLOR_TEMP];
			expect(props).toContain(PropertyCategory.BRIGHTNESS);
			expect(props).toContain(PropertyCategory.COLOR_TEMPERATURE);
		});

		it('should include RGB properties for rgb mode', () => {
			const props = COLOR_MODE_PROPERTIES[LightColorMode.RGB];
			expect(props).toContain(PropertyCategory.COLOR_RED);
			expect(props).toContain(PropertyCategory.COLOR_GREEN);
			expect(props).toContain(PropertyCategory.COLOR_BLUE);
		});

		it('should include RGBW properties for rgbw mode', () => {
			const props = COLOR_MODE_PROPERTIES[LightColorMode.RGBW];
			expect(props).toContain(PropertyCategory.COLOR_RED);
			expect(props).toContain(PropertyCategory.COLOR_GREEN);
			expect(props).toContain(PropertyCategory.COLOR_BLUE);
			expect(props).toContain(PropertyCategory.COLOR_WHITE);
		});

		it('should include hue/saturation for hs mode', () => {
			const props = COLOR_MODE_PROPERTIES[LightColorMode.HS];
			expect(props).toContain(PropertyCategory.HUE);
			expect(props).toContain(PropertyCategory.SATURATION);
		});
	});

	describe('analyzeCapabilities', () => {
		it('should detect brightness capability', () => {
			const state = createLightState(['brightness']);
			const capabilities = analyzer.analyzeCapabilities(state);

			expect(capabilities.hasBrightness).toBe(true);
			expect(capabilities.hasColorTemp).toBe(false);
			expect(capabilities.hasRGB).toBe(false);
		});

		it('should detect color_temp capability', () => {
			const state = createLightState(['color_temp', 'brightness']);
			const capabilities = analyzer.analyzeCapabilities(state);

			expect(capabilities.hasColorTemp).toBe(true);
			expect(capabilities.hasBrightness).toBe(true);
		});

		it('should detect RGB capability', () => {
			const state = createLightState(['rgb']);
			const capabilities = analyzer.analyzeCapabilities(state);

			expect(capabilities.hasRGB).toBe(true);
			expect(capabilities.hasBrightness).toBe(true);
		});

		it('should detect HS capability', () => {
			const state = createLightState(['hs']);
			const capabilities = analyzer.analyzeCapabilities(state);

			expect(capabilities.hasHS).toBe(true);
			expect(capabilities.hasBrightness).toBe(true);
		});

		it('should detect white capability from RGBW', () => {
			const state = createLightState(['rgbw']);
			const capabilities = analyzer.analyzeCapabilities(state);

			expect(capabilities.hasWhite).toBe(true);
			expect(capabilities.hasRGB).toBe(true);
		});

		it('should detect color_temp from RGBWW mode', () => {
			const state = createLightState(['rgbww']);
			const capabilities = analyzer.analyzeCapabilities(state);

			expect(capabilities.hasColorTemp).toBe(true);
			expect(capabilities.hasRGB).toBe(true);
			expect(capabilities.hasWhite).toBe(true);
		});

		it('should handle onoff only light', () => {
			const state = createLightState(['onoff']);
			const capabilities = analyzer.analyzeCapabilities(state);

			expect(capabilities.hasBrightness).toBe(false);
			expect(capabilities.hasColorTemp).toBe(false);
		});

		it('should extract color temp kelvin range', () => {
			const state = createLightState(['color_temp'], {
				min_color_temp_kelvin: 2700,
				max_color_temp_kelvin: 6500,
			});
			const capabilities = analyzer.analyzeCapabilities(state);

			expect(capabilities.minColorTempKelvin).toBe(2700);
			expect(capabilities.maxColorTempKelvin).toBe(6500);
		});

		it('should extract effect list', () => {
			const state = createLightState(['brightness'], {
				effect_list: ['colorloop', 'random'],
			});
			const capabilities = analyzer.analyzeCapabilities(state);

			expect(capabilities.effectList).toEqual(['colorloop', 'random']);
		});
	});

	describe('getAvailableProperties', () => {
		it('should return ON for onoff only light', () => {
			const capabilities: LightCapabilities = {
				supportedColorModes: [LightColorMode.ONOFF],
				hasBrightness: false,
				hasColorTemp: false,
				hasHS: false,
				hasRGB: false,
				hasWhite: false,
			};

			const properties = analyzer.getAvailableProperties(capabilities);

			expect(properties).toContain(PropertyCategory.ON);
			expect(properties).not.toContain(PropertyCategory.BRIGHTNESS);
		});

		it('should return brightness for dimmable light', () => {
			const capabilities: LightCapabilities = {
				supportedColorModes: [LightColorMode.BRIGHTNESS],
				hasBrightness: true,
				hasColorTemp: false,
				hasHS: false,
				hasRGB: false,
				hasWhite: false,
			};

			const properties = analyzer.getAvailableProperties(capabilities);

			expect(properties).toContain(PropertyCategory.ON);
			expect(properties).toContain(PropertyCategory.BRIGHTNESS);
		});

		it('should return color temperature for CT light', () => {
			const capabilities: LightCapabilities = {
				supportedColorModes: [LightColorMode.COLOR_TEMP],
				hasBrightness: true,
				hasColorTemp: true,
				hasHS: false,
				hasRGB: false,
				hasWhite: false,
			};

			const properties = analyzer.getAvailableProperties(capabilities);

			expect(properties).toContain(PropertyCategory.COLOR_TEMPERATURE);
			expect(properties).toContain(PropertyCategory.BRIGHTNESS);
		});

		it('should return RGB properties for RGB light', () => {
			const capabilities: LightCapabilities = {
				supportedColorModes: [LightColorMode.RGB],
				hasBrightness: true,
				hasColorTemp: false,
				hasHS: false,
				hasRGB: true,
				hasWhite: false,
			};

			const properties = analyzer.getAvailableProperties(capabilities);

			expect(properties).toContain(PropertyCategory.COLOR_RED);
			expect(properties).toContain(PropertyCategory.COLOR_GREEN);
			expect(properties).toContain(PropertyCategory.COLOR_BLUE);
		});

		it('should return hue/saturation for HS light', () => {
			const capabilities: LightCapabilities = {
				supportedColorModes: [LightColorMode.HS],
				hasBrightness: true,
				hasColorTemp: false,
				hasHS: true,
				hasRGB: false,
				hasWhite: false,
			};

			const properties = analyzer.getAvailableProperties(capabilities);

			expect(properties).toContain(PropertyCategory.HUE);
			expect(properties).toContain(PropertyCategory.SATURATION);
		});

		it('should combine properties from multiple modes', () => {
			const capabilities: LightCapabilities = {
				supportedColorModes: [LightColorMode.COLOR_TEMP, LightColorMode.HS],
				hasBrightness: true,
				hasColorTemp: true,
				hasHS: true,
				hasRGB: false,
				hasWhite: false,
			};

			const properties = analyzer.getAvailableProperties(capabilities);

			expect(properties).toContain(PropertyCategory.ON);
			expect(properties).toContain(PropertyCategory.BRIGHTNESS);
			expect(properties).toContain(PropertyCategory.COLOR_TEMPERATURE);
			expect(properties).toContain(PropertyCategory.HUE);
			expect(properties).toContain(PropertyCategory.SATURATION);
		});
	});

	describe('getHaAttributeForProperty', () => {
		it('should return fb.main_state for ON property', () => {
			expect(analyzer.getHaAttributeForProperty(PropertyCategory.ON)).toBe('fb.main_state');
		});

		it('should return brightness for BRIGHTNESS property', () => {
			expect(analyzer.getHaAttributeForProperty(PropertyCategory.BRIGHTNESS)).toBe('brightness');
		});

		it('should return color_temp_kelvin for COLOR_TEMPERATURE property', () => {
			expect(analyzer.getHaAttributeForProperty(PropertyCategory.COLOR_TEMPERATURE)).toBe('color_temp_kelvin');
		});

		it('should return hs_color for HUE property', () => {
			expect(analyzer.getHaAttributeForProperty(PropertyCategory.HUE)).toBe('hs_color');
		});

		it('should return rgb_color for COLOR_RED property', () => {
			expect(analyzer.getHaAttributeForProperty(PropertyCategory.COLOR_RED)).toBe('rgb_color');
		});
	});
});

/**
 * Helper function to create a mock light state
 */
function createLightState(
	supportedColorModes: string[],
	additionalAttributes?: Record<string, unknown>,
): HomeAssistantStateModel {
	const state = new HomeAssistantStateModel();
	state.entityId = 'light.test';
	state.state = 'off';
	state.attributes = {
		supported_color_modes: supportedColorModes,
		...additionalAttributes,
	};
	return state;
}
