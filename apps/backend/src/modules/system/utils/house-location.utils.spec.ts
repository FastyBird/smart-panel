import { ConfigService } from '../../config/services/config.service';

import { getConfigHouseLocation } from './house-location.utils';

const configWith = (latitude: unknown, longitude: unknown): ConfigService =>
	({ getModuleConfig: () => ({ latitude, longitude }) }) as unknown as ConfigService;

describe('house location', () => {
	it('reads the location when both coordinates are set', () => {
		expect(getConfigHouseLocation(configWith(-33.87, 151.21))).toEqual({ latitude: -33.87, longitude: 151.21 });
		expect(getConfigHouseLocation(configWith(0, 0))).toEqual({ latitude: 0, longitude: 0 });
	});

	it.each([
		[null, null],
		[50, null],
		[null, 14],
		[undefined, undefined],
		[91, 14],
		[50, -181],
		[Number.NaN, 14],
	])('is not set for latitude %p and longitude %p', (latitude, longitude) => {
		expect(getConfigHouseLocation(configWith(latitude, longitude))).toBeNull();
	});
});
