import { validate } from 'class-validator';

import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiExtraModels, ApiNoContentResponse, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessArrayResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../common/decorators/api-documentation.decorator';
import { ApiTag } from '../../../common/decorators/api-tag.decorator';
import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
// Import plugin tile DTOs and entities for OpenAPI schema generation
import { CreateDevicePreviewTileDto } from '../../../plugins/tiles-device-preview/dto/create-tile.dto';
import { UpdateDevicePreviewTileDto } from '../../../plugins/tiles-device-preview/dto/update-tile.dto';
import { DevicePreviewTileEntity } from '../../../plugins/tiles-device-preview/entities/tiles-device-preview.entity';
import { CreateTimeTileDto } from '../../../plugins/tiles-time/dto/create-tile.dto';
import { UpdateTimeTileDto } from '../../../plugins/tiles-time/dto/update-tile.dto';
import { TimeTileEntity } from '../../../plugins/tiles-time/entities/tiles-time.entity';
import {
	CreateDayWeatherTileDto,
	CreateForecastWeatherTileDto,
} from '../../../plugins/tiles-weather/dto/create-tile.dto';
import {
	UpdateDayWeatherTileDto,
	UpdateForecastWeatherTileDto,
} from '../../../plugins/tiles-weather/dto/update-tile.dto';
import {
	DayWeatherTileEntity,
	ForecastWeatherTileEntity,
} from '../../../plugins/tiles-weather/entities/tiles-weather.entity';
import {
	DASHBOARD_MODULE_API_TAG_DESCRIPTION,
	DASHBOARD_MODULE_API_TAG_NAME,
	DASHBOARD_MODULE_NAME,
	DASHBOARD_MODULE_PREFIX,
} from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import {
	CreateSingleTileDto,
	CreateTileDto,
	ReqCreateTileDto,
	ReqCreateTileWithParentDto,
} from '../dto/create-tile.dto';
import {
	ReqUpdateTileDto,
	ReqUpdateTileWithParentDto,
	UpdateSingleTileDto,
	UpdateTileDto,
} from '../dto/update-tile.dto';
import { TileEntity } from '../entities/dashboard.entity';
import { TileResponseModel, TilesResponseModel } from '../models/dashboard-response.model';
import { TileTypeMapping, TilesTypeMapperService } from '../services/tiles-type-mapper.service';
import { TilesService } from '../services/tiles.service';

@ApiTag({
	tagName: DASHBOARD_MODULE_NAME,
	displayName: DASHBOARD_MODULE_API_TAG_NAME,
	description: DASHBOARD_MODULE_API_TAG_DESCRIPTION,
})
@ApiExtraModels(
	TileResponseModel,
	TilesResponseModel,
	CreateTileDto,
	UpdateTileDto,
	ReqCreateTileWithParentDto,
	ReqUpdateTileDto,
	// TilesDevicePreviewPlugin
	CreateDevicePreviewTileDto,
	UpdateDevicePreviewTileDto,
	DevicePreviewTileEntity,
	// TilesTimePlugin
	CreateTimeTileDto,
	UpdateTimeTileDto,
	TimeTileEntity,
	// TilesWeatherPlugin
	CreateDayWeatherTileDto,
	CreateForecastWeatherTileDto,
	UpdateDayWeatherTileDto,
	UpdateForecastWeatherTileDto,
	DayWeatherTileEntity,
	ForecastWeatherTileEntity,
)
@Controller('tiles')
export class TilesController {
	private readonly logger = new Logger(TilesController.name);

	constructor(
		private readonly tilesService: TilesService,
		private readonly tilesMapperService: TilesTypeMapperService,
	) {}

	@Get()
	@ApiOperation({ summary: 'Retrieve all tiles' })
	@ApiQuery({ name: 'parent_type', type: 'string', required: false, description: 'Filter by parent entity type' })
	@ApiQuery({
		name: 'parent_id',
		type: 'string',
		format: 'uuid',
		required: false,
		description: 'Filter by parent entity ID',
	})
	@ApiSuccessArrayResponse(TileEntity)
	@ApiInternalServerErrorResponse('Internal server error')
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
	@ApiOperation({ summary: 'Retrieve a specific tile by ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Tile ID' })
	@ApiSuccessResponse(TileEntity)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Tile not found')
	@ApiInternalServerErrorResponse('Internal server error')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<TileEntity> {
		this.logger.debug(`[LOOKUP] Fetching tile id=${id}`);

		const tile = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found tile id=${tile.id}`);

		return tile;
	}

	@Post()
	@Header('Location', `:baseUrl/${DASHBOARD_MODULE_PREFIX}/tiles/:id`)
	@ApiOperation({ summary: 'Create a new tile' })
	@ApiBody({ type: ReqCreateTileDto })
	@ApiCreatedSuccessResponse(TileEntity)
	@ApiBadRequestResponse('Invalid request data or unsupported tile type')
	@ApiUnprocessableEntityResponse('Tile could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	async create(@Body() createDto: { data: object }): Promise<TileEntity> {
		this.logger.debug(`[CREATE] Incoming request to create a new tile`);

		const type: string | undefined =
			'type' in createDto.data && typeof createDto.data.type === 'string' ? createDto.data.type : undefined;

		if (!type) {
			this.logger.error('[VALIDATION] Missing required field: type');

			throw new BadRequestException([JSON.stringify({ field: 'type', reason: 'Tile property type is required.' })]);
		}

		const baseDtoInstance = toInstance(CreateSingleTileDto, createDto.data, {
			excludeExtraneousValues: false,
		});

		const baseErrors = await validate(baseDtoInstance, {
			whitelist: true,
			stopAtFirstError: false,
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

		const dtoInstance = toInstance(mapping.createDto, createDto.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
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
	@ApiOperation({ summary: 'Update an existing tile' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Tile ID' })
	@ApiBody({ type: ReqUpdateTileWithParentDto })
	@ApiSuccessResponse(TileEntity)
	@ApiBadRequestResponse('Invalid UUID format, request data, or unsupported tile type')
	@ApiNotFoundResponse('Tile not found')
	@ApiUnprocessableEntityResponse('Tile could not be updated')
	@ApiInternalServerErrorResponse('Internal server error')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: { data: object },
	): Promise<TileEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for tile id=${id}`);

		const tile = await this.getOneOrThrow(id);

		const baseDtoInstance = toInstance(UpdateSingleTileDto, updateDto.data, {
			excludeExtraneousValues: false,
		});

		const baseErrors = await validate(baseDtoInstance, {
			whitelist: true,
			stopAtFirstError: false,
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

		const dtoInstance = toInstance(mapping.updateDto, updateDto.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
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
	@HttpCode(204)
	@ApiOperation({ summary: 'Delete a tile' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Tile ID' })
	@ApiNoContentResponse({ description: 'Tile deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Tile not found')
	@ApiInternalServerErrorResponse('Internal server error')
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
