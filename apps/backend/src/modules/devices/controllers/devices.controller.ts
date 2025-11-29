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
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiExtraModels, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../api/decorators/api-documentation.decorator';
import { DEVICES_MODULE_API_TAG_NAME, DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceEntity } from '../entities/devices.entity';
import { DeviceResponseModel, DevicesResponseModel } from '../models/devices-response.model';
import { DeviceTypeMapping, DevicesTypeMapperService } from '../services/devices-type-mapper.service';
import { DevicesService } from '../services/devices.service';

@ApiTags(DEVICES_MODULE_API_TAG_NAME)
@Controller('devices')
export class DevicesController {
	private readonly logger = new Logger(DevicesController.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly devicesMapperService: DevicesTypeMapperService,
	) {}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Retrieve a list of available devices',
		description:
			'Fetches a list of all devices currently registered in the system. Each device includes its metadata (e.g., ID, name, and category), along with associated channels, controls, and properties.',
		operationId: 'get-devices-module-devices',
	})
	@ApiExtraModels(DevicesResponseModel)
	@ApiSuccessResponse(
		DevicesResponseModel,
		'A list of devices successfully retrieved. Each device includes its metadata (ID, name, category), associated channels, controls, and properties.',
	)
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(): Promise<DevicesResponseModel> {
		this.logger.debug('[LOOKUP ALL] Fetching all devices');

		const devices = await this.devicesService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${devices.length} devices`);

		const response = new DevicesResponseModel();

		response.data = devices;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Retrieve details of a specific device',
		description:
			"Fetches the details of a specific device using its unique ID. The response includes the device's metadata (e.g., ID, name, and category), associated channels, controls, and properties.",
		operationId: 'get-devices-module-device',
	})
	@ApiExtraModels(DeviceResponseModel)
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiSuccessResponse(
		DeviceResponseModel,
		"The device details were successfully retrieved. The response includes the device's metadata (ID, name, category), associated channels, controls, and properties.",
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<DeviceResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching device id=${id}`);

		const device = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found device id=${device.id}`);

		const response = new DeviceResponseModel();

		response.data = device;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Create a new device',
		description:
			'Creates a new device resource in the system. The request requires device-specific attributes such as category and name. The response includes the full representation of the created device, including its associated channels, controls, and properties. Additionally, a Location header is provided with the URI of the newly created resource.',
		operationId: 'create-devices-module-device',
	})
	@ApiExtraModels(DeviceResponseModel, CreateDeviceDto)
	@ApiBody({ type: CreateDeviceDto, description: 'The data required to create a new device' })
	@ApiCreatedSuccessResponse(
		DeviceResponseModel,
		'The device was successfully created. The response includes the complete details of the newly created device, such as its unique identifier, name, category, and timestamps.',
	)
	@ApiBadRequestResponse('Invalid request data or unsupported device type')
	@ApiUnprocessableEntityResponse('Device could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	@Header('Location', `:baseUrl/${DEVICES_MODULE_PREFIX}/devices/:id`)
	async create(@Body() createDto: { data: object }): Promise<DeviceResponseModel> {
		this.logger.debug('[CREATE] Incoming request to create a new device');

		const type: string | undefined =
			'type' in createDto.data && typeof createDto.data.type === 'string' ? createDto.data.type : undefined;

		if (!type) {
			this.logger.error('[VALIDATION] Missing required field: type');

			throw new BadRequestException([JSON.stringify({ field: 'type', reason: 'Device type attribute is required.' })]);
		}

		let mapping: DeviceTypeMapping<DeviceEntity, CreateDeviceDto, UpdateDeviceDto>;

		try {
			mapping = this.devicesMapperService.getMapping<DeviceEntity, CreateDeviceDto, UpdateDeviceDto>(type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported device type: ${type}`, { message: err.message, stack: err.stack });

			if (error instanceof DevicesException) {
				throw new BadRequestException([JSON.stringify({ field: 'type', reason: `Unsupported device type: ${type}` })]);
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
			this.logger.error(`[VALIDATION FAILED] Validation failed for device creation error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const device = await this.devicesService.create(dtoInstance);

			this.logger.debug(`[CREATE] Successfully created device id=${device.id}`);

			const response = new DeviceResponseModel();

			response.data = device;

			return response;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Device could not be created. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Update an existing device',
		description:
			"Partially updates the attributes of an existing device identified by its unique ID. The update can modify metadata, such as the device's name, category, or description, without requiring the full object.",
		operationId: 'update-devices-module-device',
	})
	@ApiExtraModels(DeviceResponseModel, UpdateDeviceDto)
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiBody({ type: UpdateDeviceDto, description: 'The data required to update an existing device' })
	@ApiSuccessResponse(
		DeviceResponseModel,
		'The device was successfully updated. The response includes the complete details of the updated device, such as its unique identifier, name, category, and timestamps.',
	)
	@ApiBadRequestResponse('Invalid UUID format or unsupported device type')
	@ApiNotFoundResponse('Device not found')
	@ApiUnprocessableEntityResponse('Device could not be updated')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: { data: object },
	): Promise<DeviceResponseModel> {
		this.logger.debug(`[UPDATE] Incoming update request for device id=${id}`);

		const device = await this.getOneOrThrow(id);

		let mapping: DeviceTypeMapping<DeviceEntity, CreateDeviceDto, UpdateDeviceDto>;

		try {
			mapping = this.devicesMapperService.getMapping<DeviceEntity, CreateDeviceDto, UpdateDeviceDto>(device.type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported device type for update: ${device.type} id=${id} `, {
				message: err.message,
				stack: err.stack,
			});

			if (error instanceof DevicesException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported device type: ${device.type}` }),
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
				`[VALIDATION FAILED] Validation failed for device modification error=${JSON.stringify(errors)} id=${id} `,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const updatedDevice = await this.devicesService.update(device.id, dtoInstance);

			this.logger.debug(`[UPDATE] Successfully updated device id=${updatedDevice.id}`);

			const response = new DeviceResponseModel();

			response.data = updatedDevice;

			return response;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Device could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Delete a device',
		description:
			'Deletes a specific device identified by its unique ID from the system. This action is irreversible and will remove the device and its associated data from the system.',
		operationId: 'delete-devices-module-device',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiNoContentResponse({ description: 'Device deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
	@HttpCode(204)
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete device id=${id}`);

		const device = await this.getOneOrThrow(id);

		await this.devicesService.remove(device.id);

		this.logger.debug(`[DELETE] Successfully deleted device id=${id}`);
	}

	private async getOneOrThrow(id: string): Promise<DeviceEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of device id=${id}`);

		const device = await this.devicesService.findOne(id);

		if (!device) {
			this.logger.error(`[ERROR] Device with id=${id} not found`);

			throw new NotFoundException('Requested device does not exist');
		}

		return device;
	}
}
