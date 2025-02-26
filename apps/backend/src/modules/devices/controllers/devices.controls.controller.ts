import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Post,
	UnprocessableEntityException,
} from '@nestjs/common';

import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { ReqCreateDeviceControlDto } from '../dto/create-device-control.dto';
import { DeviceControlEntity, DeviceEntity } from '../entities/devices.entity';
import { DevicesControlsService } from '../services/devices.controls.service';
import { DevicesService } from '../services/devices.service';

@Controller('devices/:deviceId/controls')
export class DevicesControlsController {
	private readonly logger = new Logger(DevicesControlsController.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly devicesControlsService: DevicesControlsService,
	) {}

	@Get()
	async findAll(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
	): Promise<DeviceControlEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all controls for deviceId=${deviceId}`);

		const device = await this.getDeviceOrThrow(deviceId);

		const controls = await this.devicesControlsService.findAll(device.id);

		this.logger.debug(`[LOOKUP ALL] Retrieved ${controls.length} controls for deviceId=${device.id}`);

		return controls;
	}

	@Get(':id')
	async findOneControl(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<DeviceControlEntity> {
		this.logger.debug(`[LOOKUP] Fetching device id=${id} for deviceId=${deviceId}`);

		const device = await this.getDeviceOrThrow(deviceId);

		const control = await this.getOneOrThrow(id, device.id);

		this.logger.debug(`[LOOKUP] Found control id=${control.id} for deviceId=${device.id}`);

		return control;
	}

	@Post()
	@Header('Location', `:baseUrl/${DEVICES_MODULE_PREFIX}/devices/:device/controls/:id`)
	async create(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Body() createDto: ReqCreateDeviceControlDto,
	): Promise<DeviceControlEntity> {
		this.logger.debug(`[CREATE] Incoming request to create a new control for deviceId=${deviceId}`);

		const device = await this.getDeviceOrThrow(deviceId);

		const existingControl = await this.devicesControlsService.findOneByName(createDto.data.name, device.id);

		if (existingControl === null) {
			throw ValidationExceptionFactory.createException([
				{
					property: 'controls',
					children: [
						{
							property: 'name',
							constraints: {
								unique: 'name must be unique',
							},
						},
					],
				},
			]);
		}

		try {
			const control = await this.devicesControlsService.create(device.id, createDto.data);

			this.logger.debug(`[CREATE] Successfully created control id=${control.id} for deviceId=${device.id}`);

			return control;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Device control could not be created. Please try again later');
			}

			throw error;
		}
	}

	@Delete(':id')
	async remove(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete control id=${id} for deviceId=${deviceId}`);

		const device = await this.getDeviceOrThrow(deviceId);
		const control = await this.getOneOrThrow(id, device.id);

		await this.devicesControlsService.remove(control.id, device.id);

		this.logger.debug(`[DELETE] Successfully deleted control id=${id} for deviceId=${device.id}`);
	}

	private async getOneOrThrow(id: string, deviceId: string): Promise<DeviceControlEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of control id=${id} for deviceId=${deviceId}`);

		const control = await this.devicesControlsService.findOne(id, deviceId);

		if (!control) {
			this.logger.error(`[ERROR] Control with id=${id} for deviceId=${deviceId} not found`);

			throw new NotFoundException('Requested device control does not exist');
		}

		return control;
	}

	private async getDeviceOrThrow(deviceId: string): Promise<DeviceEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of device id=${deviceId}`);

		const device = await this.devicesService.findOne(deviceId);

		if (!device) {
			this.logger.error(`[ERROR] Device with id=${deviceId} not found`);

			throw new NotFoundException('Requested device does not exist');
		}

		return device;
	}
}
