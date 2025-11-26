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
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../common/decorators/api-documentation.decorator';
import { ApiTag } from '../../../common/decorators/api-tag.decorator';
import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import {
	DEVICES_MODULE_API_TAG_DESCRIPTION,
	DEVICES_MODULE_API_TAG_NAME,
	DEVICES_MODULE_NAME,
	DEVICES_MODULE_PREFIX,
} from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceEntity } from '../entities/devices.entity';
import { DeviceResponseModel, DevicesResponseModel } from '../models/devices-response.model';
import { DeviceTypeMapping, DevicesTypeMapperService } from '../services/devices-type-mapper.service';
import { DevicesService } from '../services/devices.service';

@ApiTag({
	tagName: DEVICES_MODULE_NAME,
	displayName: DEVICES_MODULE_API_TAG_NAME,
	description: DEVICES_MODULE_API_TAG_DESCRIPTION,
})
@Controller('devices')
export class DevicesController {
	private readonly logger = new Logger(DevicesController.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly devicesMapperService: DevicesTypeMapperService,
	) {}

	@Get()
	@ApiOperation({ summary: 'Retrieve all devices' })
	@ApiSuccessResponse(DevicesResponseModel)
	@ApiInternalServerErrorResponse('Internal server error')
	async findAll(): Promise<DevicesResponseModel> {
		this.logger.debug('[LOOKUP ALL] Fetching all devices');

		const devices = await this.devicesService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${devices.length} devices`);

		return toInstance(DevicesResponseModel, { data: devices });
	}

	@Get(':id')
	@ApiOperation({ summary: 'Retrieve a specific device by ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiSuccessResponse(DeviceResponseModel)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device not found')
	@ApiInternalServerErrorResponse('Internal server error')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<DeviceResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching device id=${id}`);

		const device = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found device id=${device.id}`);

		return toInstance(DeviceResponseModel, { data: device });
	}

	@Post()
	@ApiOperation({ summary: 'Create a new device' })
	@ApiBody({ type: CreateDeviceDto })
	@ApiCreatedSuccessResponse(DeviceResponseModel)
	@ApiBadRequestResponse('Invalid request data or unsupported device type')
	@ApiUnprocessableEntityResponse('Device could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
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

			return toInstance(DeviceResponseModel, { data: device });
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Device could not be created. Please try again later');
			}

			throw error;
		}
	}

	@Patch(':id')
	@ApiOperation({ summary: 'Update a device' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiBody({ type: UpdateDeviceDto })
	@ApiSuccessResponse(DeviceResponseModel)
	@ApiBadRequestResponse('Invalid UUID format or unsupported device type')
	@ApiNotFoundResponse('Device not found')
	@ApiUnprocessableEntityResponse('Device could not be updated')
	@ApiInternalServerErrorResponse('Internal server error')
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

			return toInstance(DeviceResponseModel, { data: updatedDevice });
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Device could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@Delete(':id')
	@HttpCode(204)
	@ApiOperation({ summary: 'Delete a device' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiNoContentResponse({ description: 'Device deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device not found')
	@ApiInternalServerErrorResponse('Internal server error')
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
