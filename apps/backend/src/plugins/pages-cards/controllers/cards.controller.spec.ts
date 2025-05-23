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

import { PagesService } from '../../../modules/dashboard/services/pages.service';
import { CreateSingleCardDto } from '../dto/create-card.dto';
import { UpdateCardDto } from '../dto/update-card.dto';
import { CardEntity, CardsPageEntity } from '../entities/pages-cards.entity';
import { CardsService } from '../services/cards.service';

import { CardsController } from './cards.controller';

describe('CardsController', () => {
	let controller: CardsController;
	let pagesService: PagesService;
	let cardsService: CardsService;

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
		title: 'Card  title',
		order: 0,
		icon: null,
		page: mockCardsPage.id,
		tiles: [],
		dataSource: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [CardsController],
			providers: [
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
			],
		}).compile();

		controller = module.get<CardsController>(CardsController);
		pagesService = module.get<PagesService>(PagesService);
		cardsService = module.get<CardsService>(CardsService);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(pagesService).toBeDefined();
		expect(cardsService).toBeDefined();
	});

	describe('Cards', () => {
		it('should return all cards', async () => {
			const result = await controller.findAll(mockCardsPage.id);

			expect(result).toEqual([mockCard]);
			expect(cardsService.findAll).toHaveBeenCalledWith(mockCardsPage.id);
		});

		it('should return a single card', async () => {
			const result = await controller.findOne(mockCard.id);

			expect(result).toEqual(mockCard);
			expect(cardsService.findOne).toHaveBeenCalledWith(mockCard.id);
		});

		it('should create a new card', async () => {
			const createDto: CreateSingleCardDto = {
				title: 'Card title',
				order: 0,
				page: mockCardsPage.id,
			};

			const result = await controller.create({ data: createDto });

			expect(result).toEqual(mockCard);
			expect(cardsService.create).toHaveBeenCalledWith(createDto);
		});

		it('should update a card', async () => {
			const updateDto: UpdateCardDto = {
				title: 'Updated title',
			};

			const result = await controller.update(mockCard.id, { data: updateDto });

			expect(result).toEqual(mockCard);
			expect(cardsService.update).toHaveBeenCalledWith(mockCard.id, updateDto);
		});

		it('should delete a card', async () => {
			const result = await controller.remove(mockCard.id);

			expect(result).toBeUndefined();
			expect(cardsService.remove).toHaveBeenCalledWith(mockCard.id);
		});
	});
});
