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
import { CreateTileDto, ReqCreateTileDto } from '../dto/create-tile.dto';
import { ReqUpdateTileDto, UpdateTileDto } from '../dto/update-tile.dto';
import { TileEntity } from '../entities/dashboard.entity';
import { TileTypeMapping, TilesTypeMapperService } from '../services/tiles-type-mapper.service';
import { TilesService } from '../services/tiles.service';

@Controller('tiles')
export class TilesController {
	private readonly logger = new Logger(TilesController.name);

	constructor(
		private readonly tilesService: TilesService,
		private readonly tilesMapperService: TilesTypeMapperService,
	) {}

	@Get()
	async findAll(): Promise<TileEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all page tiles`);

		const tiles = await this.tilesService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${tiles.length} page tiles`);

		return tiles;
	}

	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<TileEntity> {
		this.logger.debug(`[LOOKUP] Fetching page tile id=${id}`);

		const tile = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found page tile id=${tile.id}`);

		return tile;
	}

	@Post()
	@Header('Location', `:baseUrl/${DASHBOARD_MODULE_PREFIX}/pages/:page/tiles/:id`)
	async create(@Body() createDto: ReqCreateTileDto): Promise<TileEntity> {
		this.logger.debug(`[CREATE] Incoming request to create a new page tile`);

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
			const tile = await this.tilesService.create(createDto.data);

			this.logger.debug(`[CREATE] Successfully created page tile id=${tile.id}`);

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
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateTileDto,
	): Promise<TileEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for page tile id=${id}`);

		const tile = await this.getOneOrThrow(id);

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

			this.logger.debug(`[UPDATE] Successfully updated page tile id=${updatedTile.id}`);

			return updatedTile;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Page tile could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@Delete(':id')
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete page tile id=${id}`);

		const tile = await this.getOneOrThrow(id);

		await this.tilesService.remove(tile.id);

		this.logger.debug(`[DELETE] Successfully deleted page tile id=${id}`);
	}

	private async getOneOrThrow(id: string): Promise<TileEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of page tile id=${id}`);

		const tile = await this.tilesService.findOne(id);

		if (!tile) {
			this.logger.error(`[ERROR] Page tile with id=${id} not found`);

			throw new NotFoundException('Requested page tile does not exist');
		}

		return tile;
	}
}
