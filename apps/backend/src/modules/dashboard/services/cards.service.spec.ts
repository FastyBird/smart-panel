/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-argument,
@typescript-eslint/no-unsafe-member-access
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { plainToInstance } from 'class-transformer';
import { Expose, Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import { DataSource as OrmDataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DeviceCategory } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { EventType } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import { CreateCardDto } from '../dto/create-card.dto';
import { UpdateCardDto } from '../dto/update-card.dto';
import { CardEntity, CardsPageEntity, DeviceDetailPageEntity } from '../entities/dashboard.entity';

import { CardsService } from './cards.service';
import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';
import { PagesService } from './pages.service';
import { TilesTypeMapperService } from './tiles-type-mapper.service';

class MockDevice extends DeviceEntity {
	@Expose({ name: 'mock_value' })
	@IsString()
	@Transform(({ obj }: { obj: { mock_value?: string; mockValue?: string } }) => obj.mock_value || obj.mockValue, {
		toClassOnly: true,
	})
	mockValue: string;

	@Expose()
	get type(): string {
		return 'mock';
	}
}

describe('CardsService', () => {
	let pagesService: PagesService;
	let cardsService: CardsService;
	let repository: Repository<CardEntity>;
	let tilesMapper: TilesTypeMapperService;
	let dataSourceMapper: DataSourcesTypeMapperService;
	let eventEmitter: EventEmitter2;
	let dataSource: OrmDataSource;

	const mockDevice: MockDevice = {
		id: uuid().toString(),
		type: 'mock',
		category: DeviceCategory.GENERIC,
		name: 'Test Device',
		description: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		controls: [],
		channels: [],
		mockValue: 'Some value',
	};

	const mockDevicePage: DeviceDetailPageEntity = {
		id: uuid().toString(),
		type: 'device-detail',
		title: 'Device detail',
		order: 0,
		device: mockDevice.id,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

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
		title: 'Card box',
		order: 0,
		icon: null,
		page: mockDevicePage.id,
		tiles: [],
		dataSource: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			remove: jest.fn(),
			createQueryBuilder: jest.fn(() => ({
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getMany: jest.fn(),
				getOne: jest.fn(),
			})),
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CardsService,
				{ provide: getRepositoryToken(CardEntity), useFactory: mockRepository },
				{
					provide: PagesService,
					useValue: {
						getOneOrThrow: jest.fn(() => {}),
					},
				},
				{
					provide: TilesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => {}),
					},
				},
				{
					provide: DataSourcesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => {}),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(() => {}),
					},
				},
				{
					provide: OrmDataSource,
					useValue: {
						getRepository: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		pagesService = module.get<PagesService>(PagesService);
		cardsService = module.get<CardsService>(CardsService);
		repository = module.get<Repository<CardEntity>>(getRepositoryToken(CardEntity));
		tilesMapper = module.get<TilesTypeMapperService>(TilesTypeMapperService);
		dataSourceMapper = module.get<DataSourcesTypeMapperService>(DataSourcesTypeMapperService);
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
		dataSource = module.get<OrmDataSource>(OrmDataSource);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	it('should be defined', () => {
		expect(pagesService).toBeDefined();
		expect(cardsService).toBeDefined();
		expect(repository).toBeDefined();
		expect(tilesMapper).toBeDefined();
		expect(dataSourceMapper).toBeDefined();
		expect(eventEmitter).toBeDefined();
		expect(dataSource).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all cards with relations', async () => {
			const mockCards: CardEntity[] = [mockCard];

			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(CardsPageEntity, mockCardsPage));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockCards.map((entity) => plainToInstance(CardsPageEntity, entity))),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await cardsService.findAll(mockCardsPage.id);

			expect(result).toEqual(mockCards.map((entity) => plainToInstance(CardsPageEntity, entity)));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('card');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('card.page', 'page');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('card.tiles', 'tiles');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('card.dataSource', 'dataSource');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('page.id = :pageId', { pageId: mockCardsPage.id });
			expect(queryBuilderMock.getMany).toHaveBeenCalled();
		});
	});

	describe('findOne', () => {
		it('should return a card by ID', async () => {
			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(CardsPageEntity, mockCardsPage));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(plainToInstance(CardEntity, mockCard)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await cardsService.findOne(mockCard.id, mockCardsPage.id);

			expect(result).toEqual(plainToInstance(CardEntity, mockCard));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('card');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('card.page', 'page');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('card.tiles', 'tiles');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('card.dataSource', 'dataSource');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('card.id = :id', { id: mockCard.id });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('page.id = :pageId', { pageId: mockCardsPage.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});

		it('should return null if page not found', async () => {
			const cardId = uuid().toString();

			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(CardsPageEntity, mockCardsPage));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await cardsService.findOne(cardId, mockCardsPage.id);

			expect(result).toEqual(null);

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('card');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('card.page', 'page');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('card.tiles', 'tiles');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('card.dataSource', 'dataSource');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('card.id = :id', { id: cardId });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('page.id = :pageId', { pageId: mockCardsPage.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});
	});

	describe('create', () => {
		it('should create and return a new card', async () => {
			const createDto: CreateCardDto = { title: 'Card title', order: 0 };
			const mockCrateCard: Partial<CardEntity> = {
				title: createDto.title,
				order: createDto.order,
				page: mockCardsPage.id,
				tiles: [],
				dataSource: [],
			};
			const mockCratedCard: CardEntity = {
				id: uuid().toString(),
				title: mockCrateCard.title,
				order: mockCrateCard.order,
				icon: null,
				page: mockCardsPage.id,
				tiles: [],
				dataSource: [],
				createdAt: new Date(),
				updatedAt: null,
			};

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValueOnce(plainToInstance(CardEntity, mockCratedCard)),
			};

			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(CardsPageEntity, mockCardsPage));

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'create').mockReturnValue(mockCratedCard);
			jest.spyOn(repository, 'save').mockResolvedValue(mockCratedCard);

			const result = await cardsService.create(mockCardsPage.id, createDto);

			expect(result).toEqual(plainToInstance(CardEntity, mockCratedCard));
			expect(repository.create).toHaveBeenCalledWith(
				plainToInstance(CardEntity, mockCrateCard, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				}),
			);
			expect(repository.save).toHaveBeenCalledWith(mockCratedCard);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CARD_CREATED,
				plainToInstance(CardEntity, mockCratedCard),
			);
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('card.page', 'page');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('card.tiles', 'tiles');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('card.dataSource', 'dataSource');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('card.id = :id', { id: mockCratedCard.id });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('page.id = :pageId', { pageId: mockCardsPage.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});

		it('should throw validation exception for invalid data', async () => {
			const createDto: Partial<CreateCardDto> = {
				title: 'Card title',
			};

			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(CardsPageEntity, mockCardsPage));

			await expect(cardsService.create(mockCardsPage.id, createDto as CreateCardDto)).rejects.toThrow(
				DashboardException,
			);
		});
	});

	describe('update', () => {
		it('should update a card', async () => {
			const updateDto: UpdateCardDto = {
				title: 'Updated title',
				order: 10,
			};
			const mockUpdateCard: CardEntity = {
				id: mockCard.id,
				title: updateDto.title,
				order: updateDto.order,
				icon: mockCard.icon,
				page: mockCard.page,
				tiles: mockCard.tiles,
				dataSource: mockCard.dataSource,
				createdAt: mockCard.createdAt,
				updatedAt: mockCard.updatedAt,
			};
			const mockUpdatedCard: CardEntity = {
				id: mockUpdateCard.id,
				title: mockUpdateCard.title,
				order: mockUpdateCard.order,
				icon: mockUpdateCard.icon,
				page: mockCard.page,
				tiles: mockCard.tiles,
				dataSource: mockUpdateCard.dataSource,
				createdAt: mockUpdateCard.createdAt,
				updatedAt: mockUpdateCard.updatedAt,
			};

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest
					.fn()
					.mockResolvedValueOnce(plainToInstance(CardEntity, mockCard))
					.mockResolvedValueOnce(plainToInstance(CardEntity, mockUpdatedCard)),
			};

			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(CardsPageEntity, mockCardsPage));

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'save').mockResolvedValue(mockUpdatedCard);

			const result = await cardsService.update(mockCard.id, mockCardsPage.id, updateDto);

			expect(result).toEqual(plainToInstance(CardEntity, mockUpdatedCard));
			expect(repository.save).toHaveBeenCalledWith(plainToInstance(CardEntity, mockUpdatedCard));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CARD_UPDATED,
				plainToInstance(CardEntity, mockUpdatedCard),
			);
			expect(repository.createQueryBuilder).toHaveBeenCalledWith('card');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('card.page', 'page');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('card.tiles', 'tiles');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('card.dataSource', 'dataSource');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('card.id = :id', { id: mockCard.id });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('page.id = :pageId', { pageId: mockCardsPage.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalledTimes(2);
		});
	});

	describe('remove', () => {
		it('should remove a card', async () => {
			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(CardsPageEntity, mockCardsPage));
			jest.spyOn(cardsService, 'findOne').mockResolvedValue(plainToInstance(CardEntity, mockCard));

			jest.spyOn(repository, 'remove').mockResolvedValue(mockCard);

			await cardsService.remove(mockCard.id, mockCardsPage.id);

			expect(repository.remove).toHaveBeenCalledWith(plainToInstance(CardEntity, mockCard));
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.CARD_DELETED, plainToInstance(CardEntity, mockCard));
		});
	});
});
