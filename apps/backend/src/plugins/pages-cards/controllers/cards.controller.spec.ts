/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PagesService } from '../../../modules/dashboard/services/pages.service';
import { CreateSingleCardDto } from '../dto/create-card.dto';
import { UpdateCardDto } from '../dto/update-card.dto';
import { CardEntity, CardsPageEntity } from '../entities/pages-cards.entity';
import { PAGES_CARDS_PLUGIN_PREFIX, PAGES_CARDS_TYPE } from '../pages-cards.constants';
import { CardsService } from '../services/cards.service';

import { CardsController } from './cards.controller';

describe('CardsController', () => {
	let controller: CardsController;
	let pagesService: PagesService;
	let cardsService: CardsService;

	const mockCardsPage: CardsPageEntity = {
		id: uuid().toString(),
		type: PAGES_CARDS_TYPE,
		title: 'Cards detail',
		order: 0,
		showTopBar: false,
		cards: [],
		dataSource: [],
		displays: [],
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

	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(pagesService).toBeDefined();
		expect(cardsService).toBeDefined();
	});

	describe('Cards', () => {
		it('should return all cards', async () => {
			const result = await controller.findAll(mockCardsPage.id);

			expect(result.data).toEqual([mockCard]);
			expect(cardsService.findAll).toHaveBeenCalledWith(mockCardsPage.id);
		});

		it('should return a single card', async () => {
			const result = await controller.findOne(mockCard.id);

			expect(result.data).toEqual(mockCard);
			expect(cardsService.findOne).toHaveBeenCalledWith(mockCard.id);
		});

		it('should create a new card', async () => {
			const createDto: CreateSingleCardDto = {
				title: 'Card title',
				order: 0,
				page: mockCardsPage.id,
			};

			const mockRequest = {
				url: '/api/v1/plugins/pages-cards/cards',
				protocol: 'http',
				hostname: 'localhost',
				headers: { host: 'localhost:3000' },
				socket: { localPort: 3000 },
			} as unknown as Request;

			const mockResponse = {
				header: jest.fn().mockReturnThis(),
			} as unknown as Response;

			const result = await controller.create({ data: createDto }, mockResponse, mockRequest);

			expect(result.data).toEqual(mockCard);
			expect(cardsService.create).toHaveBeenCalledWith(createDto);
			expect(mockResponse.header).toHaveBeenCalledWith(
				'Location',
				expect.stringContaining(`/api/v1/plugins/${PAGES_CARDS_PLUGIN_PREFIX}/cards/${mockCard.id}`),
			);
		});

		it('should update a card', async () => {
			const updateDto: UpdateCardDto = {
				title: 'Updated title',
			};

			const result = await controller.update(mockCard.id, { data: updateDto });

			expect(result.data).toEqual(mockCard);
			expect(cardsService.update).toHaveBeenCalledWith(mockCard.id, updateDto);
		});

		it('should delete a card', async () => {
			const result = await controller.remove(mockCard.id);

			expect(result).toBeUndefined();
			expect(cardsService.remove).toHaveBeenCalledWith(mockCard.id);
		});
	});
});
