import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource as OrmDataSource, Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { WebsocketGateway } from '../../websocket/gateway/websocket.gateway';
import { EventType } from '../dashboard.constants';
import { DashboardException, DashboardNotFoundException, DashboardValidationException } from '../dashboard.exceptions';
import { CreateDataSourceDto } from '../dto/create-data-source.dto';
import { CreateTileDto } from '../dto/create-tile.dto';
import { UpdateTileDto } from '../dto/update-tile.dto';
import { DataSourceEntity, TileEntity, TilesPageEntity } from '../entities/dashboard.entity';

import { CardsService } from './cards.service';
import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';
import { PagesService } from './pages.service';
import { TilesTypeMapperService } from './tiles-type-mapper.service';

interface FilterBy {
	pageId?: string;
	cardId?: string;
}

@Injectable()
export class TilesService {
	private readonly logger = new Logger(TilesService.name);

	constructor(
		@InjectRepository(TileEntity)
		private readonly repository: Repository<TileEntity>,
		private readonly pagesService: PagesService,
		private readonly cardsService: CardsService,
		private readonly tilesMapperService: TilesTypeMapperService,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
		private readonly dataSource: OrmDataSource,
		private readonly gateway: WebsocketGateway,
	) {}

	async findAll<TTile extends TileEntity>(filterBy?: FilterBy): Promise<TTile[]> {
		if (filterBy?.pageId) {
			this.logger.debug(`[LOOKUP ALL] Fetching all tiles for pageId=${filterBy.pageId}`);

			const page = await this.pagesService.getOneOrThrow<TilesPageEntity>(filterBy.pageId);

			const tiles = await this.repository
				.createQueryBuilder('tile')
				.innerJoinAndSelect('tile.page', 'page')
				.leftJoinAndSelect('tile.dataSource', 'dataSource')
				.leftJoinAndSelect('tile.device', 'device')
				.where('page.id = :pageId', { pageId: page.id })
				.getMany();

			this.logger.debug(`[LOOKUP ALL] Found ${tiles.length} tiles for pageId=${filterBy.pageId}`);

			return tiles as TTile[];
		}

		if (filterBy?.cardId) {
			this.logger.debug(`[LOOKUP ALL] Fetching all tiles for cardId=${filterBy.cardId}`);

			const card = await this.cardsService.getOneOrThrow(filterBy.cardId);

			const tiles = await this.repository
				.createQueryBuilder('tile')
				.innerJoinAndSelect('tile.card', 'card')
				.leftJoinAndSelect('tile.dataSource', 'dataSource')
				.leftJoinAndSelect('tile.device', 'device')
				.where('card.id = :cardId', { cardId: card.id })
				.getMany();

			this.logger.debug(`[LOOKUP ALL] Found ${tiles.length} tiles for cardId=${filterBy.cardId}`);

			return tiles as TTile[];
		}

		this.logger.debug('[LOOKUP ALL] Fetching all tiles');

		const tiles = await this.repository.find({
			relations: ['page', 'card', 'dataSource', 'dataSource.tile', 'device'],
		});

		this.logger.debug(`[LOOKUP ALL] Found ${tiles.length} tiles`);

		return tiles as TTile[];
	}

