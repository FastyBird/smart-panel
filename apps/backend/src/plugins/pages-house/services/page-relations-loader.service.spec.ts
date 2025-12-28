import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { TilesPageEntity } from '../../pages-tiles/entities/pages-tiles.entity';
import { HousePageEntity } from '../entities/pages-house.entity';

import { PageRelationsLoaderService } from './page-relations-loader.service';

describe('PageRelationsLoaderService', () => {
	let service: PageRelationsLoaderService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [PageRelationsLoaderService],
		}).compile();

		service = module.get(PageRelationsLoaderService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('supports', () => {
		it('should support HousePageEntity', () => {
			const housePage = new HousePageEntity();
			housePage.id = uuid();

			expect(service.supports(housePage)).toBe(true);
		});

		it('should not support other page types like TilesPageEntity', () => {
			const page = new TilesPageEntity();
			page.id = uuid();

			expect(service.supports(page)).toBe(false);
		});
	});

	describe('loadRelations', () => {
		it('should complete without error for HousePageEntity', async () => {
			const housePage = new HousePageEntity();
			housePage.id = uuid();
			housePage.title = 'Test House Page';

			await expect(service.loadRelations(housePage)).resolves.toBeUndefined();
		});
	});
});
