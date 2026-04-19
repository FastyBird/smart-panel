/* eslint-disable @typescript-eslint/unbound-method */
import { Repository } from 'typeorm';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { MasterSpaceEntity } from '../entities/master-space.entity';
import {
	SPACES_SYNTHETIC_MASTER_DEFAULT_NAME,
	SPACES_SYNTHETIC_MASTER_SPACE_ID,
} from '../spaces-synthetic-master.constants';

import { MasterSpaceSeederService } from './master-space-seeder.service';

describe('MasterSpaceSeederService', () => {
	let service: MasterSpaceSeederService;
	let repository: Repository<MasterSpaceEntity>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MasterSpaceSeederService,
				{
					provide: getRepositoryToken(MasterSpaceEntity),
					useValue: {
						findOne: jest.fn(),
						create: jest.fn(),
						save: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get(MasterSpaceSeederService);
		repository = module.get(getRepositoryToken(MasterSpaceEntity));
	});

	it('creates the singleton master space on first run', async () => {
		(repository.findOne as jest.Mock).mockResolvedValue(null);
		const built = { id: SPACES_SYNTHETIC_MASTER_SPACE_ID, name: SPACES_SYNTHETIC_MASTER_DEFAULT_NAME };
		(repository.create as jest.Mock).mockReturnValue(built);
		(repository.save as jest.Mock).mockResolvedValue(built);

		const result = await service.seed();

		expect(repository.create).toHaveBeenCalledWith(
			expect.objectContaining({
				id: SPACES_SYNTHETIC_MASTER_SPACE_ID,
				name: SPACES_SYNTHETIC_MASTER_DEFAULT_NAME,
				category: null,
				parentId: null,
				suggestionsEnabled: false,
			}),
		);
		expect(repository.save).toHaveBeenCalledWith(built);
		expect(result).toBe(built);
	});

	it('short-circuits when a master space already exists', async () => {
		const existing = { id: SPACES_SYNTHETIC_MASTER_SPACE_ID, name: 'Home' } as MasterSpaceEntity;
		(repository.findOne as jest.Mock).mockResolvedValue(existing);

		const result = await service.seed();

		expect(result).toBe(existing);
		expect(repository.create).not.toHaveBeenCalled();
		expect(repository.save).not.toHaveBeenCalled();
	});
});
