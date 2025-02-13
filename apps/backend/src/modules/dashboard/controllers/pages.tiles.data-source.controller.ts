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
import { DashboardModulePrefix } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import { CreateDataSourceDto } from '../dto/create-data-source.dto';
import { ReqCreateTileDataSourceDto } from '../dto/create-tile-data-source.dto';
import { ReqUpdateDataSourceDto, UpdateDataSourceDto } from '../dto/update-data-source.dto';
import { DataSourceEntity, PageEntity, TileEntity } from '../entities/dashboard.entity';
import { DataSourceTypeMapping, DataSourcesTypeMapperService } from '../services/data-source-type-mapper.service';
import { DataSourceService } from '../services/data-source.service';
import { PagesService } from '../services/pages.service';
import { TilesService } from '../services/tiles.service';

@Controller('pages/:pageId/tiles/:tileId/data-source')
export class PagesTilesDataSourceController {
	private readonly logger = new Logger(PagesTilesDataSourceController.name);

	constructor(
		private readonly pagesService: PagesService,
		private readonly tilesService: TilesService,
		private readonly dataSourceService: DataSourceService,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
	) {}

	@Get()
	async findAll(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('tileId', new ParseUUIDPipe({ version: '4' })) tileId: string,
	): Promise<DataSourceEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all tile data sources for pageId=${pageId} tileId=${tileId}`);

		const page = await this.getPageOrThrow(pageId);
		const tile = await this.getTileOrThrow(tileId, page.id);

		const dataSources = await this.dataSourceService.findAll({ tileId: tile.id });

		this.logger.debug(
			`[LOOKUP ALL] Retrieved ${dataSources.length} tile data sources for pageId=${page.id} tileId=${tile.id}`,
		);

		return dataSources;
	}

	@Get(':id')
	async findOne(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('tileId', new ParseUUIDPipe({ version: '4' })) tileId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<DataSourceEntity> {
		this.logger.debug(`[LOOKUP] Fetching tile data source id=${id} for pageId=${pageId} tileId=${tileId}`);

		const page = await this.getPageOrThrow(pageId);
		const tile = await this.getTileOrThrow(tileId, page.id);

		const dataSource = await this.getOneOrThrow(id, tile.id);

		this.logger.debug(`[LOOKUP] Found tile data source id=${dataSource.id} for pageId=${page.id} tileId=${tile.id}`);

		return dataSource;
	}

	@Post()
	@Header('Location', `:baseUrl/${DashboardModulePrefix}/pages/:page/tiles/:tile/data-source/:id`)
	async create(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('tileId', new ParseUUIDPipe({ version: '4' })) tileId: string,
		@Body() createDto: ReqCreateTileDataSourceDto,
	): Promise<DataSourceEntity> {
		this.logger.debug(
			`[CREATE] Incoming request to create a new tile data source for pageId=${pageId} tileId=${tileId}`,
		);

		const page = await this.getPageOrThrow(pageId);
		const tile = await this.getTileOrThrow(tileId, page.id);

		const type: string | undefined = createDto.data.type;

		if (!type) {
			this.logger.error('[VALIDATION] Missing required field: type');

			throw new BadRequestException([
				JSON.stringify({ field: 'type', reason: 'Tile data source property type is required.' }),
			]);
		}

		let mapping: DataSourceTypeMapping<DataSourceEntity, CreateDataSourceDto, UpdateDataSourceDto>;

		try {
			mapping = this.dataSourcesMapperService.getMapping<DataSourceEntity, CreateDataSourceDto, UpdateDataSourceDto>(
				type,
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported tile data source type: ${type}`, {
				message: err.message,
				stack: err.stack,
			});

			if (error instanceof DashboardException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported tile data source type: ${type}` }),
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
				`[VALIDATION FAILED] Validation failed for tile data source creation error=${JSON.stringify(errors)}`,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const dataSource = await this.dataSourceService.create(createDto.data, {
				tileId: tile.id,
			});

			this.logger.debug(
				`[CREATE] Successfully created tile data source id=${dataSource.id} for pageId=${page.id} tileId=${tile.id}`,
			);

			return dataSource;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Tile data source could not be created. Please try again later');
			}

			throw error;
		}
	}

	@Patch(':id')
	async update(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('tileId', new ParseUUIDPipe({ version: '4' })) tileId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateDataSourceDto,
	): Promise<DataSourceEntity> {
		this.logger.debug(
			`[UPDATE] Incoming update request for data source id=${id} for pageId=${pageId} tileId=${tileId}`,
		);

		const page = await this.getPageOrThrow(pageId);
		const tile = await this.getTileOrThrow(tileId, page.id);
		const dataSource = await this.getOneOrThrow(id, tile.id);

		let mapping: DataSourceTypeMapping<DataSourceEntity, CreateDataSourceDto, UpdateDataSourceDto>;

		try {
			mapping = this.dataSourcesMapperService.getMapping<DataSourceEntity, CreateDataSourceDto, UpdateDataSourceDto>(
				dataSource.type,
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[ERROR] Unsupported tile data source type for update: ${dataSource.type} error=${err.message}`,
				err.stack,
			);

			if (error instanceof DashboardException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported tile data source type: ${dataSource.type}` }),
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
				`[VALIDATION FAILED] Validation failed for tile data source modification error=${JSON.stringify(errors)}`,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const updatedDataSource = await this.dataSourceService.update(dataSource.id, updateDto.data);

			this.logger.debug(
				`[UPDATE] Successfully updated tile data source id=${updatedDataSource.id} for pageId=${page.id} tileId=${tile.id}`,
			);

			return updatedDataSource;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Tile data source could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@Delete(':id')
	async remove(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('tileId', new ParseUUIDPipe({ version: '4' })) tileId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete data source id=${id} for pageId=${pageId} tileId=${tileId}`);

		const page = await this.getPageOrThrow(pageId);
		const tile = await this.getTileOrThrow(tileId, page.id);
		const dataSource = await this.getOneOrThrow(id, tile.id);

		await this.dataSourceService.remove(dataSource.id);

		this.logger.debug(
			`[DELETE] Successfully deleted tile data source id=${id} for pageId=${page.id} tileId=${tile.id}`,
		);
	}

	private async getOneOrThrow(id: string, tileId: string): Promise<DataSourceEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of tile data source id=${id} for tileId=${tileId}`);

		const dataSource = await this.dataSourceService.findOne(id, { tileId });

		if (!dataSource) {
			this.logger.error(`[ERROR] Tile data source with id=${id} for tileId=${tileId} not found`);

			throw new NotFoundException('Requested tile data source does not exist');
		}

		return dataSource;
	}

	private async getTileOrThrow(tileId: string, pageId: string): Promise<TileEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of page tile id=${tileId} for pageId=${pageId}`);

		const tile = await this.tilesService.findOne(tileId, { pageId });

		if (!tile) {
			this.logger.error(`[ERROR] Page tile with id=${tileId} for pageId=${pageId} not found`);

			throw new NotFoundException('Requested page tile does not exist');
		}

		return tile;
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
