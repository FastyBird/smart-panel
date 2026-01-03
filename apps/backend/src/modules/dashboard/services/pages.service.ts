import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource as OrmDataSource, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { DisplaysService } from '../../displays/services/displays.service';
import { DASHBOARD_MODULE_NAME, EventType } from '../dashboard.constants';
import { DashboardException, DashboardNotFoundException, DashboardValidationException } from '../dashboard.exceptions';
import { CreateDataSourceDto } from '../dto/create-data-source.dto';
import { CreatePageDto } from '../dto/create-page.dto';
import { UpdatePageDto } from '../dto/update-page.dto';
import { DataSourceEntity, PageEntity } from '../entities/dashboard.entity';

import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';
import { DataSourcesService } from './data-sources.service';
import { PageCreateBuilderRegistryService } from './page-create-builder-registry.service';
import { PageRelationsLoaderRegistryService } from './page-relations-loader-registry.service';
import { PagesTypeMapperService } from './pages-type-mapper.service';

@Injectable()
export class PagesService {
	private readonly logger = createExtensionLogger(DASHBOARD_MODULE_NAME, 'PagesService');

	constructor(
		@InjectRepository(PageEntity)
		private readonly repository: Repository<PageEntity>,
		private readonly dataSourceService: DataSourcesService,
		private readonly pagesMapperService: PagesTypeMapperService,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
		private readonly relationsRegistryService: PageRelationsLoaderRegistryService,
		private readonly nestedCreateBuilders: PageCreateBuilderRegistryService,
		private readonly displaysService: DisplaysService,
		private readonly dataSource: OrmDataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async getCount<TPage extends PageEntity>(type?: string): Promise<number> {
		const mapping = type ? this.pagesMapperService.getMapping<TPage, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		return repository.count();
	}

	async findAll<TPage extends PageEntity>(type?: string): Promise<TPage[]> {
		const mapping = type ? this.pagesMapperService.getMapping<TPage, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		const pages = await repository.find({
			relations: ['displays'],
		});

		for (const page of pages) {
			await this.loadRelations(page);
		}

		return pages as TPage[];
	}

	async findOne<TPage extends PageEntity>(id: string, type?: string): Promise<TPage | null> {
		const mapping = type ? this.pagesMapperService.getMapping<TPage, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		const page = (await repository
			.createQueryBuilder('page')
			.leftJoinAndSelect('page.displays', 'displays')
			.where('page.id = :id', { id })
			.getOne()) as TPage | null;

		if (!page) {
			return null;
		}

		await this.loadRelations(page);

		return page;
	}

	async create<TPage extends PageEntity, TCreateDTO extends CreatePageDto>(createDto: CreatePageDto): Promise<TPage> {
		this.logger.debug('Creating new page');

		const { type } = createDto;

		if (!type) {
			this.logger.error('Validation failed: Missing required "type" property in data.');

			throw new DashboardException('The "type" property is required in the data.');
		}

		const mapping = this.pagesMapperService.getMapping<TPage, TCreateDTO, any>(type);

		const dtoInstance = await this.validateDto<TCreateDTO>(mapping.createDto, createDto);

		// Handle display assignments: validate all display IDs exist
		if (dtoInstance.displays && dtoInstance.displays.length > 0) {
			const displays = await Promise.all(
				dtoInstance.displays.map((displayId) => this.displaysService.findOne(displayId)),
			);

			const invalidDisplays = displays
				.map((display, index) => (display === null ? dtoInstance.displays[index] : null))
				.filter((id): id is string => id !== null);

			if (invalidDisplays.length > 0) {
				this.logger.error(`[VALIDATION FAILED] Page displays with ids ${invalidDisplays.join(', ')} are not found`);

				throw new DashboardValidationException('One or more provided page display identifiers are invalid.');
			}
		}

		const repository: Repository<TPage> = this.dataSource.getRepository(mapping.class);

		const page = toInstance(mapping.class, dtoInstance);

		// Set displays relation: empty array or null means visible to all displays
		if (dtoInstance.displays !== undefined && dtoInstance.displays !== null) {
			if (dtoInstance.displays.length === 0) {
				page.displays = [];
			} else {
				const displayEntities = await Promise.all(
					dtoInstance.displays.map((displayId) => this.displaysService.getOneOrThrow(displayId)),
				);
				page.displays = displayEntities;
			}
		} else {
			// If not provided or null, default to empty array (visible to all)
			page.displays = [];
		}

		for (const builder of this.nestedCreateBuilders.getBuilders()) {
			if (builder.supports(dtoInstance)) {
				await builder.build(dtoInstance, page);
			}
		}

		page['dataSource'] = (dtoInstance.data_source || []).map((createDataSourceDto: CreateDataSourceDto) => {
			const dataSourceMapping = this.dataSourcesMapperService.getMapping(createDataSourceDto.type);

			const dataSourceRepository: Repository<DataSourceEntity> = this.dataSource.getRepository(dataSourceMapping.class);

			return dataSourceRepository.create(
				toInstance(dataSourceMapping.class, { ...createDataSourceDto, parentType: 'page', parentId: page.id }),
			);
		});

		const created = repository.create(page);

		// Save the page
		await repository.save(created);

		// Retrieve the saved page with its full relations
		const savedPage = await this.getOneOrThrow<TPage>(created.id);

		this.logger.debug(`Successfully created page with id=${savedPage.id}`);

		this.eventEmitter.emit(EventType.PAGE_CREATED, savedPage);

		return savedPage;
	}

	async update<TPage extends PageEntity, TUpdateDTO extends UpdatePageDto>(
		id: string,
		updateDto: UpdatePageDto,
	): Promise<TPage> {
		const page = await this.getOneOrThrow<TPage>(id);

		const mapping = this.pagesMapperService.getMapping<TPage, any, TUpdateDTO>(page.type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

		// Handle display assignments if provided
		if (dtoInstance.displays !== undefined && dtoInstance.displays !== null) {
			if (dtoInstance.displays.length > 0) {
				// Validate all display IDs exist
				const displays = await Promise.all(
					dtoInstance.displays.map((displayId) => this.displaysService.findOne(displayId)),
				);

				const invalidDisplays = displays
					.map((display, index) => (display === null ? dtoInstance.displays[index] : null))
					.filter((id): id is string => id !== null);

				if (invalidDisplays.length > 0) {
					this.logger.error(`[VALIDATION FAILED] Page displays with ids ${invalidDisplays.join(', ')} are not found`);

					throw new DashboardValidationException('One or more provided page display identifiers are invalid.');
				}

				// Set the displays relation
				const displayEntities = await Promise.all(
					dtoInstance.displays.map((displayId) => this.displaysService.getOneOrThrow(displayId)),
				);
				page.displays = displayEntities;
			} else {
				// Empty array means visible to all displays
				page.displays = [];
			}
		} else if (dtoInstance.displays !== undefined) {
			page.displays = [];
		}
		// If displays is not provided in DTO or is null, keep existing assignments

		const repository: Repository<TPage> = this.dataSource.getRepository(mapping.class);

		// Remove displays from the DTO before assigning other fields (we handle it separately above)
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { displays: _displays, ...dtoWithoutDisplays } = dtoInstance;
		const dtoInstanceWithoutDisplays = omitBy(toInstance(mapping.class, dtoWithoutDisplays), isUndefined);
		// Explicitly exclude displays from being overwritten if not provided in DTO
		delete dtoInstanceWithoutDisplays.displays;
		Object.assign(page, dtoInstanceWithoutDisplays);

		await repository.save(page);

		const updatedPage = await this.getOneOrThrow<TPage>(page.id);

		this.eventEmitter.emit(EventType.PAGE_UPDATED, updatedPage);

		return updatedPage;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`Removing page with id=${id}`);

		const fullPage = await this.getOneOrThrow<PageEntity>(id);

		await this.dataSource.transaction(async (manager) => {
			const page = await manager.findOneOrFail<PageEntity>(PageEntity, { where: { id } });

			const dataSources = await manager.find<DataSourceEntity>(DataSourceEntity, {
				where: { parentType: 'page', parentId: page.id },
			});

			for (const dataSource of dataSources) {
				await this.dataSourceService.remove(dataSource.id, manager);
			}

			await manager.remove(page);

			this.logger.log(`Successfully removed page with id=${id}`);

			this.eventEmitter.emit(EventType.PAGE_DELETED, fullPage);
		});
	}

	async getOneOrThrow<TPage extends PageEntity>(id: string): Promise<TPage> {
		const page = await this.findOne<TPage>(id);

		if (!page) {
			this.logger.error(`[ERROR] Page with id=${id} not found`);

			throw new DashboardNotFoundException('Requested page does not exist');
		}

		return page;
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

			throw new DashboardValidationException('Provided page data are invalid.');
		}

		return dtoInstance;
	}

	private async loadRelations(entity: PageEntity): Promise<void> {
		entity.dataSource = await this.dataSourceService.findAll({
			parentType: 'page',
			parentId: entity.id,
		});

		for (const loader of this.relationsRegistryService.getLoaders()) {
			if (loader.supports(entity)) {
				await loader.loadRelations(entity);
			}
		}
	}
}
