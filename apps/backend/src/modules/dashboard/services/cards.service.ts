import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource as OrmDataSource, Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { WebsocketGateway } from '../../websocket/gateway/websocket.gateway';
import { EventType } from '../dashboard.constants';
import { DashboardNotFoundException, DashboardValidationException } from '../dashboard.exceptions';
import { CreateCardDto } from '../dto/create-card.dto';
import { CreateDataSourceDto } from '../dto/create-data-source.dto';
import { CreateTileDto } from '../dto/create-tile.dto';
import { UpdateCardDto } from '../dto/update-card.dto';
import { CardEntity, CardsPageEntity, DataSourceEntity, TileEntity } from '../entities/dashboard.entity';

import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';
import { PagesService } from './pages.service';
import { TilesTypeMapperService } from './tiles-type-mapper.service';

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
		private readonly gateway: WebsocketGateway,
	) {}

	async findAll(pageId?: string): Promise<CardEntity[]> {
		if (pageId) {
			this.logger.debug(`[LOOKUP ALL] Fetching all cards for pageId=${pageId}`);

			const page = await this.pagesService.getOneOrThrow<CardsPageEntity>(pageId);

			const cards = await this.repository
				.createQueryBuilder('card')
				.innerJoinAndSelect('card.page', 'page')
				.leftJoinAndSelect('card.tiles', 'tiles')
				.leftJoinAndSelect('card.dataSource', 'dataSource')
				.leftJoinAndSelect('dataSource.device', 'device')
				.leftJoinAndSelect('dataSource.channel', 'channel')
				.leftJoinAndSelect('dataSource.property', 'property')
				.where('page.id = :pageId', { pageId: page.id })
				.getMany();

			this.logger.debug(`[LOOKUP ALL] Found ${cards.length} cards for pageId=${pageId}`);

			return cards;
		}

		this.logger.debug('[LOOKUP ALL] Fetching all cards');

		const cards = await this.repository.find({ relations: ['page', 'tiles', 'dataSource', 'dataSource.card'] });

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
				.innerJoinAndSelect('card.page', 'page')
				.leftJoinAndSelect('card.tiles', 'tiles')
				.leftJoinAndSelect('card.dataSource', 'dataSource')
				.leftJoinAndSelect('dataSource.device', 'device')
				.leftJoinAndSelect('dataSource.channel', 'channel')
				.leftJoinAndSelect('dataSource.property', 'property')
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

			card = await this.repository.findOne({
				where: { id },
				relations: ['page', 'tiles', 'dataSource', 'dataSource.card', 'device'],
			});

			if (!card) {
				this.logger.warn(`[LOOKUP] Card with id=${id} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched card with id=${id}`);
		}

		return card;
	}

	async create(pageId: string, createDto: CreateCardDto): Promise<CardEntity> {
		this.logger.debug(`[CREATE] Creating new card for pageId=${pageId}`);

		const page = await this.pagesService.getOneOrThrow<CardsPageEntity>(pageId);

		const dtoInstance = await this.validateDto<CreateCardDto>(CreateCardDto, createDto);

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
					{ ...createTileDto, card: card.id },
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
						{ ...createDataSourceDto, tile: tile.id },
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
					{ ...createDataSourceDto, card: card.id },
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

		this.logger.debug(`[CREATE] Successfully created card with id=${savedCard.id} for pageId=${pageId}`);

		this.gateway.sendMessage(EventType.CARD_CREATED, savedCard);

		return savedCard;
	}

	async update(id: string, pageId: string, updateDto: UpdateCardDto): Promise<CardEntity> {
		this.logger.debug(`[UPDATE] Updating data source with id=${id} for pageId=${pageId}`);

		const page = await this.pagesService.getOneOrThrow<CardsPageEntity>(pageId);
		const card = await this.getOneOrThrow(id, page.id);

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

		const updatedCard = await this.getOneOrThrow(card.id, page.id);

		this.logger.debug(`[UPDATE] Successfully updated card with id=${updatedCard.id} for pageId=${pageId}`);

		this.gateway.sendMessage(EventType.CARD_UPDATED, updatedCard);

		return updatedCard;
	}

	async remove(id: string, pageId?: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing card with id=${id} for pageId=${pageId}`);

		const page = await this.pagesService.getOneOrThrow<CardsPageEntity>(pageId);
		const card = await this.getOneOrThrow(id, page.id);

		await this.repository.remove(card);

		this.logger.log(`[DELETE] Successfully removed card with id=${id} for pageId=${pageId}`);

		this.gateway.sendMessage(EventType.CARD_DELETED, card);
	}

	async getOneOrThrow(id: string, pageId?: string): Promise<CardEntity> {
		const card = await this.findOne(id, pageId);

		if (!card) {
			this.logger.error(`[ERROR] Card with id=${id} for pageId=${pageId} not found`);

			throw new DashboardNotFoundException('Requested page card does not exist');
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

			throw new DashboardValidationException('Provided card data are invalid.');
		}

		return dtoInstance;
	}
}
