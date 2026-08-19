import { Test, TestingModule } from '@nestjs/testing';

import { SpacesNotFoundException } from '../spaces.exceptions';

import { SpacesBulkService } from './spaces-bulk.service';
import { SpacesService } from './spaces.service';

describe('SpacesBulkService', () => {
	let service: SpacesBulkService;
	let spacesService: { remove: jest.Mock };

	beforeEach(async () => {
		spacesService = {
			remove: jest.fn().mockResolvedValue(undefined),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [SpacesBulkService, { provide: SpacesService, useValue: spacesService }],
		}).compile();

		service = module.get<SpacesBulkService>(SpacesBulkService);
	});

	describe('remove', () => {
		it('removes every space in the selection', async () => {
			const result = await service.remove(['a', 'b', 'c']);

			expect(result.succeeded).toEqual(['a', 'b', 'c']);
			expect(result.failed).toEqual([]);
			expect(spacesService.remove).toHaveBeenCalledTimes(3);
		});

		// A space the module refuses to remove - one that is already gone - explains
		// why, and that explanation is more use to the operator than "failed". The
		// refusal is an HttpException rather than a plain Error, so this also pins
		// that its message is what reaches the caller.
		it('carries the service refusal through as the reason', async () => {
			spacesService.remove.mockImplementation((id: string) =>
				id === 'b' ? Promise.reject(new SpacesNotFoundException('Requested space does not exist')) : Promise.resolve(),
			);

			const result = await service.remove(['a', 'b', 'c']);

			expect(result.succeeded).toEqual(['a', 'c']);
			expect(result.failed).toEqual([{ id: 'b', reason: 'Requested space does not exist' }]);
		});
	});
});
