import { WeatherModule } from './weather.module';

describe('WeatherModule managed refresh runtime', () => {
	it('registers the hourly refresh service during module initialization', () => {
		const registerManagedService = jest.fn();
		const weatherService = {};
		const module = new WeatherModule(
			{ register: jest.fn() } as never,
			{ registerMapping: jest.fn() } as never,
			{ registerModuleMetadata: jest.fn() } as never,
			{ register: registerManagedService } as never,
			weatherService as never,
			{ seed: jest.fn() } as never,
			{ reset: jest.fn() } as never,
			{ register: jest.fn() } as never,
			{ register: jest.fn() } as never,
		);

		module.onModuleInit();

		expect(registerManagedService).toHaveBeenCalledWith(weatherService);
	});
});
