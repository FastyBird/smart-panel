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
import { CardEntity, CardsPageEntity, TimeTileEntity } from '../entities/dashboard.entity';
import { CardsService } from '../services/cards.service';
import { PagesService } from '../services/pages.service';
import { TilesTypeMapperService } from '../services/tiles-type-mapper.service';
import { TilesService } from '../services/tiles.service';

import { PagesCardsTilesController } from './pages.cards.tiles.controller';

describe('PagesCardsTilesController', () => {
	let controller: PagesCardsTilesController;
	let pagesService: PagesService;
	let cardsService: CardsService;
	let tilesService: TilesService;
	let tileMapper: TilesTypeMapperService;

	const mockCardsPage: CardsPageEntity = {
		id: uuid().toString(),
		type: 'cards',
		title: 'Cards detail',
		order: 0,
		cards: [],
		dataSource: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockCard: CardEntity = {
		id: uuid().toString(),
		title: 'Cards detail',
		order: 0,
		icon: null,
		page: mockCardsPage.id,
		tiles: [],
		dataSource: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockTimeTile: TimeTileEntity = {
		id: uuid().toString(),
		type: 'clock',
		page: null,
		card: mockCard.id,
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
			controllers: [PagesCardsTilesController],
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
						findAll: jest.fn().mockResolvedValue([mockCardsPage]),
						findOne: jest.fn().mockResolvedValue(mockCardsPage),
						create: jest.fn().mockResolvedValue(mockCardsPage),
						update: jest.fn().mockResolvedValue(mockCardsPage),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: CardsService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([mockCard]),
						findOne: jest.fn().mockResolvedValue(mockCard),
						create: jest.fn().mockResolvedValue(mockCard),
						update: jest.fn().mockResolvedValue(mockCard),
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

		controller = module.get<PagesCardsTilesController>(PagesCardsTilesController);
		pagesService = module.get<PagesService>(PagesService);
		cardsService = module.get<CardsService>(CardsService);
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
		expect(cardsService).toBeDefined();
		expect(tilesService).toBeDefined();
		expect(tileMapper).toBeDefined();
	});

	describe('Tiles', () => {
		it('should return all tiles', async () => {
			const result = await controller.findAll(mockCardsPage.id, mockCard.id);

			expect(result).toEqual([mockTimeTile]);
			expect(tilesService.findAll).toHaveBeenCalledWith({ cardId: mockCard.id });
		});

		it('should return a single tile', async () => {
			const result = await controller.findOne(mockCardsPage.id, mockCard.id, mockTimeTile.id);

			expect(result).toEqual(mockTimeTile);
			expect(tilesService.findOne).toHaveBeenCalledWith(mockTimeTile.id, { cardId: mockCard.id });
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

			const result = await controller.create(mockCardsPage.id, mockCard.id, { data: createDto });

			expect(result).toEqual(mockTimeTile);
			expect(tilesService.create).toHaveBeenCalledWith(createDto, { cardId: mockCard.id });
		});

		it('should update a tile', async () => {
			const updateDto: UpdateTimeTileDto = {
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

			const result = await controller.update(mockCardsPage.id, mockCard.id, mockTimeTile.id, { data: updateDto });

			expect(result).toEqual(mockTimeTile);
			expect(tilesService.update).toHaveBeenCalledWith(mockTimeTile.id, updateDto);
		});

		it('should delete a tile', async () => {
			const result = await controller.remove(mockCardsPage.id, mockCard.id, mockTimeTile.id);

			expect(result).toBeUndefined();
			expect(tilesService.remove).toHaveBeenCalledWith(mockTimeTile.id);
		});
	});
});
