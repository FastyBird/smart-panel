/* eslint-disable @typescript-eslint/unbound-method */
import { Repository } from 'typeorm';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { EntrySpaceEntity } from '../entities/entry-space.entity';
import {
	SPACES_SYNTHETIC_ENTRY_DEFAULT_NAME,
	SPACES_SYNTHETIC_ENTRY_SPACE_ID,
} from '../spaces-synthetic-entry.constants';

import { EntrySpaceSeederService } from './entry-space-seeder.service';

describe('EntrySpaceSeederService', () => {
	let service: EntrySpaceSeederService;
	let repository: Repository<EntrySpaceEntity>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EntrySpaceSeederService,
				{
					provide: getRepositoryToken(EntrySpaceEntity),
					useValue: {
						findOne: jest.fn(),
						create: jest.fn(),
						save: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get(EntrySpaceSeederService);
		repository = module.get(getRepositoryToken(EntrySpaceEntity));
	});

	it('creates the singleton entry space on first run', async () => {
		(repository.findOne as jest.Mock).mockResolvedValue(null);
		const built = { id: SPACES_SYNTHETIC_ENTRY_SPACE_ID, name: SPACES_SYNTHETIC_ENTRY_DEFAULT_NAME };
		(repository.create as jest.Mock).mockReturnValue(built);
		(repository.save as jest.Mock).mockResolvedValue(built);

		const result = await service.seed();

		expect(repository.create).toHaveBeenCalledWith(
			expect.objectContaining({
				id: SPACES_SYNTHETIC_ENTRY_SPACE_ID,
				name: SPACES_SYNTHETIC_ENTRY_DEFAULT_NAME,
				category: null,
				parentId: null,
				suggestionsEnabled: false,
			}),
		);
		expect(repository.save).toHaveBeenCalledWith(built);
		expect(result).toBe(built);
	});

	it('short-circuits when an entry space already exists', async () => {
		const existing = { id: SPACES_SYNTHETIC_ENTRY_SPACE_ID, name: 'Entry' } as EntrySpaceEntity;
		(repository.findOne as jest.Mock).mockResolvedValue(existing);

		const result = await service.seed();

		expect(result).toBe(existing);
		expect(repository.create).not.toHaveBeenCalled();
		expect(repository.save).not.toHaveBeenCalled();
	});
});
