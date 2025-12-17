import { validate } from 'class-validator';
import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';

import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Req,
	Res,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

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
import { CreateLocationDto, ReqCreateLocationDto } from '../dto/create-location.dto';
import { ReqUpdateLocationDto, UpdateLocationDto } from '../dto/update-location.dto';
import { WeatherLocationEntity } from '../entities/locations.entity';
import { LocationResponseModel, LocationsResponseModel } from '../models/locations-response.model';
import { LocationTypeMapping, LocationsTypeMapperService } from '../services/locations-type-mapper.service';
import { LocationsService } from '../services/locations.service';
import { WEATHER_MODULE_API_TAG_NAME, WEATHER_MODULE_PREFIX } from '../weather.constants';
import { WeatherException } from '../weather.exceptions';

@ApiTags(WEATHER_MODULE_API_TAG_NAME)
@Controller('locations')
export class LocationsController {
	private readonly logger = new Logger(LocationsController.name);

	constructor(
		private readonly locationsService: LocationsService,
		private readonly locationsMapperService: LocationsTypeMapperService,
	) {}

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Retrieve a list of weather locations',
		description:
			'Fetches a list of all weather locations currently configured in the system. Each location includes its metadata (e.g., ID, name, and provider type).',
		operationId: 'get-weather-module-locations',
	})
	@ApiSuccessResponse(
		LocationsResponseModel,
		'A list of locations successfully retrieved. Each location includes its metadata (ID, name, provider type).',
	)
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(): Promise<LocationsResponseModel> {
		this.logger.debug('[LOOKUP ALL] Fetching all locations');

		const locations = await this.locationsService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${locations.length} locations`);

		const response = new LocationsResponseModel();

		response.data = locations;

		return response;
	}

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Retrieve details of a specific location',
		description:
			"Fetches the details of a specific weather location using its unique ID. The response includes the location's metadata (e.g., ID, name, and provider type).",
		operationId: 'get-weather-module-location',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Location ID' })
	@ApiSuccessResponse(
		LocationResponseModel,
		"The location details were successfully retrieved. The response includes the location's metadata (ID, name, provider type).",
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Location not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<LocationResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching location id=${id}`);

		const location = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found location id=${location.id}`);

		const response = new LocationResponseModel();

		response.data = location;

		return response;
	}

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Create a new weather location',
		description:
			'Creates a new weather location resource in the system. The request requires location-specific attributes such as type (provider) and name. The response includes the full representation of the created location. Additionally, a Location header is provided with the URI of the newly created resource.',
		operationId: 'create-weather-module-location',
	})
	@ApiBody({ type: ReqCreateLocationDto, description: 'The data required to create a new location' })
	@ApiCreatedSuccessResponse(
		LocationResponseModel,
		'The location was successfully created. The response includes the complete details of the newly created location, such as its unique identifier, name, and timestamps.',
		'/api/v1/modules/weather/locations/123e4567-e89b-12d3-a456-426614174000',
	)
	@ApiBadRequestResponse('Invalid request data or unsupported location type')
	@ApiUnprocessableEntityResponse('Location could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	async create(
		@Body() createDto: { data: object },
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<LocationResponseModel> {
		this.logger.debug('[CREATE] Incoming request to create a new location');

		const type: string | undefined =
			'type' in createDto.data && typeof createDto.data.type === 'string' ? createDto.data.type : undefined;

		if (!type) {
			this.logger.error('[VALIDATION] Missing required field: type');

			throw new BadRequestException([
				JSON.stringify({ field: 'type', reason: 'Location type attribute is required.' }),
			]);
		}

		let mapping: LocationTypeMapping<WeatherLocationEntity, CreateLocationDto, UpdateLocationDto>;

		try {
			mapping = this.locationsMapperService.getMapping<WeatherLocationEntity, CreateLocationDto, UpdateLocationDto>(
				type,
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported location type: ${type}`, { message: err.message, stack: err.stack });

			if (error instanceof WeatherException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported location type: ${type}` }),
				]);
			}

			throw error;
		}

		const dtoInstance = toInstance(mapping.createDto, createDto.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for location creation error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const location = await this.locationsService.create(dtoInstance);

			this.logger.debug(`[CREATE] Successfully created location id=${location.id}`);

			setLocationHeader(req, res, WEATHER_MODULE_PREFIX, 'locations', location.id);

			const response = new LocationResponseModel();

			response.data = location;

			return response;
		} catch (error) {
			if (error instanceof WeatherException) {
				throw new UnprocessableEntityException('Location could not be created. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Update an existing location',
		description:
			"Partially updates the attributes of an existing location identified by its unique ID. The update can modify metadata, such as the location's name, without requiring the full object.",
		operationId: 'update-weather-module-location',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Location ID' })
	@ApiBody({ type: ReqUpdateLocationDto, description: 'The data required to update an existing location' })
	@ApiSuccessResponse(
		LocationResponseModel,
		'The location was successfully updated. The response includes the complete details of the updated location, such as its unique identifier, name, and timestamps.',
	)
	@ApiBadRequestResponse('Invalid UUID format or unsupported location type')
	@ApiNotFoundResponse('Location not found')
	@ApiUnprocessableEntityResponse('Location could not be updated')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: { data: object },
	): Promise<LocationResponseModel> {
		this.logger.debug(`[UPDATE] Incoming update request for location id=${id}`);

		const location = await this.getOneOrThrow(id);

		let mapping: LocationTypeMapping<WeatherLocationEntity, CreateLocationDto, UpdateLocationDto>;

		try {
			mapping = this.locationsMapperService.getMapping<WeatherLocationEntity, CreateLocationDto, UpdateLocationDto>(
				location.type,
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported location type for update: ${location.type} id=${id} `, {
				message: err.message,
				stack: err.stack,
			});

			if (error instanceof WeatherException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported location type: ${location.type}` }),
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
			this.logger.error(
				`[VALIDATION FAILED] Validation failed for location modification error=${JSON.stringify(errors)} id=${id} `,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const updatedLocation = await this.locationsService.update(location.id, dtoInstance);

			this.logger.debug(`[UPDATE] Successfully updated location id=${updatedLocation.id}`);

			const response = new LocationResponseModel();

			response.data = updatedLocation;

			return response;
		} catch (error) {
			if (error instanceof WeatherException) {
				throw new UnprocessableEntityException('Location could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Delete a location',
		description:
			'Deletes a specific weather location identified by its unique ID from the system. This action is irreversible and will remove the location and its associated data from the system.',
		operationId: 'delete-weather-module-location',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Location ID' })
	@ApiNoContentResponse({ description: 'Location deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Location not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
	@HttpCode(204)
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete location id=${id}`);

		const location = await this.getOneOrThrow(id);

		await this.locationsService.remove(location.id);

		this.logger.debug(`[DELETE] Successfully deleted location id=${id}`);
	}

	private async getOneOrThrow(id: string): Promise<WeatherLocationEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of location id=${id}`);

		const location = await this.locationsService.findOne(id);

		if (!location) {
			this.logger.error(`[ERROR] Location with id=${id} not found`);

			throw new NotFoundException('Requested location does not exist');
		}

		return location;
	}
}
