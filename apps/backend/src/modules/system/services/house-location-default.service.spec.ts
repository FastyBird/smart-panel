import { DataSource } from 'typeorm';

import { ConfigService } from '../../config/services/config.service';
import { WEATHER_MODULE_NAME } from '../../weather/weather.constants';
import { SYSTEM_MODULE_NAME } from '../system.constants';

import { HouseLocationDefaultService } from './house-location-default.service';

describe('HouseLocationDefaultService', () => {
	let stored: Record<string, boolean>;
	let system: { latitude: number | null; longitude: number | null };
	let weather: { primaryLocationId: string | null } | Error;
	let row: { latitude: unknown; longitude: unknown } | undefined;
	let setModuleConfig: jest.Mock;
	let where: jest.Mock;
	let service: HouseLocationDefaultService;

	beforeEach(() => {
		stored = {};
		system = { latitude: null, longitude: null };
		weather = { primaryLocationId: '2b9ed4a4-0ad6-4b65-9c8d-14d9ed8b0f53' };
		row = { latitude: 50.0755, longitude: 14.4378 };
		setModuleConfig = jest.fn();
		where = jest.fn();

		const configService = {
			isModuleConfigValueStored: (module: string, key: string) => module === SYSTEM_MODULE_NAME && stored[key] === true,
			getModuleConfig: (module: string) => {
				if (module === SYSTEM_MODULE_NAME) return system;

				if (module === WEATHER_MODULE_NAME) {
					if (weather instanceof Error) throw weather;

					return weather;
				}

				throw new Error('unknown module');
			},
			setModuleConfig,
		} as unknown as ConfigService;

		const builder = {
			select: () => builder,
			addSelect: () => builder,
			from: () => builder,
			where: (...args: unknown[]) => {
				where(...args);

				return builder;
			},
			getRawOne: () => Promise.resolve(row),
		};

		const dataSource = { createQueryBuilder: () => builder } as unknown as DataSource;

		service = new HouseLocationDefaultService(configService, dataSource);
	});

	it('copies the coordinates of the primary weather location into a configuration that never had a location', async () => {
		await expect(service.applyDefault()).resolves.toEqual({ latitude: 50.0755, longitude: 14.4378 });

		expect(where).toHaveBeenCalledWith('location.id = :id', { id: '2b9ed4a4-0ad6-4b65-9c8d-14d9ed8b0f53' });
		expect(setModuleConfig).toHaveBeenCalledWith(SYSTEM_MODULE_NAME, {
			type: SYSTEM_MODULE_NAME,
			latitude: 50.0755,
			longitude: 14.4378,
		});
	});

	it.each(['latitude', 'longitude'])('leaves a location alone once the %s was stored, also as null', async (key) => {
		stored[key] = true;

		await expect(service.applyDefault()).resolves.toBeNull();

		expect(setModuleConfig).not.toHaveBeenCalled();
	});

	it('leaves a location that is set alone', async () => {
		system = { latitude: 1, longitude: 2 };

		await expect(service.applyDefault()).resolves.toBeNull();

		expect(setModuleConfig).not.toHaveBeenCalled();
	});

	it('sets nothing without a primary weather location', async () => {
		weather = { primaryLocationId: null };

		await expect(service.applyDefault()).resolves.toBeNull();

		expect(setModuleConfig).not.toHaveBeenCalled();
	});

	it('sets nothing when the weather module has no configuration', async () => {
		weather = new Error('Configuration module not found');

		await expect(service.applyDefault()).resolves.toBeNull();

		expect(setModuleConfig).not.toHaveBeenCalled();
	});

	it.each([
		['a city-name location without coordinates', { latitude: null, longitude: null }],
		['a location with one coordinate', { latitude: 50, longitude: null }],
		['coordinates out of range', { latitude: 95, longitude: 14 }],
		['a location that is gone', undefined],
	])('sets nothing for %s', async (_, found) => {
		row = found;

		await expect(service.applyDefault()).resolves.toBeNull();

		expect(setModuleConfig).not.toHaveBeenCalled();
	});

	it('does not fail the start when the configuration can not be written', async () => {
		setModuleConfig.mockImplementation(() => {
			throw new Error('disk full');
		});

		await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
	});
});
