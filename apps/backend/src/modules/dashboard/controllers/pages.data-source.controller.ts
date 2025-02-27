import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Header,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UnprocessableEntityException,
} from '@nestjs/common';

import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { DASHBOARD_MODULE_PREFIX } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import { CreateDataSourceDto } from '../dto/create-data-source.dto';
import { ReqCreatePageDataSourceDto } from '../dto/create-page-data-source.dto';
import { ReqUpdateDataSourceDto, UpdateDataSourceDto } from '../dto/update-data-source.dto';
import { DataSourceEntity, PageEntity } from '../entities/dashboard.entity';
import { DataSourceTypeMapping, DataSourcesTypeMapperService } from '../services/data-source-type-mapper.service';
import { DataSourceService } from '../services/data-source.service';
import { PagesService } from '../services/pages.service';

@Controller('pages/:pageId/data-source')
export class PagesDataSourceController {
	private readonly logger = new Logger(PagesDataSourceController.name);

	constructor(
		private readonly pagesService: PagesService,
		private readonly dataSourceService: DataSourceService,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
	) {}

	@Get()
	async findAll(@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string): Promise<DataSourceEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all page data sources for pageId=${pageId}`);

		const page = await this.getPageOrThrow(pageId);

		const dataSources = await this.dataSourceService.findAll({ pageId: page.id });

		this.logger.debug(`[LOOKUP ALL] Retrieved ${dataSources.length} page data sources for pageId=${page.id}`);

		return dataSources;
	}

	@Get(':id')
	async findOne(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<DataSourceEntity> {
		this.logger.debug(`[LOOKUP] Fetching page data source id=${id} for pageId=${pageId}`);

		const page = await this.getPageOrThrow(pageId);

		const dataSource = await this.getOneOrThrow(id, page.id);

		this.logger.debug(`[LOOKUP] Found page data source id=${dataSource.id} for pageId=${page.id}`);

		return dataSource;
	}

	@Post()
	@Header('Location', `:baseUrl/${DASHBOARD_MODULE_PREFIX}/pages/:page/data-source/:id`)
	async create(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Body() createDto: ReqCreatePageDataSourceDto,
	): Promise<DataSourceEntity> {
		this.logger.debug(`[CREATE] Incoming request to create a new page data source for pageId=${pageId}`);

		const page = await this.getPageOrThrow(pageId);

		const type: string | undefined = createDto.data.type;

		if (!type) {
			this.logger.error('[VALIDATION] Missing required field: type');

			throw new BadRequestException([
				JSON.stringify({ field: 'type', reason: 'Page data source property type is required.' }),
			]);
		}

		let mapping: DataSourceTypeMapping<DataSourceEntity, CreateDataSourceDto, UpdateDataSourceDto>;

		try {
			mapping = this.dataSourcesMapperService.getMapping<DataSourceEntity, CreateDataSourceDto, UpdateDataSourceDto>(
				type,
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported page data source type: ${type}`, {
				message: err.message,
				stack: err.stack,
			});

			if (error instanceof DashboardException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported page data source type: ${type}` }),
				]);
			}

			throw error;
		}

		const dtoInstance = plainToInstance(mapping.createDto, createDto.data, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(
				`[VALIDATION FAILED] Validation failed for page data source creation error=${JSON.stringify(errors)}`,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const dataSource = await this.dataSourceService.create(createDto.data, {
				pageId: page.id,
			});

			this.logger.debug(`[CREATE] Successfully created page data source id=${dataSource.id} for pageId=${page.id}`);

			return dataSource;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Page data source could not be created. Please try again later');
			}

			throw error;
		}
	}

	@Patch(':id')
	async update(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateDataSourceDto,
	): Promise<DataSourceEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for page data source id=${id} for pageId=${pageId}`);

		const page = await this.getPageOrThrow(pageId);
		const dataSource = await this.getOneOrThrow(id, page.id);

		let mapping: DataSourceTypeMapping<DataSourceEntity, CreateDataSourceDto, UpdateDataSourceDto>;

		try {
			mapping = this.dataSourcesMapperService.getMapping<DataSourceEntity, CreateDataSourceDto, UpdateDataSourceDto>(
				dataSource.type,
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[ERROR] Unsupported page data source type for update: ${dataSource.type} error=${err.message}`,
				err.stack,
			);

			if (error instanceof DashboardException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported page data source type: ${dataSource.type}` }),
				]);
			}

			throw error;
		}

		const dtoInstance = plainToInstance(mapping.updateDto, updateDto.data, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(
				`[VALIDATION FAILED] Validation failed for page data source modification error=${JSON.stringify(errors)}`,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const updatedDataSource = await this.dataSourceService.update(dataSource.id, updateDto.data);

			this.logger.debug(
				`[UPDATE] Successfully updated page data source id=${updatedDataSource.id} for pageId=${page.id}`,
			);

			return updatedDataSource;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Page data source could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@Delete(':id')
	async remove(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete page data source id=${id} for pageId=${pageId}`);

		const page = await this.getPageOrThrow(pageId);
		const dataSource = await this.getOneOrThrow(id, page.id);

		await this.dataSourceService.remove(dataSource.id);

		this.logger.debug(`[DELETE] Successfully deleted page data source id=${id} for pageId=${page.id}`);
	}

	private async getOneOrThrow(id: string, pageId: string): Promise<DataSourceEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of page data source id=${id} for pageId=${pageId}`);

		const dataSource = await this.dataSourceService.findOne(id, { pageId });

		if (!dataSource) {
			this.logger.error(`[ERROR] Page data source with id=${id} for pageId=${pageId} not found`);

			throw new NotFoundException('Requested page data source does not exist');
		}

		return dataSource;
	}

	private async getPageOrThrow(pageId: string): Promise<PageEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of page id=${pageId}`);

		const page = await this.pagesService.findOne(pageId);

		if (!page) {
			this.logger.error(`[ERROR] Page with id=${pageId} not found`);

			throw new NotFoundException('Requested page does not exist');
		}

		return page;
	}
}
