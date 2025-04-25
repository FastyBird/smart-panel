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
	Query,
	UnprocessableEntityException,
} from '@nestjs/common';

import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { DASHBOARD_MODULE_PREFIX } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import { CreateSingleTileDto, CreateTileDto } from '../dto/create-tile.dto';
import { UpdateSingleTileDto, UpdateTileDto } from '../dto/update-tile.dto';
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
	async findAll(
		@Query('parent_type') parentType?: string,
		@Query('parent_id') parentId?: string,
	): Promise<TileEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all tiles`);

		const tiles = await this.tilesService.findAll(
			parentType && parentId
				? {
						parentType,
						parentId,
					}
				: undefined,
		);

		this.logger.debug(`[LOOKUP ALL] Retrieved ${tiles.length} tiles`);

		return tiles;
	}

	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<TileEntity> {
		this.logger.debug(`[LOOKUP] Fetching tile id=${id}`);

		const tile = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found tile id=${tile.id}`);

		return tile;
	}

	@Post()
	@Header('Location', `:baseUrl/${DASHBOARD_MODULE_PREFIX}/tiles/:id`)
	async create(@Body() createDto: { data: object }): Promise<TileEntity> {
		this.logger.debug(`[CREATE] Incoming request to create a new tile`);

		const type: string | undefined =
			'type' in createDto.data && typeof createDto.data.type === 'string' ? createDto.data.type : undefined;

		if (!type) {
			this.logger.error('[VALIDATION] Missing required field: type');

			throw new BadRequestException([JSON.stringify({ field: 'type', reason: 'Tile property type is required.' })]);
		}

		const baseDtoInstance = plainToInstance(CreateSingleTileDto, createDto.data, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const baseErrors = await validate(baseDtoInstance, {
			whitelist: true,
		});

		if (baseErrors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for tile creation error=${JSON.stringify(baseErrors)}`);

			throw ValidationExceptionFactory.createException(baseErrors);
		}

		let mapping: TileTypeMapping<TileEntity, CreateTileDto, UpdateTileDto>;

		try {
			mapping = this.tilesMapperService.getMapping<TileEntity, CreateTileDto, UpdateTileDto>(type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported tile type: ${type}`, { message: err.message, stack: err.stack });

			if (error instanceof DashboardException) {
				throw new BadRequestException([JSON.stringify({ field: 'type', reason: `Unsupported tile type: ${type}` })]);
			}

			throw error;
		}

		const { parent } = baseDtoInstance;

		const dtoInstance = plainToInstance(mapping.createDto, createDto.data, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
			excludeExtraneousValues: true,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for tile creation error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const tile = await this.tilesService.create(dtoInstance, {
				parentType: parent.type,
				parentId: parent.id,
			});

			this.logger.debug(`[CREATE] Successfully created tile id=${tile.id}`);

			return tile;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Tile could not be created. Please try again later');
			}

			throw error;
		}
	}

	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: { data: object },
	): Promise<TileEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for tile id=${id}`);

		const tile = await this.getOneOrThrow(id);

		const baseDtoInstance = plainToInstance(UpdateSingleTileDto, updateDto.data, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const baseErrors = await validate(baseDtoInstance, {
			whitelist: true,
		});

		if (baseErrors.length > 0) {
			this.logger.error(
				`[VALIDATION FAILED] Validation failed for tile modification error=${JSON.stringify(baseErrors)}`,
			);

			throw ValidationExceptionFactory.createException(baseErrors);
		}

		let mapping: TileTypeMapping<TileEntity, CreateTileDto, UpdateTileDto>;

		try {
			mapping = this.tilesMapperService.getMapping<TileEntity, CreateTileDto, UpdateTileDto>(tile.type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported tile type for update: ${tile.type}`, {
				message: err.message,
				stack: err.stack,
			});

			if (error instanceof DashboardException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported tile type: ${tile.type}` }),
				]);
			}

			throw error;
		}

		const dtoInstance = plainToInstance(mapping.updateDto, updateDto.data, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
			excludeExtraneousValues: true,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for tile modification error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const updatedTile = await this.tilesService.update(tile.id, dtoInstance);

			this.logger.debug(`[UPDATE] Successfully updated tile id=${updatedTile.id}`);

			return updatedTile;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Tile could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@Delete(':id')
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete tile id=${id}`);

		const tile = await this.getOneOrThrow(id);

		await this.tilesService.remove(tile.id);

		this.logger.debug(`[DELETE] Successfully deleted tile id=${id}`);
	}

	private async getOneOrThrow(id: string): Promise<TileEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of tile id=${id}`);

		const tile = await this.tilesService.findOne(id);

		if (!tile) {
			this.logger.error(`[ERROR] Tile with id=${id} not found`);

			throw new NotFoundException('Requested tile does not exist');
		}

		return tile;
	}
}
