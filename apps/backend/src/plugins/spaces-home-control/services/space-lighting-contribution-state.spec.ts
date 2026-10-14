import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { LightingRole } from '../spaces-home-control.constants';

import { SpaceLightingStateService } from './space-lighting-state.service';

const service = new SpaceLightingStateService({} as never, {} as never, {} as never);
const composite = (mixedProperties: PropertyCategory[] = []) => ({
	isOn: true,
	brightness: 50,
	colorTemperature: null,
	colorRed: null,
	colorGreen: null,
	colorBlue: null,
	colorHue: null,
	colorSaturation: null,
	white: null,
	coverage: {
		leaves: ['on', 'off', 'missing'],
		reported: {
			total: 3,
			on: 1,
			unknown: 1,
			mixed: true,
			mixedProperties,
			onBrightness: { sum: 100, count: 1 },
			properties: [{ category: PropertyCategory.BRIGHTNESS, value: 50, contributors: 2 }],
		},
	},
});
describe('room physical contribution presentation', () => {
	it('averages qualified ON brightness only while retaining OFF and missing physical counts', () => {
		expect(service['calculateSummary']([composite() as never])).toMatchObject({
			totalLights: 3,
			lightsOn: 1,
			unknownLights: 1,
			averageBrightness: 100,
		});
	});
	it.each([
		PropertyCategory.COLOR_GREEN,
		PropertyCategory.COLOR_BLUE,
		PropertyCategory.HUE,
		PropertyCategory.SATURATION,
		PropertyCategory.COLOR_WHITE,
	])('reports mixed %s even when red agrees', (category) => {
		expect(
			service['aggregateLightGroup'](LightingRole.OTHER, [composite([category]) as never], null).isColorMixed,
		).toBe(true);
	});
});
