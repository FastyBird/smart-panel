/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';

import { MasterSpaceResetService } from './master-space-reset.service';
import { MasterSpaceSeederService } from './master-space-seeder.service';

describe('MasterSpaceResetService', () => {
	let service: MasterSpaceResetService;
	let seeder: MasterSpaceSeederService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MasterSpaceResetService,
				{
					provide: MasterSpaceSeederService,
					useValue: { seed: jest.fn() },
				},
			],
		}).compile();

		service = module.get(MasterSpaceResetService);
		seeder = module.get(MasterSpaceSeederService);
	});

	it('re-seeds the master space and returns success', async () => {
		(seeder.seed as jest.Mock).mockResolvedValue({ id: 'abc' });

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
