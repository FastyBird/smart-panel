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
	Req,
	Res,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { setLocationHeader } from '../../api/utils/location-header.utils';
import { SpacesResponseModel } from '../../spaces/models/spaces-response.model';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { DEVICES_MODULE_API_TAG_NAME, DEVICES_MODULE_NAME, DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesException, DevicesNotFoundException, DevicesValidationException } from '../devices.exceptions';
import { CreateDeviceDto, ReqCreateDeviceDto } from '../dto/create-device.dto';
import { ReqUpdateDeviceDto, UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceEntity } from '../entities/devices.entity';
import { DeviceValidationResponseModel, DevicesValidationResponseModel } from '../models/device-validation.model';
import { DeviceResponseModel, DevicesResponseModel } from '../models/devices-response.model';
import { DeviceValidationService } from '../services/device-validation.service';
import { DeviceZonesService } from '../services/device-zones.service';
import { DeviceTypeMapping, DevicesTypeMapperService } from '../services/devices-type-mapper.service';
import { DevicesService } from '../services/devices.service';

@ApiTags(DEVICES_MODULE_API_TAG_NAME)
@Controller('devices')
export class DevicesController {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DevicesController');

	constructor(
		private readonly devicesService: DevicesService,
		private readonly devicesMapperService: DevicesTypeMapperService,
		private readonly deviceValidationService: DeviceValidationService,
		private readonly deviceZonesService: DeviceZonesService,
	) {}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Retrieve a list of available devices',
		description:
			'Fetches a list of all devices currently registered in the system. Each device includes its metadata (e.g., ID, name, and category), along with associated channels, controls, and properties.',
		operationId: 'get-devices-module-devices',
	})
	@ApiSuccessResponse(
		DevicesResponseModel,
		'A list of devices successfully retrieved. Each device includes its metadata (ID, name, category), associated channels, controls, and properties.',
	)
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(): Promise<DevicesResponseModel> {
		const devices = await this.devicesService.findAll();

		const response = new DevicesResponseModel();

		response.data = devices;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Validate all devices against their specifications',
		description:
			'Validates all registered devices against their category specifications. Checks for required channels and properties, and reports any missing or incorrectly configured elements.',
		operationId: 'get-devices-module-devices-validation',
	})
	@ApiSuccessResponse(
		DevicesValidationResponseModel,
		'Validation results for all devices. Includes a summary of valid/invalid devices and detailed issues for each device.',
	)
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('validation')
	async validateAll(): Promise<DevicesValidationResponseModel> {
		const validationResult = await this.deviceValidationService.validateAllDevices();

		const response = new DevicesValidationResponseModel();

		response.data = {
			summary: validationResult.summary,
			devices: validationResult.devices,
		};

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Validate a specific device against its specification',
		description:
			'Validates a specific device identified by its unique ID against its category specification. Checks for required channels and properties, and reports any missing or incorrectly configured elements.',
		operationId: 'get-devices-module-device-validation',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiSuccessResponse(
		DeviceValidationResponseModel,
		'Validation result for the specified device. Includes whether the device is valid and a list of any issues found.',
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id/validation')
	async validateOne(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<DeviceValidationResponseModel> {
		const validationResult = await this.deviceValidationService.validateDeviceById(id);

		if (!validationResult) {
			this.logger.error(`[ERROR] Device with id=${id} not found`);

			throw new NotFoundException('Requested device does not exist');
		}

		const response = new DeviceValidationResponseModel();

		response.data = validationResult;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Retrieve details of a specific device',
		description:
			"Fetches the details of a specific device using its unique ID. The response includes the device's metadata (e.g., ID, name, and category), associated channels, controls, and properties.",
		operationId: 'get-devices-module-device',
	})
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
		const device = await this.getOneOrThrow(id);

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
	@ApiBody({ type: ReqCreateDeviceDto, description: 'The data required to create a new device' })
	@ApiCreatedSuccessResponse(
		DeviceResponseModel,
		'The device was successfully created. The response includes the complete details of the newly created device, such as its unique identifier, name, category, and timestamps.',
		'/api/v1/modules/devices/devices/123e4567-e89b-12d3-a456-426614174000',
	)
	@ApiBadRequestResponse('Invalid request data or unsupported device type')
	@ApiUnprocessableEntityResponse('Device could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	async create(
		@Body() createDto: { data: object },
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<DeviceResponseModel> {
		const type: string | undefined =
			'type' in createDto.data && typeof createDto.data.type === 'string' ? createDto.data.type : undefined;

		if (!type) {
			this.logger.error('Missing required field: type');

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

			setLocationHeader(req, res, DEVICES_MODULE_PREFIX, 'devices', device.id);

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
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiBody({ type: ReqUpdateDeviceDto, description: 'The data required to update an existing device' })
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
		const device = await this.getOneOrThrow(id);

		await this.devicesService.remove(device.id);
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Get zones a device belongs to',
		description:
			'Retrieves a list of zones that the specified device is a member of. This includes only explicitly assigned zones, not floor zones (which are derived from room hierarchy).',
		operationId: 'get-devices-module-device-zones',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiSuccessResponse(SpacesResponseModel, 'List of zones the device belongs to')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id/zones')
	async getDeviceZones(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<SpacesResponseModel> {
		await this.getOneOrThrow(id);

		const zones = await this.deviceZonesService.getDeviceZones(id);

		const response = new SpacesResponseModel();

		response.data = zones;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Add device to a zone',
		description:
			'Adds the specified device to a zone. Only non-floor zones can be explicitly assigned. Floor zone membership is derived from the room→zone hierarchy.',
		operationId: 'add-devices-module-device-zone',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiParam({ name: 'zoneId', type: 'string', format: 'uuid', description: 'Zone ID' })
	@ApiNoContentResponse({ description: 'Device successfully added to zone' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device or zone not found')
	@ApiUnprocessableEntityResponse('Cannot add device to floor zone or non-zone space')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':id/zones/:zoneId')
	@HttpCode(204)
	async addDeviceToZone(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Param('zoneId', new ParseUUIDPipe({ version: '4' })) zoneId: string,
	): Promise<void> {
		await this.getOneOrThrow(id);

		try {
			await this.deviceZonesService.addDeviceToZone(id, zoneId);
		} catch (error) {
			if (error instanceof DevicesNotFoundException) {
				throw new NotFoundException(error.message);
			}
			if (error instanceof DevicesValidationException) {
				throw new UnprocessableEntityException(error.message);
			}
			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Remove device from a zone',
		description: 'Removes the specified device from a zone membership.',
		operationId: 'remove-devices-module-device-zone',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiParam({ name: 'zoneId', type: 'string', format: 'uuid', description: 'Zone ID' })
	@ApiNoContentResponse({ description: 'Device successfully removed from zone' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id/zones/:zoneId')
	@HttpCode(204)
	async removeDeviceFromZone(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Param('zoneId', new ParseUUIDPipe({ version: '4' })) zoneId: string,
	): Promise<void> {
		await this.getOneOrThrow(id);

		await this.deviceZonesService.removeDeviceFromZone(id, zoneId);
	}

	private async getOneOrThrow(id: string): Promise<DeviceEntity> {
		const device = await this.devicesService.findOne(id);

		if (!device) {
			this.logger.error(`[ERROR] Device with id=${id} not found`);

			throw new NotFoundException('Requested device does not exist');
		}

		return device;
	}
}