	async findOne<TTile extends TileEntity>(id: string, filterBy?: FilterBy): Promise<TTile | null> {
		let tile: TileEntity | null;

		if (filterBy?.pageId) {
			this.logger.debug(`[LOOKUP] Fetching tile with id=${id} for pageId=${filterBy.pageId}`);

			const page = await this.pagesService.getOneOrThrow<TilesPageEntity>(filterBy.pageId);

			tile = await this.repository
				.createQueryBuilder('tile')
				.innerJoinAndSelect('tile.page', 'page')
				.leftJoinAndSelect('tile.dataSource', 'dataSource')
				.leftJoinAndSelect('tile.device', 'device')
				.where('tile.id = :id', { id })
				.andWhere('page.id = :pageId', { pageId: page.id })
				.getOne();

			if (!tile) {
				this.logger.warn(`[LOOKUP] Tile with id=${id} for pageId=${filterBy.pageId} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched tile with id=${id} for pageId=${filterBy.pageId}`);
		} else if (filterBy?.cardId) {
			this.logger.debug(`[LOOKUP] Fetching tile with id=${id} for cardId=${filterBy.cardId}`);

			const page = await this.pagesService.getOneOrThrow<TilesPageEntity>(filterBy.cardId);

			tile = await this.repository
				.createQueryBuilder('tile')
				.innerJoinAndSelect('tile.card', 'card')
				.leftJoinAndSelect('tile.dataSource', 'dataSource')
				.leftJoinAndSelect('tile.device', 'device')
				.where('tile.id = :id', { id })
				.andWhere('card.id = :cardId', { cardId: page.id })
				.getOne();

			if (!tile) {
				this.logger.warn(`[LOOKUP] Tile with id=${id} for cardId=${filterBy.cardId} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched tile with id=${id} for cardId=${filterBy.cardId}`);
		} else {
			this.logger.debug(`[LOOKUP] Fetching tile with id=${id}`);

			tile = await this.repository.findOne({
				where: { id },
				relations: ['page', 'card', 'dataSource', 'dataSource.tile', 'device'],
			});

			if (!tile) {
				this.logger.warn(`[LOOKUP] Tile with id=${id} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched tile with id=${id}`);
		}

		return tile as TTile;
	}

	async create<TTile extends TileEntity, TCreateDTO extends CreateTileDto>(
		createDto: CreateTileDto,
		relation: FilterBy,
	): Promise<TTile> {
		this.logger.debug(`[CREATE] Creating new tile for pageId=${relation.pageId}`);

		const page = relation.pageId ? await this.pagesService.getOneOrThrow<TilesPageEntity>(relation.pageId) : undefined;
		const card = relation.cardId ? await this.cardsService.getOneOrThrow(relation.cardId) : undefined;

		if (!page && !card) {
			throw new DashboardException('The page or card relation have to be provided.');
		}

		const { type } = createDto;

		if (!type) {
			this.logger.error('[CREATE] Validation failed: Missing required "type" property in data.');

			throw new DashboardException('The "type" property is required in the data.');
		}

		const mapping = this.tilesMapperService.getMapping<TTile, TCreateDTO, any>(type);

		const dtoInstance = await this.validateDto<TCreateDTO>(mapping.createDto, createDto);

		const repository: Repository<TTile> = this.dataSource.getRepository(mapping.class);

		const tile = plainToInstance(
			mapping.class,
			{ ...dtoInstance, page: page?.id, card: card?.id },
			{
				enableImplicitConversion: true,
				excludeExtraneousValues: true,
				exposeUnsetFields: false,
			},
		);

		tile.dataSource = (dtoInstance.data_source || []).map((createDataSourceDto: CreateDataSourceDto) => {
			const dataSourceMapping = this.dataSourcesMapperService.getMapping(createDataSourceDto.type);

			const dataSourceRepository: Repository<DataSourceEntity> = this.dataSource.getRepository(dataSourceMapping.class);

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

		const created = repository.create(tile);

		// Save the tile
		await repository.save(created);

		// Retrieve the saved tile with its full relations
		const savedTile = await this.getOneOrThrow<TTile>(created.id, { pageId: page?.id, cardId: card?.id });

		this.logger.debug(`[CREATE] Successfully created tile with id=${savedTile.id}`);

		this.gateway.sendMessage(EventType.TILE_CREATED, savedTile);

		return savedTile;
	}

	async update<TTile extends TileEntity, TUpdateDTO extends UpdateTileDto>(
		id: string,
		updateDto: UpdateTileDto,
	): Promise<TTile> {
		this.logger.debug(`[UPDATE] Updating data source with id=${id}`);

		const tile = await this.getOneOrThrow<TTile>(id);

		const mapping = this.tilesMapperService.getMapping<TTile, any, TUpdateDTO>(tile.type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

		const repository: Repository<TTile> = this.dataSource.getRepository(mapping.class);

		Object.assign(
			tile,
			omitBy(
				plainToInstance(mapping.class, dtoInstance, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeDefaultValues: false,
				}),
				isUndefined,
			),
		);

		await repository.save(tile);

		const updatedTile = await this.getOneOrThrow<TTile>(tile.id);

		this.logger.debug(`[UPDATE] Successfully updated tile with id=${updatedTile.id}`);

		this.gateway.sendMessage(EventType.TILE_UPDATED, updatedTile);

		return updatedTile;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing tile with id=${id}`);

		const tile = await this.getOneOrThrow<TileEntity>(id);

		await this.repository.remove(tile);

		this.logger.log(`[DELETE] Successfully removed tile with id=${id}`);

		this.gateway.sendMessage(EventType.TILE_DELETED, tile);
	}

	async getOneOrThrow<TTile extends TileEntity>(id: string, filterBy?: FilterBy): Promise<TTile> {
		const tile = await this.findOne<TTile>(id, filterBy);

		if (!tile) {
			this.logger.error(
				`[ERROR] Tile with id=${id} for pageId=${filterBy?.pageId} cardId=${filterBy?.cardId} not found`,
			);

			throw new DashboardNotFoundException('Requested tile does not exist');
		}

		return tile;
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

			throw new DashboardValidationException('Provided tile data are invalid.');
		}

		return dtoInstance;
	}
}
