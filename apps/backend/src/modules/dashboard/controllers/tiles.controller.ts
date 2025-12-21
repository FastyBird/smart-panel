import { validate } from 'class-validator';
import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';

import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
	Req,
	Res,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { setLocationHeader } from '../../api/utils/location-header.utils';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { DASHBOARD_MODULE_API_TAG_NAME, DASHBOARD_MODULE_NAME, DASHBOARD_MODULE_PREFIX } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import { CreateSingleTileDto, CreateTileDto, ReqCreateTileWithParentDto } from '../dto/create-tile.dto';
import { ReqUpdateTileWithParentDto, UpdateSingleTileDto, UpdateTileDto } from '../dto/update-tile.dto';
import { TileEntity } from '../entities/dashboard.entity';
import { TileResponseModel, TilesResponseModel } from '../models/dashboard-response.model';
import { TileTypeMapping, TilesTypeMapperService } from '../services/tiles-type-mapper.service';
import { TilesService } from '../services/tiles.service';

@ApiTags(DASHBOARD_MODULE_API_TAG_NAME)
@Controller('tiles')
export class TilesController {
	private readonly logger = createExtensionLogger(DASHBOARD_MODULE_NAME, 'TilesController');

	constructor(
		private readonly tilesService: TilesService,
		private readonly tilesMapperService: TilesTypeMapperService,
	) {}

	@ApiOperation({
		tags: [DASHBOARD_MODULE_API_TAG_NAME],
		summary: 'Retrieve all tiles',
		description: 'Retrieves all dashboard tiles with optional filtering by parent entity.',
		operationId: 'get-dashboard-module-tiles',
	})
	@ApiQuery({ name: 'parent_type', type: 'string', required: false, description: 'Filter by parent entity type' })
	@ApiQuery({
		name: 'parent_id',
		type: 'string',
		format: 'uuid',
		required: false,
		description: 'Filter by parent entity ID',
	})
	@ApiSuccessResponse(TilesResponseModel, 'All configured tiles were retrieved successfully.')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Parent entity not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(
		@Query('parent_type') parentType?: string,
		@Query('parent_id') parentId?: string,
	): Promise<TilesResponseModel> {
		this.logger.debug(`Fetching all tiles`);

		const tiles = await this.tilesService.findAll(
			parentType && parentId
				? {
						parentType,
						parentId,
					}
				: undefined,
		);

		this.logger.debug(`Retrieved ${tiles.length} tiles`);

		const response = new TilesResponseModel();
		response.data = tiles;

		return response;
	}

	@ApiOperation({
		tags: [DASHBOARD_MODULE_API_TAG_NAME],
		summary: 'Retrieve a specific tile by ID',
		description: 'Fetches a dashboard tile using its unique identifier.',
		operationId: 'get-dashboard-module-tile',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Tile ID' })
	@ApiSuccessResponse(TileResponseModel, 'The requested tile was retrieved successfully.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Tile not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<TileResponseModel> {
		this.logger.debug(`Fetching tile id=${id}`);

		const tile = await this.getOneOrThrow(id);

		this.logger.debug(`Found tile id=${tile.id}`);

		const response = new TileResponseModel();
		response.data = tile;

		return response;
	}

	@ApiOperation({
		tags: [DASHBOARD_MODULE_API_TAG_NAME],
		summary: 'Create a new tile',
		description: 'Creates a new dashboard tile with the provided configuration.',
		operationId: 'create-dashboard-module-tile',
	})
	@ApiBody({
		type: ReqCreateTileWithParentDto,
		description: 'Payload containing the tile metadata and layout information.',
	})
	@ApiCreatedSuccessResponse(
		TileResponseModel,
		'The newly created tile was returned successfully.',
		'/api/v1/modules/dashboard/tiles/123e4567-e89b-12d3-a456-426614174000',
	)
	@ApiBadRequestResponse('Invalid request data or unsupported tile type')
	@ApiNotFoundResponse('Parent entity not found')
	@ApiUnprocessableEntityResponse('Tile could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	async create(
		@Body() createDto: { data: object },
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<TileResponseModel> {
		this.logger.debug(`Incoming request to create a new tile`);

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

			this.logger.debug(`Successfully created tile id=${tile.id}`);

			setLocationHeader(req, res, DASHBOARD_MODULE_PREFIX, 'tiles', tile.id);

			const response = new TileResponseModel();
			response.data = tile;

			return response;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Tile could not be created. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [DASHBOARD_MODULE_API_TAG_NAME],
		summary: 'Update an existing tile',
		description: 'Partially updates the values of a dashboard tile identified by UUID.',
		operationId: 'update-dashboard-module-tile',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Tile ID' })
	@ApiBody({
		type: ReqUpdateTileWithParentDto,
		description: 'Payload describing the updates to the tile and its parent.',
	})
	@ApiSuccessResponse(TileResponseModel, 'The updated tile was returned successfully.')
	@ApiBadRequestResponse('Invalid UUID format, request data, or unsupported tile type')
	@ApiNotFoundResponse('Tile not found')
	@ApiUnprocessableEntityResponse('Tile could not be updated')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: { data: object },
	): Promise<TileResponseModel> {
		this.logger.debug(`Incoming update request for tile id=${id}`);

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

			this.logger.debug(`Successfully updated tile id=${updatedTile.id}`);

			const response = new TileResponseModel();
			response.data = updatedTile;

			return response;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Tile could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [DASHBOARD_MODULE_API_TAG_NAME],
		summary: 'Delete a tile',
		description: 'Deletes the dashboard tile identified by the provided UUID.',
		operationId: 'delete-dashboard-module-tile',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Tile ID' })
	@ApiNoContentResponse({ description: 'Tile deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Tile not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@HttpCode(204)
	@Delete(':id')
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`Incoming request to delete tile id=${id}`);

		const tile = await this.getOneOrThrow(id);

		await this.tilesService.remove(tile.id);

		this.logger.debug(`Successfully deleted tile id=${id}`);
	}

	private async getOneOrThrow(id: string): Promise<TileEntity> {
		this.logger.debug(`Checking existence of tile id=${id}`);

		const tile = await this.tilesService.findOne(id);

		if (!tile) {
			this.logger.error(`[ERROR] Tile with id=${id} not found`);

			throw new NotFoundException('Requested tile does not exist');
		}

		return tile;
	}
}
