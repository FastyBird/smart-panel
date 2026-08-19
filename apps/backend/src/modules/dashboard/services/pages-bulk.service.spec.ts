import { Test, TestingModule } from '@nestjs/testing';

import { PagesBulkService } from './pages-bulk.service';
import { PagesService } from './pages.service';

describe('PagesBulkService', () => {
	let service: PagesBulkService;
	let pagesService: { remove: jest.Mock };

	beforeEach(async () => {
		pagesService = {
			remove: jest.fn().mockResolvedValue(undefined),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [PagesBulkService, { provide: PagesService, useValue: pagesService }],
		}).compile();

		service = module.get<PagesBulkService>(PagesBulkService);
	});

	describe('remove', () => {
		it('removes every page in the selection', async () => {
			const result = await service.remove(['a', 'b', 'c']);

			expect(result.succeeded).toEqual(['a', 'b', 'c']);
			expect(result.failed).toEqual([]);
			expect(pagesService.remove).toHaveBeenCalledTimes(3);
		});

		// A page the module refuses to delete - a missing one - explains why, and
		// that explanation is more use to the operator than "failed".
		it('carries the service refusal through as the reason', async () => {
			pagesService.remove.mockImplementation((id: string) =>
				id === 'b' ? Promise.reject(new Error('Requested page does not exist')) : Promise.resolve(),
			);

			const result = await service.remove(['a', 'b', 'c']);

			expect(result.succeeded).toEqual(['a', 'c']);
			expect(result.failed).toEqual([{ id: 'b', reason: 'Requested page does not exist' }]);
		});
	});
});
