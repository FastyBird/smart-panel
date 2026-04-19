/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';

import { EntrySpaceResetService } from './entry-space-reset.service';
import { EntrySpaceSeederService } from './entry-space-seeder.service';

describe('EntrySpaceResetService', () => {
	let service: EntrySpaceResetService;
	let seeder: EntrySpaceSeederService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EntrySpaceResetService,
				{
					provide: EntrySpaceSeederService,
					useValue: { seed: jest.fn() },
				},
			],
		}).compile();

		service = module.get(EntrySpaceResetService);
		seeder = module.get(EntrySpaceSeederService);
	});

	it('re-seeds the entry space and returns success', async () => {
		(seeder.seed as jest.Mock).mockResolvedValue({ id: 'xyz' });

		const result = await service.reset();

		expect(seeder.seed).toHaveBeenCalledTimes(1);
		expect(result).toEqual({ success: true });
	});

	it('returns failure when seeder throws', async () => {
		(seeder.seed as jest.Mock).mockRejectedValue(new Error('db gone'));

		const result = await service.reset();

		expect(result).toEqual({ success: false, reason: 'db gone' });
	});
});
