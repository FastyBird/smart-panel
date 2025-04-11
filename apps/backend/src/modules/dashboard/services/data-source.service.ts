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
import { DataSourceEntity } from '../entities/dashboard.entity';

import { DataSourceCreateBuilderRegistryService } from './data-source-create-builder-registry.service';
import { DataSourceRelationsLoaderRegistryService } from './data-source-relations-loader-registry.service';
import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';

interface Relation {
	parentType: string;
	parentId: string;
}

@Injectable()
export class DataSourceService {
	private readonly logger = new Logger(DataSourceService.name);

	constructor(
		@InjectRepository(DataSourceEntity)
		private readonly repository: Repository<DataSourceEntity>,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
		private readonly relationsRegistryService: DataSourceRelationsLoaderRegistryService,
		private readonly nestedCreateBuilders: DataSourceCreateBuilderRegistryService,
		private readonly dataSource: OrmDataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAll<TDataSource extends DataSourceEntity>(relation?: Relation): Promise<TDataSource[]> {
		if (relation) {
			this.logger.debug(
				`[LOOKUP ALL] Fetching all data sources for parentType=${relation.parentType} and parentId=${relation.parentId}`,
			);

			const dataSources = await this.repository
				.createQueryBuilder('dataSource')
				.where('dataSource.parentType = :parentType', { parentType: relation.parentType })
				.andWhere('dataSource.parentId = :parentId', { parentId: relation.parentId })
				.getMany();

			this.logger.debug(
				`[LOOKUP ALL] Found ${dataSources.length} data sources for parentType=${relation.parentType} and parentId=${relation.parentId}`,
			);

			for (const dataSource of dataSources) {
				await this.loadRelations(dataSource);
			}

			return dataSources as TDataSource[];
		}

		this.logger.debug('[LOOKUP ALL] Fetching all data sources');

		const dataSources = await this.repository.find();

		this.logger.debug(`[LOOKUP ALL] Found ${dataSources.length} data sources`);

		for (const dataSource of dataSources) {
			await this.loadRelations(dataSource);
		}

		return dataSources as TDataSource[];
	}

	async findOne<TDataSource extends DataSourceEntity>(id: string, relation?: Relation): Promise<TDataSource | null> {
		let dataSource: DataSourceEntity | null;

		if (relation) {
			this.logger.debug(
				`[LOOKUP] Fetching data source with id=${id} for parentType=${relation.parentType} and parentId=${relation.parentId}`,
			);

			dataSource = await this.repository
				.createQueryBuilder('dataSource')
				.where('dataSource.id = :id', { id })
				.andWhere('dataSource.parentType = :parentType', { parentType: relation.parentType })
				.andWhere('dataSource.parentId = :parentId', { parentId: relation.parentId })
				.getOne();

			if (!dataSource) {
				this.logger.warn(
					`[LOOKUP] Data source with id=${id} for parentType=${relation.parentType} and parentId=${relation.parentId} not found`,
				);

				return null;
			}

			this.logger.debug(
				`[LOOKUP] Successfully fetched data source with id=${id} for parentType=${relation.parentType} and parentId=${relation.parentId}`,
			);
		} else {
			this.logger.debug(`[LOOKUP] Fetching data source with id=${id}`);

			dataSource = await this.repository.findOne({
				where: { id },
			});

			if (!dataSource) {
				this.logger.warn(`[LOOKUP] Data source with id=${id} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched data source with id=${id}`);
		}

		await this.loadRelations(dataSource);

		return dataSource as TDataSource;
	}

	async create<TDataSource extends DataSourceEntity, TCreateDTO extends CreateDataSourceDto>(
		createDto: CreateDataSourceDto,
		relation?: Relation,
	): Promise<TDataSource> {
		this.logger.debug(
			`[CREATE] Creating new data source for parentType=${relation.parentType} and parentId=${relation.parentId}`,
		);

		const { type } = createDto;

		if (!type) {
			this.logger.error('[CREATE] Validation failed: Missing required "type" property in data.');

			throw new DashboardException('The "type" property is required in the data.');
		}

		const mapping = this.dataSourcesMapperService.getMapping<TDataSource, TCreateDTO, any>(type);

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

		const repository: Repository<TDataSource> = this.dataSource.getRepository(mapping.class);

		const dataSource = repository.create(
			plainToInstance(
				mapping.class,
				{ ...dtoInstance, ...parent },
				{
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				},
			),
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

	private async loadRelations(entity: DataSourceEntity): Promise<void> {
		for (const loader of this.relationsRegistryService.getLoaders()) {
			if (loader.supports(entity)) {
				await loader.loadRelations(entity);
			}
		}
	}
}
