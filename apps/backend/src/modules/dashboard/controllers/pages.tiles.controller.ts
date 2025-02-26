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
import { ReqCreatePageTileDto } from '../dto/create-page-tile.dto';
import { CreateTileDto } from '../dto/create-tile.dto';
import { ReqUpdateTileDto, UpdateTileDto } from '../dto/update-tile.dto';
import { PageEntity, TileEntity } from '../entities/dashboard.entity';
import { PagesService } from '../services/pages.service';
import { TileTypeMapping, TilesTypeMapperService } from '../services/tiles-type-mapper.service';
import { TilesService } from '../services/tiles.service';

@Controller('pages/:pageId/tiles')
export class PagesTilesController {
	private readonly logger = new Logger(PagesTilesController.name);

	constructor(
		private readonly pagesService: PagesService,
		private readonly tilesService: TilesService,
		private readonly tilesMapperService: TilesTypeMapperService,
	) {}

	@Get()
	async findAll(@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string): Promise<TileEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all page tiles for pageId=${pageId}`);

		const page = await this.getPageOrThrow(pageId);

		const tiles = await this.tilesService.findAll({ pageId: page.id });

		this.logger.debug(`[LOOKUP ALL] Retrieved ${tiles.length} page tiles for pageId=${page.id}`);

		return tiles;
	}

	@Get(':id')
	async findOne(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<TileEntity> {
		this.logger.debug(`[LOOKUP] Fetching page tile id=${id} for pageId=${pageId}`);

		const page = await this.getPageOrThrow(pageId);

		const tile = await this.getOneOrThrow(id, page.id);

		this.logger.debug(`[LOOKUP] Found page tile id=${tile.id} for pageId=${page.id}`);

		return tile;
	}

	@Post()
	@Header('Location', `:baseUrl/${DASHBOARD_MODULE_PREFIX}/pages/:page/tiles/:id`)
	async create(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Body() createDto: ReqCreatePageTileDto,
	): Promise<TileEntity> {
		this.logger.debug(`[CREATE] Incoming request to create a new page tile for pageId=${pageId}`);

		const page = await this.getPageOrThrow(pageId);

		const type: string | undefined = createDto.data.type;

		if (!type) {
			this.logger.error('[VALIDATION] Missing required field: type');

			throw new BadRequestException([
				JSON.stringify({ field: 'type', reason: 'Page tile property type is required.' }),
			]);
		}

		let mapping: TileTypeMapping<TileEntity, CreateTileDto, UpdateTileDto>;

		try {
			mapping = this.tilesMapperService.getMapping<TileEntity, CreateTileDto, UpdateTileDto>(type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported page tile type: ${type}`, { message: err.message, stack: err.stack });

			if (error instanceof DashboardException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported page tile type: ${type}` }),
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
			this.logger.error(`[VALIDATION FAILED] Validation failed for page tile creation error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const tile = await this.tilesService.create(createDto.data, { pageId: page.id });

			this.logger.debug(`[CREATE] Successfully created page tile id=${tile.id} for pageId=${page.id}`);

			return tile;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Page tile could not be created. Please try again later');
			}

			throw error;
		}
	}

	@Patch(':id')
	async update(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateTileDto,
	): Promise<TileEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for page tile id=${id} for pageId=${pageId}`);

		const page = await this.getPageOrThrow(pageId);
		const tile = await this.getOneOrThrow(id, page.id);

		let mapping: TileTypeMapping<TileEntity, CreateTileDto, UpdateTileDto>;

		try {
			mapping = this.tilesMapperService.getMapping<TileEntity, CreateTileDto, UpdateTileDto>(tile.type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported page tile type for update: ${tile.type}`, {
				message: err.message,
				stack: err.stack,
			});

			if (error instanceof DashboardException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported page tile type: ${tile.type}` }),
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
				`[VALIDATION FAILED] Validation failed for page tile modification error=${JSON.stringify(errors)}`,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const updatedTile = await this.tilesService.update(tile.id, updateDto.data);

			this.logger.debug(`[UPDATE] Successfully updated page tile id=${updatedTile.id} for pageId=${page.id}`);

			return updatedTile;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Page tile could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@Delete(':id')
	async remove(
		@Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete page tile id=${id} for pageId=${pageId}`);

		const page = await this.getPageOrThrow(pageId);
		const tile = await this.getOneOrThrow(id, page.id);

		await this.tilesService.remove(tile.id);

		this.logger.debug(`[DELETE] Successfully deleted page tile id=${id} for pageId=${page.id}`);
	}

	private async getOneOrThrow(id: string, pageId: string): Promise<TileEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of page tile id=${id} for pageId=${pageId}`);

		const tile = await this.tilesService.findOne(id, { pageId });

		if (!tile) {
			this.logger.error(`[ERROR] Page tile with id=${id} for pageId=${pageId} not found`);

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
