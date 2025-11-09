import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource as OrmDataSource, Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { DisplaysProfilesService } from '../../system/services/displays-profiles.service';
import { EventType } from '../dashboard.constants';
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
	private readonly logger = new Logger(PagesService.name);

	constructor(
		@InjectRepository(PageEntity)
		private readonly repository: Repository<PageEntity>,
		private readonly dataSourceService: DataSourcesService,
		private readonly pagesMapperService: PagesTypeMapperService,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
		private readonly relationsRegistryService: PageRelationsLoaderRegistryService,
		private readonly nestedCreateBuilders: PageCreateBuilderRegistryService,
		private readonly displaysService: DisplaysProfilesService,
		private readonly dataSource: OrmDataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async getCount<TPage extends PageEntity>(type?: string): Promise<number> {
		const mapping = type ? this.pagesMapperService.getMapping<TPage, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		this.logger.debug('[LOOKUP ALL] Fetching all pages count');

		const pages = await repository.count();

		this.logger.debug(`[LOOKUP ALL] Found that in system is ${pages} pages`);

		return pages;
	}

	async findAll<TPage extends PageEntity>(type?: string): Promise<TPage[]> {
		const mapping = type ? this.pagesMapperService.getMapping<TPage, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		this.logger.debug('[LOOKUP ALL] Fetching all pages');

		const pages = await repository.find({
			relations: ['display'],
		});

		this.logger.debug(`[LOOKUP ALL] Found ${pages.length} pages`);

		for (const page of pages) {
			await this.loadRelations(page);
		}

		return pages as TPage[];
	}

	async findOne<TPage extends PageEntity>(id: string, type?: string): Promise<TPage | null> {
		const mapping = type ? this.pagesMapperService.getMapping<TPage, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		this.logger.debug(`[LOOKUP] Fetching page with id=${id}`);

		const page = (await repository
			.createQueryBuilder('page')
			.leftJoinAndSelect('page.display', 'display')
			.where('page.id = :id', { id })
			.getOne()) as TPage | null;

		if (!page) {
			this.logger.debug(`[LOOKUP] Page with id=${id} not found`);

			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched page with id=${id}`);

		await this.loadRelations(page);

		return page;
	}

	async create<TPage extends PageEntity, TCreateDTO extends CreatePageDto>(createDto: CreatePageDto): Promise<TPage> {
		this.logger.debug('[CREATE] Creating new page');

		const { type } = createDto;

		if (!type) {
			this.logger.error('[CREATE] Validation failed: Missing required "type" property in data.');

			throw new DashboardException('The "type" property is required in the data.');
		}

		const mapping = this.pagesMapperService.getMapping<TPage, TCreateDTO, any>(type);

		const dtoInstance = await this.validateDto<TCreateDTO>(mapping.createDto, createDto);

		if (dtoInstance.display) {
			const display = await this.displaysService.findOne(dtoInstance.display);

			if (display === null) {
				this.logger.error(`[VALIDATION FAILED] Page display with id ${dtoInstance.display} is not found`);

				throw new DashboardValidationException('Provided page display identifier is invalid.');
			}
		} else {
			const display = await this.displaysService.findPrimary();

			if (display === null) {
				this.logger.error(`[VALIDATION FAILED] Primary display is missing in system`);

				throw new DashboardValidationException('Primary display is not configured.');
			}

			dtoInstance.display = display.id;
		}

		const repository: Repository<TPage> = this.dataSource.getRepository(mapping.class);

		const page = toInstance(mapping.class, dtoInstance);

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

		this.logger.debug(`[CREATE] Successfully created page with id=${savedPage.id}`);

		this.eventEmitter.emit(EventType.PAGE_CREATED, savedPage);

		return savedPage;
	}

	async update<TPage extends PageEntity, TUpdateDTO extends UpdatePageDto>(
		id: string,
		updateDto: UpdatePageDto,
	): Promise<TPage> {
		this.logger.debug(`[UPDATE] Updating page with id=${id}`);

		const page = await this.getOneOrThrow<TPage>(id);

		const mapping = this.pagesMapperService.getMapping<TPage, any, TUpdateDTO>(page.type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

		if (dtoInstance.display) {
			const display = await this.displaysService.findOne(dtoInstance.display);

			if (display === null) {
				this.logger.error(`[VALIDATION FAILED] Page display with id ${dtoInstance.display} is not found`);

				throw new DashboardValidationException('Provided page display identifier is invalid.');
			}
		}

		const repository: Repository<TPage> = this.dataSource.getRepository(mapping.class);

		Object.assign(page, omitBy(toInstance(mapping.class, dtoInstance), isUndefined));

		await repository.save(page);

		const updatedPage = await this.getOneOrThrow<TPage>(page.id);

		this.logger.debug(`[UPDATE] Successfully updated page with id=${updatedPage.id}`);

		this.eventEmitter.emit(EventType.PAGE_UPDATED, updatedPage);

		return updatedPage;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing page with id=${id}`);

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

			this.logger.log(`[DELETE] Successfully removed page with id=${id}`);

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
