/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { CreateTimeTileDto } from '../dto/create-tile.dto';
import { UpdateTimeTileDto } from '../dto/update-tile.dto';
import { TilesPageEntity, TimeTileEntity } from '../entities/dashboard.entity';
import { PagesService } from '../services/pages.service';
import { TilesTypeMapperService } from '../services/tiles-type-mapper.service';
import { TilesService } from '../services/tiles.service';

import { PagesTilesController } from './pages.tiles.controller';

describe('PagesTilesController', () => {
	let controller: PagesTilesController;
	let pagesService: PagesService;
	let tilesService: TilesService;
	let tileMapper: TilesTypeMapperService;

	const mockTilesPage: TilesPageEntity = {
		id: uuid().toString(),
		type: 'tiles',
		title: 'Tiles detail',
		order: 0,
		tiles: [],
		dataSource: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockTimeTile: TimeTileEntity = {
		id: uuid().toString(),
		type: 'clock',
		page: mockTilesPage.id,
		card: null,
		dataSource: [],
		row: 0,
		col: 0,
		rowSpan: 0,
		colSpan: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
		validateOwnership: (): void => {},
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [PagesTilesController],
			providers: [
				{
					provide: TilesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => {}),
					},
				},
				{
					provide: PagesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([mockTilesPage]),
						findOne: jest.fn().mockResolvedValue(mockTilesPage),
						create: jest.fn().mockResolvedValue(mockTilesPage),
						update: jest.fn().mockResolvedValue(mockTilesPage),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: TilesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([mockTimeTile]),
						findOne: jest.fn().mockResolvedValue(mockTimeTile),
						create: jest.fn().mockResolvedValue(mockTimeTile),
						update: jest.fn().mockResolvedValue(mockTimeTile),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
			],
		}).compile();

		controller = module.get<PagesTilesController>(PagesTilesController);
		pagesService = module.get<PagesService>(PagesService);
		tilesService = module.get<TilesService>(TilesService);
		tileMapper = module.get<TilesTypeMapperService>(TilesTypeMapperService);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(pagesService).toBeDefined();
		expect(tilesService).toBeDefined();
		expect(tileMapper).toBeDefined();
	});

	describe('Tiles', () => {
		it('should return all tiles', async () => {
			const result = await controller.findAll(mockTilesPage.id);

			expect(result).toEqual([mockTimeTile]);
			expect(tilesService.findAll).toHaveBeenCalledWith({ pageId: mockTilesPage.id });
		});

		it('should return a single tile', async () => {
			const result = await controller.findOne(mockTilesPage.id, mockTimeTile.id);

			expect(result).toEqual(mockTimeTile);
			expect(tilesService.findOne).toHaveBeenCalledWith(mockTimeTile.id, { pageId: mockTilesPage.id });
		});

		it('should create a new tile', async () => {
			const createDto: CreateTimeTileDto = {
				type: 'clock',
				row: 0,
				col: 0,
			};

			jest.spyOn(tileMapper, 'getMapping').mockReturnValue({
				type: 'tiles',
				class: TimeTileEntity,
				createDto: CreateTimeTileDto,
				updateDto: UpdateTimeTileDto,
			});

			const result = await controller.create(mockTilesPage.id, createDto);

			expect(result).toEqual(mockTimeTile);
			expect(tilesService.create).toHaveBeenCalledWith(createDto, { pageId: mockTilesPage.id });
		});

		it('should update a tile', async () => {
			const updateDto: UpdateTimeTileDto = {
				row: 0,
				col: 0,
			};

			jest.spyOn(tileMapper, 'getMapping').mockReturnValue({
				type: 'tiles',
				class: TimeTileEntity,
				createDto: CreateTimeTileDto,
				updateDto: UpdateTimeTileDto,
			});

			const result = await controller.update(mockTilesPage.id, mockTimeTile.id, updateDto);

			expect(result).toEqual(mockTimeTile);
			expect(tilesService.update).toHaveBeenCalledWith(mockTimeTile.id, updateDto);
		});

		it('should delete a tile', async () => {
			const result = await controller.remove(mockTilesPage.id, mockTimeTile.id);

			expect(result).toBeUndefined();
			expect(tilesService.remove).toHaveBeenCalledWith(mockTimeTile.id);
		});
	});
});
