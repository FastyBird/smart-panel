import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource as OrmDataSource, Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { CreateDataSourceDto } from '../../../modules/dashboard/dto/create-data-source.dto';
import { CreateTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import { DataSourceEntity, TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { DataSourcesTypeMapperService } from '../../../modules/dashboard/services/data-source-type-mapper.service';
import { PagesService } from '../../../modules/dashboard/services/pages.service';
import { TilesTypeMapperService } from '../../../modules/dashboard/services/tiles-type-mapper.service';
import { CreateSingleCardDto } from '../dto/create-card.dto';
import { UpdateCardDto } from '../dto/update-card.dto';
import { CardEntity, CardsPageEntity } from '../entities/pages-cards.entity';
import { EventType } from '../pages-cards.constants';
import { PagesCardsNotFoundException, PagesCardsValidationException } from '../pages-cards.exceptions';

@Injectable()
export class CardsService {
	private readonly logger = new Logger(CardsService.name);

	constructor(
		@InjectRepository(CardEntity)
		private readonly repository: Repository<CardEntity>,
		private readonly pagesService: PagesService,
		private readonly tilesMapperService: TilesTypeMapperService,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
		private readonly dataSource: OrmDataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAll(pageId?: string): Promise<CardEntity[]> {
		if (pageId) {
			this.logger.debug(`[LOOKUP ALL] Fetching all cards for pageId=${pageId}`);

			const page = await this.pagesService.getOneOrThrow<CardsPageEntity>(pageId);

			const cards = await this.repository
				.createQueryBuilder('card')
				.leftJoinAndSelect('card.page', 'page')
				.where('page.id = :pageId', { pageId: page.id })
				.getMany();

			this.logger.debug(`[LOOKUP ALL] Found ${cards.length} cards for pageId=${pageId}`);

			return cards;
		}

		this.logger.debug('[LOOKUP ALL] Fetching all cards');

		const cards = await this.repository.find();

		this.logger.debug(`[LOOKUP ALL] Found ${cards.length} cards`);

		return cards;
	}

	async findOne(id: string, pageId?: string): Promise<CardEntity | null> {
		let card: CardEntity | null;

		if (pageId) {
			this.logger.debug(`[LOOKUP] Fetching card with id=${id} for pageId=${pageId}`);

			const page = await this.pagesService.getOneOrThrow<CardsPageEntity>(pageId);

			card = await this.repository
				.createQueryBuilder('card')
				.leftJoinAndSelect('card.page', 'page')
				.where('card.id = :id', { id })
				.andWhere('page.id = :pageId', { pageId: page.id })
				.getOne();

			if (!card) {
				this.logger.warn(`[LOOKUP] Card with id=${id} for pageId=${pageId} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched card with id=${id} for pageId=${pageId}`);
		} else {
			this.logger.debug(`[LOOKUP] Fetching card with id=${id}`);

			card = await this.repository
				.createQueryBuilder('card')
				.leftJoinAndSelect('card.page', 'page')
				.where('card.id = :id', { id })
				.getOne();

			if (!card) {
				this.logger.warn(`[LOOKUP] Card with id=${id} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched card with id=${id}`);
		}

		return card;
	}

	async create(createDto: CreateSingleCardDto): Promise<CardEntity> {
		this.logger.debug(`[CREATE] Creating new card`);

		const page = await this.pagesService.getOneOrThrow<CardsPageEntity>(createDto.page);

		const dtoInstance = await this.validateDto<CreateSingleCardDto>(CreateSingleCardDto, createDto);

		const card = plainToInstance(
			CardEntity,
			{ ...dtoInstance, page: page.id },
			{
				enableImplicitConversion: true,
				excludeExtraneousValues: true,
				exposeUnsetFields: false,
			},
		);

		card.tiles = (dtoInstance.tiles || []).map((createTileDto: CreateTileDto) => {
			const tileMapping = this.tilesMapperService.getMapping(createTileDto.type);

			const tileRepository: Repository<TileEntity> = this.dataSource.getRepository(tileMapping.class);

			const tile = tileRepository.create(
				plainToInstance(
					tileMapping.class,
					{ ...createTileDto, parentType: 'card', parentId: card.id },
					{
						enableImplicitConversion: true,
						excludeExtraneousValues: true,
						exposeUnsetFields: false,
					},
				),
			);

			tile.dataSource = (createTileDto.data_source ?? []).map((createDataSourceDto: CreateDataSourceDto) => {
				const dataSourceMapping = this.dataSourcesMapperService.getMapping(createDataSourceDto.type);

				const dataSourceRepository: Repository<DataSourceEntity> = this.dataSource.getRepository(
					dataSourceMapping.class,
				);

				return dataSourceRepository.create(
					plainToInstance(
						dataSourceMapping.class,
						{ ...createDataSourceDto, parentType: 'tile', parentId: tile.id },
						{
							enableImplicitConversion: true,
							excludeExtraneousValues: true,
							exposeUnsetFields: false,
						},
					),
				);
			});

			return tile;
		});

		card.dataSource = (dtoInstance.data_source || []).map((createDataSourceDto: CreateDataSourceDto) => {
			const dataSourceMapping = this.dataSourcesMapperService.getMapping(createDataSourceDto.type);

			const dataSourceRepository: Repository<DataSourceEntity> = this.dataSource.getRepository(dataSourceMapping.class);

			return dataSourceRepository.create(
				plainToInstance(
					dataSourceMapping.class,
					{ ...createDataSourceDto, parentType: 'card', parentId: card.id },
					{
						enableImplicitConversion: true,
						excludeExtraneousValues: true,
						exposeUnsetFields: false,
					},
				),
			);
		});

		const created = this.repository.create(card);

		// Save the card
		await this.repository.save(created);

		// Retrieve the saved card with its full relations
		const savedCard = await this.getOneOrThrow(created.id, page.id);

		this.logger.debug(
			`[CREATE] Successfully created card with id=${savedCard.id} for pageId=${typeof savedCard.page === 'string' ? savedCard.page : savedCard.page.id}`,
		);

		this.eventEmitter.emit(EventType.CARD_CREATED, savedCard);

		return savedCard;
	}

	async update(id: string, updateDto: UpdateCardDto): Promise<CardEntity> {
		this.logger.debug(`[UPDATE] Updating data source with id=${id}`);

		const card = await this.getOneOrThrow(id);

		const dtoInstance = await this.validateDto<UpdateCardDto>(UpdateCardDto, updateDto);

		Object.assign(
			card,
			omitBy(
				plainToInstance(CardEntity, dtoInstance, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeDefaultValues: false,
				}),
				isUndefined,
			),
		);

		await this.repository.save(card);

		const updatedCard = await this.getOneOrThrow(card.id);

		this.logger.debug(`[UPDATE] Successfully updated card with id=${updatedCard.id}`);

		this.eventEmitter.emit(EventType.CARD_UPDATED, updatedCard);

		return updatedCard;
	}

	async remove(id: string, pageId?: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing card with id=${id} for pageId=${pageId}`);

		const page = await this.pagesService.getOneOrThrow<CardsPageEntity>(pageId);
		const card = await this.getOneOrThrow(id, page.id);

		await this.repository.remove(card);

		this.logger.log(`[DELETE] Successfully removed card with id=${id} for pageId=${pageId}`);

		this.eventEmitter.emit(EventType.CARD_DELETED, card);
	}

	async getOneOrThrow(id: string, pageId?: string): Promise<CardEntity> {
		const card = await this.findOne(id, pageId);

		if (!card) {
			this.logger.error(`[ERROR] Card with id=${id} for pageId=${pageId} not found`);

			throw new PagesCardsNotFoundException('Requested page card does not exist');
		}

		return card;
	}

	private async validateDto<T extends object>(DtoClass: new () => T, dto: any): Promise<T> {
		const dtoInstance = plainToInstance(DtoClass, dto, {
			enableImplicitConversion: true,
			excludeExtraneousValues: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] ${JSON.stringify(errors)}`);

			throw new PagesCardsValidationException('Provided card data are invalid.');
		}

		return dtoInstance;
	}
}
