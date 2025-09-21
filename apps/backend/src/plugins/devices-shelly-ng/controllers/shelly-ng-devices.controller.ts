import { validate } from 'class-validator';

import {
	Body,
	Controller,
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

import { toInstance } from '../../../common/utils/transform.utils';
import { DEVICES_MODULE_PREFIX } from '../../../modules/devices/devices.constants';
import { DevicesException } from '../../../modules/devices/devices.exceptions';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DESCRIPTORS } from '../devices-shelly-ng.constants';
import ShellyNgCreateDeviceDto from '../dto/shelly-ng-create-device.dto';
import { ShellyNgGetInfoDto } from '../dto/shelly-ng-get-info.dto';
import { ShellyNgUpdateDeviceDto } from '../dto/shelly-ng-update-device.dto';
import { ShellyNgDeviceInfoModel, ShellyNgSupportedDeviceModel } from '../models/shelly-ng.model';
import { DeviceManagerService } from '../services/device-manager.service';

@Controller('devices')
export class ShellyNgDevicesController {
	private readonly logger = new Logger(ShellyNgDevicesController.name);

	constructor(
		private readonly deviceManagerService: DeviceManagerService,
		private readonly devicesService: DevicesService,
	) {}

	@Post('info')
	async getInfo(@Body() createDto: { data: ShellyNgGetInfoDto }): Promise<ShellyNgDeviceInfoModel> {
		let deviceInfo: Awaited<ReturnType<typeof this.deviceManagerService.getDeviceInfo>>;

		try {
			deviceInfo = await this.deviceManagerService.getDeviceInfo(createDto.data.hostname, createDto.data.password);
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new NotFoundException('Device info could not be fetched. Please try again later');
			}

			throw error;
		}

		const shellyDeviceInfo = toInstance(ShellyNgDeviceInfoModel, deviceInfo, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(shellyDeviceInfo, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[SHELLY NG][DEVICES CONTROLLER] Validation failed: ${JSON.stringify(errors)}`);

			throw new UnprocessableEntityException('Device info model could not be created');
		}

		return shellyDeviceInfo;
	}

	@Get('supported')
	async getSupported(): Promise<ShellyNgSupportedDeviceModel[]> {
		this.logger.debug('[SHELLY NG][DEVICES CONTROLLER] Incoming request to get Shelly NG supported devices list');

		const devices: ShellyNgSupportedDeviceModel[] = [];

		for (const [group, spec] of Object.entries(DESCRIPTORS)) {
			const deviceSpec = toInstance(
				ShellyNgSupportedDeviceModel,
				{
					...spec,
					group,
				},
				{
					excludeExtraneousValues: false,
				},
			);

			const errors = await validate(deviceSpec, {
				whitelist: true,
				forbidNonWhitelisted: true,
				stopAtFirstError: false,
			});

			if (errors.length > 0) {
				this.logger.error(`[SHELLY NG][DEVICES CONTROLLER] Validation failed: ${JSON.stringify(errors)}`);

				continue;
			}

			devices.push(deviceSpec);
		}

		return devices;
	}

	@Post()
	@Header('Location', `:baseUrl/${DEVICES_MODULE_PREFIX}/devices/:id`)
	async create(@Body() createDto: { data: ShellyNgCreateDeviceDto }): Promise<DeviceEntity> {
		this.logger.debug('[SHELLY NG][DEVICES CONTROLLER] Incoming request to create a Shelly NG device');

		if (!(createDto.data.group in DESCRIPTORS)) {
			throw new UnprocessableEntityException('Provided device group is not valid');
		}

		const deviceSpec = DESCRIPTORS[createDto.data.group];

		let deviceInfo: Awaited<ReturnType<typeof this.deviceManagerService.getDeviceInfo>>;

		try {
			deviceInfo = await this.deviceManagerService.getDeviceInfo(createDto.data.hostname, createDto.data.password);
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new NotFoundException('Device info could not be fetched. Please try again later');
			}

			throw error;
		}

		if (!deviceSpec.models.includes(deviceInfo.model.toUpperCase())) {
			throw new UnprocessableEntityException('Provided device type is not same as fetched from device');
		}

		try {
			const device = await this.deviceManagerService.createOrUpdate(
				createDto.data.hostname,
				createDto.data.password,
				createDto.data.category,
				createDto.data.name,
			);

			this.logger.debug(`[SHELLY NG][DEVICES CONTROLLER] Successfully created device id=${device.id}`);

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
		@Body() updateDto: { data: ShellyNgUpdateDeviceDto },
	): Promise<DeviceEntity> {
		this.logger.debug(`[SHELLY NG][DEVICES CONTROLLER] Incoming update request for device id=${id}`);

		const device = await this.devicesService.findOne(id);

		if (!device) {
			this.logger.error(`[SHELLY NG][DEVICES CONTROLLER] Device with id=${id} not found`);

			throw new NotFoundException('Requested device does not exist');
		}

		try {
			const updatedDevice = await this.devicesService.update(device.id, updateDto.data);

			this.logger.debug(`[UPDATE] Successfully updated device id=${updatedDevice.id}`);

			return updatedDevice;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Device could not be updated. Please try again later');
			}

			throw error;
		}
	}
}
