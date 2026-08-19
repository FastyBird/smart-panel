import { Test, TestingModule } from '@nestjs/testing';

import { WeatherValidationException } from '../weather.exceptions';

import { LocationsBulkService } from './locations-bulk.service';
import { LocationsService } from './locations.service';

describe('LocationsBulkService', () => {
	let service: LocationsBulkService;
	let locationsService: { remove: jest.Mock };

	beforeEach(async () => {
		locationsService = {
			remove: jest.fn().mockResolvedValue(undefined),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [LocationsBulkService, { provide: LocationsService, useValue: locationsService }],
		}).compile();

		service = module.get<LocationsBulkService>(LocationsBulkService);
	});

	describe('remove', () => {
		it('removes every location in the selection', async () => {
			const result = await service.remove(['a', 'b', 'c']);

			expect(result.succeeded).toEqual(['a', 'b', 'c']);
			expect(result.failed).toEqual([]);
			expect(locationsService.remove).toHaveBeenCalledTimes(3);
		});

		// A location the module refuses to delete - a missing one - explains why,
		// and that explanation is more use to the operator than "failed".
		it('carries the service refusal through as the reason', async () => {
			locationsService.remove.mockImplementation((id: string) =>
				id === 'b' ? Promise.reject(new Error('Location does not exist')) : Promise.resolve(),
			);

			const result = await service.remove(['a', 'b', 'c']);

			expect(result.succeeded).toEqual(['a', 'c']);
			expect(result.failed).toEqual([{ id: 'b', reason: 'Location does not exist' }]);
		});

		// The primary location is protected by the single-location delete, so the
		// bulk path must report that refusal rather than delete around it.
		it('reports the primary location the service protects', async () => {
			locationsService.remove.mockImplementation((id: string) =>
				id === 'primary'
					? Promise.reject(
							new WeatherValidationException(
								'Cannot delete the primary weather location. Please set a different primary location first.',
							),
						)
					: Promise.resolve(),
			);

			const result = await service.remove(['a', 'primary']);

			expect(result.succeeded).toEqual(['a']);
			expect(result.failed).toEqual([
				{
					id: 'primary',
					reason: 'Cannot delete the primary weather location. Please set a different primary location first.',
				},
			]);
		});
	});
});
