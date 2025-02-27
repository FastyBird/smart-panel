import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource as OrmDataSource, Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { EventType } from '../dashboard.constants';
import { DashboardException, DashboardNotFoundException, DashboardValidationException } from '../dashboard.exceptions';
import { CreateDataSourceDto } from '../dto/create-data-source.dto';
import { UpdateDataSourceDto } from '../dto/update-data-source.dto';
import { DataSourceEntity, TileEntity, TilesPageEntity } from '../entities/dashboard.entity';

import { CardsService } from './cards.service';
import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';
import { PagesService } from './pages.service';
import { TilesService } from './tiles.service';

interface FilterBy {
	pageId?: string;
	cardId?: string;
	tileId?: string;
}

@Injectable()
export class DataSourceService {
	private readonly logger = new Logger(DataSourceService.name);

	constructor(
		@InjectRepository(DataSourceEntity)
		private readonly repository: Repository<DataSourceEntity>,
		private readonly pagesService: PagesService,
		private readonly cardsService: CardsService,
		private readonly tilesService: TilesService,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
		private readonly dataSource: OrmDataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAll<TDataSource extends DataSourceEntity>(filterBy?: FilterBy): Promise<TDataSource[]> {
		if (filterBy?.pageId) {
			this.logger.debug(`[LOOKUP ALL] Fetching all data sources for pageId=${filterBy.pageId}`);

			const tile = await this.tilesService.getOneOrThrow(filterBy.pageId);

			const dataSources = await this.repository
				.createQueryBuilder('dataSource')
				.innerJoinAndSelect('dataSource.page', 'page')
				.leftJoinAndSelect('dataSource.device', 'device')
				.leftJoinAndSelect('dataSource.channel', 'channel')
				.leftJoinAndSelect('dataSource.property', 'property')
				.where('tile.id = :pageId', { pageId: tile.id })
				.getMany();

			this.logger.debug(`[LOOKUP ALL] Found ${dataSources.length} data sources for pageId=${filterBy.pageId}`);

			return dataSources as TDataSource[];
		} else if (filterBy?.cardId) {
			this.logger.debug(`[LOOKUP ALL] Fetching all data sources for cardId=${filterBy.cardId}`);

			const tile = await this.tilesService.getOneOrThrow(filterBy.cardId);

			const dataSources = await this.repository
				.createQueryBuilder('dataSource')
				.innerJoinAndSelect('dataSource.card', 'card')
				.leftJoinAndSelect('dataSource.device', 'device')
				.leftJoinAndSelect('dataSource.channel', 'channel')
				.leftJoinAndSelect('dataSource.property', 'property')
				.where('tile.id = :cardId', { cardId: tile.id })
				.getMany();

			this.logger.debug(`[LOOKUP ALL] Found ${dataSources.length} data sources for cardId=${filterBy.cardId}`);

			return dataSources as TDataSource[];
		} else if (filterBy?.tileId) {
			this.logger.debug(`[LOOKUP ALL] Fetching all data sources for tileId=${filterBy.tileId}`);

			const tile = await this.tilesService.getOneOrThrow(filterBy.tileId);

			const dataSources = await this.repository
				.createQueryBuilder('dataSource')
				.innerJoinAndSelect('dataSource.tile', 'tile')
				.leftJoinAndSelect('dataSource.device', 'device')
				.leftJoinAndSelect('dataSource.channel', 'channel')
				.leftJoinAndSelect('dataSource.property', 'property')
				.where('tile.id = :tileId', { tileId: tile.id })
				.getMany();

			this.logger.debug(`[LOOKUP ALL] Found ${dataSources.length} data sources for tileId=${filterBy.tileId}`);

			return dataSources as TDataSource[];
		}

		this.logger.debug('[LOOKUP ALL] Fetching all data sources');

		const dataSources = await this.repository.find({
			relations: ['tile', 'tile.page', 'device', 'channel', 'property'],
		});

		this.logger.debug(`[LOOKUP ALL] Found ${dataSources.length} data sources`);

		return dataSources as TDataSource[];
	}

	async findOne<TDataSource extends DataSourceEntity>(id: string, filterBy?: FilterBy): Promise<TDataSource | null> {
		let dataSource: DataSourceEntity | null;

		if (filterBy?.pageId) {
			this.logger.debug(`[LOOKUP] Fetching data source with id=${id} for pageId=${filterBy.pageId}`);

			const tile = await this.tilesService.getOneOrThrow(filterBy.pageId);

			dataSource = await this.repository
				.createQueryBuilder('dataSource')
				.innerJoinAndSelect('dataSource.page', 'page')
				.leftJoinAndSelect('dataSource.device', 'device')
				.leftJoinAndSelect('dataSource.channel', 'channel')
				.leftJoinAndSelect('dataSource.property', 'property')
				.where('dataSource.id = :id', { id })
				.andWhere('tile.id = :pageId', { pageId: tile.id })
				.getOne();

			if (!dataSource) {
				this.logger.warn(`[LOOKUP] Data source with id=${id} for pageId=${filterBy.pageId} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched data source with id=${id} for pageId=${filterBy.pageId}`);
		} else if (filterBy?.cardId) {
			this.logger.debug(`[LOOKUP] Fetching data source with id=${id} for cardId=${filterBy.cardId}`);

			const tile = await this.tilesService.getOneOrThrow(filterBy.cardId);

			dataSource = await this.repository
				.createQueryBuilder('dataSource')
				.innerJoinAndSelect('dataSource.card', 'card')
				.leftJoinAndSelect('dataSource.device', 'device')
				.leftJoinAndSelect('dataSource.channel', 'channel')
				.leftJoinAndSelect('dataSource.property', 'property')
				.where('dataSource.id = :id', { id })
				.andWhere('tile.id = :cardId', { cardId: tile.id })
				.getOne();

			if (!dataSource) {
				this.logger.warn(`[LOOKUP] Data source with id=${id} for cardId=${filterBy.cardId} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched data source with id=${id} for cardId=${filterBy.cardId}`);
		} else if (filterBy?.tileId) {
			this.logger.debug(`[LOOKUP] Fetching data source with id=${id} for tileId=${filterBy.tileId}`);

			const tile = await this.tilesService.getOneOrThrow(filterBy.tileId);

			dataSource = await this.repository
				.createQueryBuilder('dataSource')
				.innerJoinAndSelect('dataSource.tile', 'tile')
				.leftJoinAndSelect('dataSource.device', 'device')
				.leftJoinAndSelect('dataSource.channel', 'channel')
				.leftJoinAndSelect('dataSource.property', 'property')
				.where('dataSource.id = :id', { id })
				.andWhere('tile.id = :tileId', { tileId: tile.id })
				.getOne();

			if (!dataSource) {
				this.logger.warn(`[LOOKUP] Data source with id=${id} for tileId=${filterBy.tileId} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched data source with id=${id} for tileId=${filterBy.tileId}`);
		} else {
			this.logger.debug(`[LOOKUP] Fetching data source with id=${id}`);

			dataSource = await this.repository.findOne({
				where: { id },
				relations: ['tile', 'tile.page', 'device', 'channel', 'property'],
			});

			if (!dataSource) {
				this.logger.warn(`[LOOKUP] Data source with id=${id} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched data source with id=${id}`);
		}

		return dataSource as TDataSource;
	}

	async create<TDataSource extends DataSourceEntity, TCreateDTO extends CreateDataSourceDto>(
		createDto: CreateDataSourceDto,
		relation: FilterBy,
	): Promise<TDataSource> {
		this.logger.debug(
			`[CREATE] Creating new data source for pageId=${relation.pageId} cardId=${relation.cardId} tileId=${relation.tileId}`,
		);

		const page = relation.pageId ? await this.pagesService.getOneOrThrow<TilesPageEntity>(relation.pageId) : undefined;
		const card = relation.cardId ? await this.cardsService.getOneOrThrow(relation.cardId) : undefined;
		const tile = relation.tileId ? await this.tilesService.getOneOrThrow<TileEntity>(relation.tileId) : undefined;

		if (!page && !card && !tile) {
			throw new DashboardException('The page or card or tile relation have to be provided.');
		}

		const { type } = createDto;

		if (!type) {
			this.logger.error('[CREATE] Validation failed: Missing required "type" property in data.');

			throw new DashboardException('The "type" property is required in the data.');
		}

		const mapping = this.dataSourcesMapperService.getMapping<TDataSource, TCreateDTO, any>(type);

		const dtoInstance = await this.validateDto<TCreateDTO>(mapping.createDto, createDto);

		const repository: Repository<TDataSource> = this.dataSource.getRepository(mapping.class);

		const dataSource = repository.create(
			plainToInstance(
				mapping.class,
				{ ...dtoInstance, page: page?.id, card: card?.id, tile: tile?.id },
				{
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				},
			),
		);

		// Save the dataSource
		await repository.save(dataSource);

		// Retrieve the saved dataSource with its full relations
		const savedDataSource = await this.getOneOrThrow<TDataSource>(dataSource.id);

		this.logger.debug(`[CREATE] Successfully created data source with id=${savedDataSource.id}`);

		this.eventEmitter.emit(EventType.DATA_SOURCE_CREATED, savedDataSource);

		return savedDataSource;
	}

	async update<TDataSource extends DataSourceEntity, TUpdateDTO extends UpdateDataSourceDto>(
		id: string,
		updateDto: UpdateDataSourceDto,
	): Promise<TDataSource> {
		this.logger.debug(`[UPDATE] Updating data source with id=${id}`);

		const dataSource = await this.getOneOrThrow<TDataSource>(id);

		const mapping = this.dataSourcesMapperService.getMapping<TDataSource, any, TUpdateDTO>(dataSource.type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

		const repository: Repository<TDataSource> = this.dataSource.getRepository(mapping.class);

		Object.assign(
			dataSource,
			omitBy(
				plainToInstance(mapping.class, dtoInstance, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeDefaultValues: false,
				}),
				isUndefined,
			),
		);

		await repository.save(dataSource);

		const updatedDataSource = await this.getOneOrThrow<TDataSource>(id);

		this.logger.debug(`[UPDATE] Successfully updated data source with id=${updatedDataSource.id}`);

		this.eventEmitter.emit(EventType.DATA_SOURCE_UPDATED, updatedDataSource);

		return updatedDataSource;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing data source with id=${id}`);

		const dataSource = await this.getOneOrThrow<DataSourceEntity>(id);

		await this.repository.remove(dataSource);

		this.logger.log(`[DELETE] Successfully removed data source with id=${id}`);

		this.eventEmitter.emit(EventType.DATA_SOURCE_DELETED, dataSource);
	}

	async getOneOrThrow<TDataSource extends DataSourceEntity>(id: string, filterBy?: FilterBy): Promise<TDataSource> {
		const dataSource = await this.findOne<TDataSource>(id, filterBy);

		if (!dataSource) {
			this.logger.error(
				`[ERROR] Data source with id=${id} for pageId=${filterBy?.pageId} cardId=${filterBy?.cardId} tileId=${filterBy?.tileId} not found`,
			);

			throw new DashboardNotFoundException('Requested data source does not exist');
		}

		return dataSource;
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

			throw new DashboardValidationException('Provided data source data are invalid.');
		}

		return dtoInstance;
	}
}
