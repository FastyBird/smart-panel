import { Test, TestingModule } from '@nestjs/testing';

import { DisplaysBulkService } from './displays-bulk.service';
import { DisplaysService } from './displays.service';

describe('DisplaysBulkService', () => {
	let service: DisplaysBulkService;
	let displaysService: { remove: jest.Mock };

	beforeEach(async () => {
		displaysService = {
			remove: jest.fn().mockResolvedValue(undefined),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [DisplaysBulkService, { provide: DisplaysService, useValue: displaysService }],
		}).compile();

		service = module.get<DisplaysBulkService>(DisplaysBulkService);
	});

	describe('remove', () => {
		it('removes every display in the selection', async () => {
			const result = await service.remove(['a', 'b', 'c']);

			expect(result.succeeded).toEqual(['a', 'b', 'c']);
			expect(result.failed).toEqual([]);
			expect(displaysService.remove).toHaveBeenCalledTimes(3);
		});

		// A display the module refuses to delete - one that is no longer there -
		// explains why, and that explanation is more use to the operator than
		// "failed".
		it('carries the service refusal through as the reason', async () => {
			displaysService.remove.mockImplementation((id: string) =>
				id === 'b' ? Promise.reject(new Error('Requested display does not exist')) : Promise.resolve(),
			);

			const result = await service.remove(['a', 'b', 'c']);

			expect(result.succeeded).toEqual(['a', 'c']);
			expect(result.failed).toEqual([{ id: 'b', reason: 'Requested display does not exist' }]);
		});
	});
});
