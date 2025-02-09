import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import get from 'lodash.get';

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
import { DevicesModulePrefix } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceEntity } from '../entities/devices.entity';
import { DeviceTypeMapping, DevicesTypeMapperService } from '../services/devices-type-mapper.service';
import { DevicesService } from '../services/devices.service';

@Controller('devices')
export class DevicesController {
	private readonly logger = new Logger(DevicesController.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly devicesMapperService: DevicesTypeMapperService,
	) {}

	@Get()
	async findAll(): Promise<DeviceEntity[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all devices');

		const devices = await this.devicesService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${devices.length} devices`);

		return devices;
	}

	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<DeviceEntity> {
		this.logger.debug(`[LOOKUP] Fetching device id=${id}`);

		const device = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found device id=${device.id}`);

		return device;
	}

	@Post()
	@Header('Location', `:baseUrl/${DevicesModulePrefix}/devices/:id`)
	async create(@Body() createDto: any): Promise<DeviceEntity> {
		this.logger.debug('[CREATE] Incoming request to create a new device');

		const type: string | undefined = get(createDto, 'type', undefined) as string | undefined;

		if (!type) {
			this.logger.error('[VALIDATION] Missing required field: type');

			throw new BadRequestException([JSON.stringify({ field: 'type', reason: 'Device property type is required.' })]);
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

		const dtoInstance = plainToInstance(mapping.createDto, createDto, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for device creation error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const device = await this.devicesService.create(createDto as CreateDeviceDto);

			this.logger.debug(`[CREATE] Successfully created device id=${device.id}`);

			return device;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Device could not be created. Please try again later');
			}

			throw error;
		}
	}

	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: any,
	): Promise<DeviceEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for device id=${id}`);

		const device = await this.getOneOrThrow(id);

		let mapping: DeviceTypeMapping<DeviceEntity, CreateDeviceDto, UpdateDeviceDto>;

		try {
			mapping = this.devicesMapperService.getMapping<DeviceEntity, CreateDeviceDto, UpdateDeviceDto>(device.type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported device type for update: ${device.type}`, {
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

		const dtoInstance = plainToInstance(mapping.updateDto, updateDto, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(
				`[VALIDATION FAILED] Validation failed for device modification error=${JSON.stringify(errors)}`,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const updatedDevice = await this.devicesService.update(device.id, updateDto as UpdateDeviceDto);

			this.logger.debug(`[UPDATE] Successfully updated device id=${updatedDevice.id}`);

			return updatedDevice;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Device could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@Delete(':id')
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
