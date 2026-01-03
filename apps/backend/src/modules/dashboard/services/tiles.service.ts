import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource as OrmDataSource, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { DASHBOARD_MODULE_NAME, EventType } from '../dashboard.constants';
import { DashboardException, DashboardNotFoundException, DashboardValidationException } from '../dashboard.exceptions';
import { CreateDataSourceDto } from '../dto/create-data-source.dto';
import { CreateTileDto } from '../dto/create-tile.dto';
import { UpdateTileDto } from '../dto/update-tile.dto';
import { DataSourceEntity, TileEntity } from '../entities/dashboard.entity';

import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';
import { DataSourcesService } from './data-sources.service';
import { TileCreateBuilderRegistryService } from './tile-create-builder-registry.service';
import { TileRelationsLoaderRegistryService } from './tile-relations-loader-registry.service';
import { TilesTypeMapperService } from './tiles-type-mapper.service';

interface Relation {
	parentType: string;
	parentId: string;
}

@Injectable()
export class TilesService {
	private readonly logger = createExtensionLogger(DASHBOARD_MODULE_NAME, 'TilesService');

	constructor(
		@InjectRepository(TileEntity)
		private readonly repository: Repository<TileEntity>,
		private readonly dataSourceService: DataSourcesService,
		private readonly tilesMapperService: TilesTypeMapperService,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
		private readonly relationsRegistryService: TileRelationsLoaderRegistryService,
		private readonly nestedCreateBuilders: TileCreateBuilderRegistryService,
		private readonly dataSource: OrmDataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async getCount<TTile extends TileEntity>(relation?: Relation, type?: string): Promise<number> {
		const mapping = type ? this.tilesMapperService.getMapping<TTile, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		if (relation) {
			return repository
				.createQueryBuilder('tile')
				.where('tile.parentType = :parentType', { parentType: relation.parentType })
				.andWhere('tile.parentId = :parentId', { parentId: relation.parentId })
				.getCount();
		}

		return repository.count();
	}

	async findAll<TTile extends TileEntity>(relation?: Relation, type?: string): Promise<TTile[]> {
		const mapping = type ? this.tilesMapperService.getMapping<TTile, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		let tiles: TileEntity[];

		if (relation) {
			tiles = await repository
				.createQueryBuilder('tile')
				.where('tile.parentType = :parentType', { parentType: relation.parentType })
				.andWhere('tile.parentId = :parentId', { parentId: relation.parentId })
				.getMany();
		} else {
			tiles = await repository.find();
		}

		for (const tile of tiles) {
			await this.loadRelations(tile);
		}

		return tiles as TTile[];
	}

	async findOne<TTile extends TileEntity>(id: string, relation?: Relation, type?: string): Promise<TTile | null> {
		const mapping = type ? this.tilesMapperService.getMapping<TTile, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		let tile: TileEntity | null;

		if (relation) {
			tile = await repository
				.createQueryBuilder('tile')
				.where('tile.id = :id', { id })
				.andWhere('tile.parentType = :parentType', { parentType: relation.parentType })
				.andWhere('tile.parentId = :parentId', { parentId: relation.parentId })
				.getOne();
		} else {
			tile = await repository.createQueryBuilder('tile').where('tile.id = :id', { id }).getOne();
		}

		if (!tile) {
			return null;
		}

		await this.loadRelations(tile);

		return tile as TTile;
	}

	async create<TTile extends TileEntity, TCreateDTO extends CreateTileDto>(
		createDto: CreateTileDto,
		relation: Relation,
	): Promise<TTile> {
		this.logger.debug(`Creating new tile for parentType=${relation.parentType} and parentId=${relation.parentId}`);

		const { type } = createDto;

		if (!type) {
			this.logger.error('Validation failed: Missing required "type" property in data.');

			throw new DashboardException('The "type" property is required in the data.');
		}

		const mapping = this.tilesMapperService.getMapping<TTile, TCreateDTO, any>(type);

		const dtoInstance = await this.validateDto<TCreateDTO>(mapping.createDto, createDto);

		const repository: Repository<TTile> = this.dataSource.getRepository(mapping.class);

		const tile = toInstance(mapping.class, {
			...dtoInstance,
			parentType: relation.parentType,
			parentId: relation.parentId,
		});

		for (const builder of this.nestedCreateBuilders.getBuilders()) {
			if (builder.supports(dtoInstance)) {
				await builder.build(dtoInstance, tile);
			}
		}

		tile.dataSource = (dtoInstance.data_source || []).map((createDataSourceDto: CreateDataSourceDto) => {
			const dataSourceMapping = this.dataSourcesMapperService.getMapping(createDataSourceDto.type);

			const dataSourceRepository: Repository<DataSourceEntity> = this.dataSource.getRepository(dataSourceMapping.class);

			return dataSourceRepository.create(
				toInstance(dataSourceMapping.class, { ...createDataSourceDto, parentType: 'tile', parentId: tile.id }),
			);
		});

		const created = repository.create(tile);

		// Save the tile
		await repository.save(created);

		// Retrieve the saved tile with its full relations
		const savedTile = await this.getOneOrThrow<TTile>(created.id, relation);

		this.logger.debug(`Successfully created tile with id=${savedTile.id}`);

		this.eventEmitter.emit(EventType.TILE_CREATED, savedTile);

		return savedTile;
	}

	async update<TTile extends TileEntity, TUpdateDTO extends UpdateTileDto>(
		id: string,
		updateDto: UpdateTileDto,
	): Promise<TTile> {
		const tile = await this.getOneOrThrow<TTile>(id);

		const mapping = this.tilesMapperService.getMapping<TTile, any, TUpdateDTO>(tile.type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

		const repository: Repository<TTile> = this.dataSource.getRepository(mapping.class);

		Object.assign(tile, omitBy(toInstance(mapping.class, dtoInstance), isUndefined));

		await repository.save(tile);

		const updatedTile = await this.getOneOrThrow<TTile>(tile.id);

		this.eventEmitter.emit(EventType.TILE_UPDATED, updatedTile);

		return updatedTile;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`Removing tile with id=${id}`);

		const fullTile = await this.getOneOrThrow<TileEntity>(id);

		await this.dataSource.transaction(async (manager) => {
			const tile = await manager.findOneOrFail<TileEntity>(TileEntity, { where: { id } });

			const dataSources = await manager.find<DataSourceEntity>(DataSourceEntity, {
				where: { parentType: 'tile', parentId: tile.id },
			});

			for (const dataSource of dataSources) {
				await this.dataSourceService.remove(dataSource.id, manager);
			}

			await manager.remove(tile);

			this.logger.log(`Successfully removed tile with id=${id}`);

			this.eventEmitter.emit(EventType.TILE_DELETED, fullTile);
		});
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
		const dtoInstance = toInstance(DtoClass, dto, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
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
