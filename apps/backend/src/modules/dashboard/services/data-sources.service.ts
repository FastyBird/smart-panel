import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { EntityManager, DataSource as OrmDataSource, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { DASHBOARD_MODULE_NAME, EventType } from '../dashboard.constants';
import { DashboardException, DashboardNotFoundException, DashboardValidationException } from '../dashboard.exceptions';
import { CreateDataSourceDto } from '../dto/create-data-source.dto';
import { UpdateDataSourceDto } from '../dto/update-data-source.dto';
import { DataSourceEntity } from '../entities/dashboard.entity';

import { DataSourceCreateBuilderRegistryService } from './data-source-create-builder-registry.service';
import { DataSourceRelationsLoaderRegistryService } from './data-source-relations-loader-registry.service';
import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';

interface Relation {
	parentType: string;
	parentId: string;
}

@Injectable()
export class DataSourcesService {
	private readonly logger = createExtensionLogger(DASHBOARD_MODULE_NAME, 'DataSourcesService');

	constructor(
		@InjectRepository(DataSourceEntity)
		private readonly repository: Repository<DataSourceEntity>,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
		private readonly relationsRegistryService: DataSourceRelationsLoaderRegistryService,
		private readonly nestedCreateBuilders: DataSourceCreateBuilderRegistryService,
		private readonly dataSource: OrmDataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async getCount<TDataSource extends DataSourceEntity>(relation?: Relation, type?: string): Promise<number> {
		const mapping = type ? this.dataSourcesMapperService.getMapping<TDataSource, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		if (relation) {
			this.logger.debug(
				`Fetching all data sources count for parentType=${relation.parentType} and parentId=${relation.parentId}`,
			);

			const dataSources = await repository
				.createQueryBuilder('dataSource')
				.where('dataSource.parentType = :parentType', { parentType: relation.parentType })
				.andWhere('dataSource.parentId = :parentId', { parentId: relation.parentId })
				.getCount();

			this.logger.debug(
				`Found that in system is ${dataSources} data sources for parentType=${relation.parentType} and parentId=${relation.parentId}`,
			);

			return dataSources;
		}

		this.logger.debug('Fetching all data sources count');

		const dataSources = await repository.count();

		this.logger.debug(`Found that in system is ${dataSources} data sources`);

		return dataSources;
	}

	async findAll<TDataSource extends DataSourceEntity>(relation?: Relation, type?: string): Promise<TDataSource[]> {
		const mapping = type ? this.dataSourcesMapperService.getMapping<TDataSource, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		if (relation) {
			this.logger.debug(
				`Fetching all data sources for parentType=${relation.parentType} and parentId=${relation.parentId}`,
			);

			const dataSources = await repository
				.createQueryBuilder('dataSource')
				.where('dataSource.parentType = :parentType', { parentType: relation.parentType })
				.andWhere('dataSource.parentId = :parentId', { parentId: relation.parentId })
				.getMany();

			this.logger.debug(
				`Found ${dataSources.length} data sources for parentType=${relation.parentType} and parentId=${relation.parentId}`,
			);

			for (const dataSource of dataSources) {
				await this.loadRelations(dataSource);
			}

			return dataSources as TDataSource[];
		}

		this.logger.debug('Fetching all data sources');

		const dataSources = await repository.find();

		this.logger.debug(`Found ${dataSources.length} data sources`);

		for (const dataSource of dataSources) {
			await this.loadRelations(dataSource);
		}

		return dataSources as TDataSource[];
	}

	async findOne<TDataSource extends DataSourceEntity>(
		id: string,
		relation?: Relation,
		type?: string,
	): Promise<TDataSource | null> {
		const mapping = type ? this.dataSourcesMapperService.getMapping<TDataSource, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		let dataSource: DataSourceEntity | null;

		if (relation) {
			this.logger.debug(
				`Fetching data source with id=${id} for parentType=${relation.parentType} and parentId=${relation.parentId}`,
			);

			dataSource = await repository
				.createQueryBuilder('dataSource')
				.where('dataSource.id = :id', { id })
				.andWhere('dataSource.parentType = :parentType', { parentType: relation.parentType })
				.andWhere('dataSource.parentId = :parentId', { parentId: relation.parentId })
				.getOne();

			if (!dataSource) {
				this.logger.debug(
					`Data source with id=${id} for parentType=${relation.parentType} and parentId=${relation.parentId} not found`,
				);

				return null;
			}

			this.logger.debug(
				`Successfully fetched data source with id=${id} for parentType=${relation.parentType} and parentId=${relation.parentId}`,
			);
		} else {
			this.logger.debug(`Fetching data source with id=${id}`);

			dataSource = await repository.createQueryBuilder('dataSource').where('dataSource.id = :id', { id }).getOne();

			if (!dataSource) {
				this.logger.debug(`Data source with id=${id} not found`);

				return null;
			}

			this.logger.debug(`Successfully fetched data source with id=${id}`);
		}

		await this.loadRelations(dataSource);

		return dataSource as TDataSource;
	}

	async create<TDataSource extends DataSourceEntity, TCreateDTO extends CreateDataSourceDto>(
		createDto: CreateDataSourceDto,
		relation: Relation,
	): Promise<TDataSource> {
		this.logger.debug(
			`Creating new data source for parentType=${relation.parentType} and parentId=${relation.parentId}`,
		);

		const { type } = createDto;

		if (!type) {
			this.logger.error('Validation failed: Missing required "type" property in data.');

			throw new DashboardException('The "type" property is required in the data.');
		}

		const mapping = this.dataSourcesMapperService.getMapping<TDataSource, TCreateDTO, any>(type);

		const dtoInstance = await this.validateDto<TCreateDTO>(mapping.createDto, createDto);

		const repository: Repository<TDataSource> = this.dataSource.getRepository(mapping.class);

		const dataSource = repository.create(
			toInstance(mapping.class, { ...dtoInstance, parentType: relation.parentType, parentId: relation.parentId }),
		);

		for (const builder of this.nestedCreateBuilders.getBuilders()) {
			if (builder.supports(dtoInstance)) {
				await builder.build(dtoInstance, dataSource);
			}
		}

		// Save the dataSource
		await repository.save(dataSource);

		// Retrieve the saved dataSource with its full relations
		const savedDataSource = await this.getOneOrThrow<TDataSource>(dataSource.id, relation);

		this.logger.debug(`Successfully created data source with id=${savedDataSource.id}`);

		this.eventEmitter.emit(EventType.DATA_SOURCE_CREATED, savedDataSource);

		return savedDataSource;
	}

	async update<TDataSource extends DataSourceEntity, TUpdateDTO extends UpdateDataSourceDto>(
		id: string,
		updateDto: UpdateDataSourceDto,
	): Promise<TDataSource> {
		this.logger.debug(`Updating data source with id=${id}`);

		const dataSource = await this.getOneOrThrow<TDataSource>(id);

		const mapping = this.dataSourcesMapperService.getMapping<TDataSource, any, TUpdateDTO>(dataSource.type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

		const repository: Repository<TDataSource> = this.dataSource.getRepository(mapping.class);

		// Get the fields to update from DTO (excluding undefined values)
		const updateFields = omitBy(toInstance(mapping.class, dtoInstance), isUndefined);

		// Check if any entity fields are actually being changed by comparing with existing values
		const entityFieldsChanged = Object.keys(updateFields).some((key) => {
			const newValue = (updateFields as Record<string, unknown>)[key];
			const existingValue = (dataSource as unknown as Record<string, unknown>)[key];

			// Deep comparison for arrays
			if (Array.isArray(newValue) && Array.isArray(existingValue)) {
				return JSON.stringify(newValue) !== JSON.stringify(existingValue);
			}

			// Deep comparison for plain objects
			if (
				typeof newValue === 'object' &&
				typeof existingValue === 'object' &&
				newValue !== null &&
				existingValue !== null
			) {
				return JSON.stringify(newValue) !== JSON.stringify(existingValue);
			}

			// Handle null/undefined comparison
			if (newValue === null && existingValue === null) {
				return false;
			}
			if (newValue === null || existingValue === null) {
				return true;
			}

			// Simple value comparison
			return newValue !== existingValue;
		});

		Object.assign(dataSource, updateFields);

		await repository.save(dataSource);

		const updatedDataSource = await this.getOneOrThrow<TDataSource>(id);

		this.logger.debug(`Successfully updated data source with id=${updatedDataSource.id}`);

		if (entityFieldsChanged) {
			this.eventEmitter.emit(EventType.DATA_SOURCE_UPDATED, updatedDataSource);
		}

		return updatedDataSource;
	}

	async remove(id: string, manager: EntityManager = this.dataSource.manager): Promise<void> {
		this.logger.debug(`Removing data source with id=${id}`);

		const fullDataSource = await this.getOneOrThrow(id);

		const dataSource = await manager.findOneOrFail<DataSourceEntity>(DataSourceEntity, {
			where: { id },
		});

		await manager.remove(dataSource);

		this.logger.log(`Successfully removed data source with id=${id}`);

		this.eventEmitter.emit(EventType.DATA_SOURCE_DELETED, fullDataSource);
	}

	async getOneOrThrow<TDataSource extends DataSourceEntity>(id: string, relation?: Relation): Promise<TDataSource> {
		const dataSource = await this.findOne<TDataSource>(id, relation);

		if (!dataSource) {
			this.logger.error(
				`[ERROR] Data source with id=${id} for parentType=${relation.parentType} and parentId=${relation.parentId} not found`,
			);

			throw new DashboardNotFoundException('Requested data source does not exist');
		}

		return dataSource;
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

			throw new DashboardValidationException('Provided data source data are invalid.');
		}

		return dtoInstance;
	}

	private async loadRelations(entity: DataSourceEntity): Promise<void> {
		for (const loader of this.relationsRegistryService.getLoaders()) {
			if (loader.supports(entity)) {
				await loader.loadRelations(entity);
			}
		}
	}
}
