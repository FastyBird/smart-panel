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
import { CreateTileDto } from '../dto/create-tile.dto';
import { UpdateTileDto } from '../dto/update-tile.dto';
import { DataSourceEntity, TileEntity } from '../entities/dashboard.entity';

import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';
import { DataSourceService } from './data-source.service';
import { TileCreateBuilderRegistryService } from './tile-create-builder-registry.service';
import { TileRelationsLoaderRegistryService } from './tile-relations-loader-registry.service';
import { TilesTypeMapperService } from './tiles-type-mapper.service';

interface Relation {
	parentType: string;
	parentId: string;
}

@Injectable()
export class TilesService {
	private readonly logger = new Logger(TilesService.name);

	constructor(
		@InjectRepository(TileEntity)
		private readonly repository: Repository<TileEntity>,
		private readonly dataSourceService: DataSourceService,
		private readonly tilesMapperService: TilesTypeMapperService,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
		private readonly relationsRegistryService: TileRelationsLoaderRegistryService,
		private readonly nestedCreateBuilders: TileCreateBuilderRegistryService,
		private readonly dataSource: OrmDataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAll<TTile extends TileEntity>(relation?: Relation): Promise<TTile[]> {
		if (relation) {
			this.logger.debug(
				`[LOOKUP ALL] Fetching all tiles for parentType=${relation.parentType} and parentId=${relation.parentId}`,
			);

			const tiles = await this.repository
				.createQueryBuilder('tile')
				.where('tile.parentType = :parentType', { parentType: relation.parentType })
				.andWhere('tile.parentId = :parentId', { parentId: relation.parentId })
				.getMany();

			this.logger.debug(
				`[LOOKUP ALL] Found ${tiles.length} tiles for parentType=${relation.parentType} and parentId=${relation.parentId}`,
			);

			for (const tile of tiles) {
				await this.loadRelations(tile);
			}

			return tiles as TTile[];
		}

		this.logger.debug('[LOOKUP ALL] Fetching all tiles');

		const tiles = await this.repository.find();

		this.logger.debug(`[LOOKUP ALL] Found ${tiles.length} tiles`);

		for (const tile of tiles) {
			await this.loadRelations(tile);
		}

		return tiles as TTile[];
	}

	async findOne<TTile extends TileEntity>(id: string, relation?: Relation): Promise<TTile | null> {
		let tile: TileEntity | null;

		if (relation) {
			this.logger.debug(
				`[LOOKUP] Fetching tile with id=${id} for parentType=${relation.parentType} and parentId=${relation.parentId}`,
			);

			tile = await this.repository
				.createQueryBuilder('tile')
				.where('tile.id = :id', { id })
				.andWhere('tile.parentType = :parentType', { parentType: relation.parentType })
				.andWhere('tile.parentId = :parentId', { parentId: relation.parentId })
				.getOne();

			if (!tile) {
				this.logger.warn(
					`[LOOKUP] Tile with id=${id} for parentType=${relation.parentType} and parentId=${relation.parentId} not found`,
				);

				return null;
			}

			this.logger.debug(
				`[LOOKUP] Successfully fetched tile with id=${id} parentType=${relation.parentType} and parentId=${relation.parentId}`,
			);
		} else {
			this.logger.debug(`[LOOKUP] Fetching tile with id=${id}`);

			tile = await this.repository.findOne({
				where: { id },
			});

			if (!tile) {
				this.logger.warn(`[LOOKUP] Tile with id=${id} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched tile with id=${id}`);
		}

		await this.loadRelations(tile);

		return tile as TTile;
	}

	async create<TTile extends TileEntity, TCreateDTO extends CreateTileDto>(
		createDto: CreateTileDto,
		relation?: Relation,
	): Promise<TTile> {
		this.logger.debug(
			`[CREATE] Creating new tile for parentType=${relation.parentType} and parentId=${relation.parentId}`,
		);

		const { type } = createDto;

		if (!type) {
			this.logger.error('[CREATE] Validation failed: Missing required "type" property in data.');

			throw new DashboardException('The "type" property is required in the data.');
		}

		const mapping = this.tilesMapperService.getMapping<TTile, TCreateDTO, any>(type);

		const dtoInstance = await this.validateDto<TCreateDTO>(mapping.createDto, createDto);

		let parent: { parentId: string; parentType: string };

		if (relation?.parentType && relation?.parentId) {
			parent = { parentType: relation.parentType, parentId: relation.parentId };
		} else if (dtoInstance.parent?.type && dtoInstance.parent?.id) {
			parent = { parentType: dtoInstance.parent.type, parentId: dtoInstance.parent.id };
		} else {
			this.logger.error('[CREATE] Relation invalid: Missing required relation definition.');

			throw new DashboardException('Missing both parentType and parentId for assigning parent relation.');
		}

		const repository: Repository<TTile> = this.dataSource.getRepository(mapping.class);

		const tile = plainToInstance(
			mapping.class,
			{ ...dtoInstance, ...parent },
			{
				enableImplicitConversion: true,
				excludeExtraneousValues: true,
				exposeUnsetFields: false,
			},
		);

		for (const builder of this.nestedCreateBuilders.getBuilders()) {
			if (builder.supports(dtoInstance)) {
				await builder.build(dtoInstance, tile);
			}
		}

		tile.dataSource = (dtoInstance.data_source || []).map((createDataSourceDto: CreateDataSourceDto) => {
			const dataSourceMapping = this.dataSourcesMapperService.getMapping(createDataSourceDto.type);

			const dataSourceRepository: Repository<DataSourceEntity> = this.dataSource.getRepository(dataSourceMapping.class);

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

		const created = repository.create(tile);

		// Save the tile
		await repository.save(created);

		// Retrieve the saved tile with its full relations
		const savedTile = await this.getOneOrThrow<TTile>(created.id, relation);

		this.logger.debug(`[CREATE] Successfully created tile with id=${savedTile.id}`);

		this.eventEmitter.emit(EventType.TILE_CREATED, savedTile);

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

		this.eventEmitter.emit(EventType.TILE_UPDATED, updatedTile);

		return updatedTile;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing tile with id=${id}`);

		const tile = await this.getOneOrThrow<TileEntity>(id);

		await this.repository.remove(tile);

		this.logger.log(`[DELETE] Successfully removed tile with id=${id}`);

		this.eventEmitter.emit(EventType.TILE_DELETED, tile);
	}

	async getOneOrThrow<TTile extends TileEntity>(id: string, relation?: Relation): Promise<TTile> {
		const tile = await this.findOne<TTile>(id, relation);

		if (!tile) {
			this.logger.error(
				`[ERROR] Tile with id=${id} for parentType=${relation.parentType} and parentId=${relation.parentId} not found`,
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

	private async loadRelations(entity: TileEntity): Promise<void> {
		entity.dataSource = await this.dataSourceService.findAll({
			parentType: 'tile',
			parentId: entity.id,
		});

		for (const loader of this.relationsRegistryService.getLoaders()) {
			if (loader.supports(entity)) {
				await loader.loadRelations(entity);
			}
		}
	}
}
