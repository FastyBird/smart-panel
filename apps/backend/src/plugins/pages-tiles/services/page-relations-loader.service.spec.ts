/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PageEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { TilesService } from '../../../modules/dashboard/services/tiles.service';
import { TilesPageEntity } from '../entities/pages-tiles.entity';

import { PageRelationsLoaderService } from './page-relations-loader.service';

class MockPageEntity extends PageEntity {}

describe('PageRelationsLoaderService (Tiles)', () => {
	let service: PageRelationsLoaderService;
	let tilesService: TilesService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PageRelationsLoaderService,
				{
					provide: TilesService,
					useValue: {
						findAll: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get(PageRelationsLoaderService);
		tilesService = module.get(TilesService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('supports()', () => {
		it('should return true for TilesPageEntity', () => {
			const page = new TilesPageEntity();
			expect(service.supports(page)).toBe(true);
		});

		it('should return false for base PageEntity', () => {
			const page = new MockPageEntity();
			expect(service.supports(page)).toBe(false);
		});
	});

	describe('loadRelations()', () => {
		it('should assign tiles using tilesService.findAll()', async () => {
			const mockTiles: TileEntity[] = [{ id: 'tile-1' } as TileEntity, { id: 'tile-2' } as TileEntity];

			(tilesService.findAll as jest.Mock).mockResolvedValue(mockTiles);

			const page = new TilesPageEntity();
			page.id = 'page-1';

			await service.loadRelations(page);

			expect(tilesService.findAll).toHaveBeenCalledWith({
				parentType: 'page',
				parentId: page.id,
			});
			expect(page.tiles).toEqual(mockTiles);
		});
	});
});
