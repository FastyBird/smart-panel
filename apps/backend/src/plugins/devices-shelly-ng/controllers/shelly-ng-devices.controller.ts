import { validate } from 'class-validator';
import { FetchError } from 'node-fetch';

import { Body, Controller, Get, Logger, NotFoundException, Post, UnprocessableEntityException } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { DESCRIPTORS } from '../devices-shelly-ng.constants';
import { DevicesShellyNgException } from '../devices-shelly-ng.exceptions';
import { ShellyNgGetInfoDto } from '../dto/shelly-ng-get-info.dto';
import { ShellyNgDeviceInfoModel, ShellyNgSupportedDeviceModel } from '../models/shelly-ng.model';
import { DeviceManagerService } from '../services/device-manager.service';

@Controller('devices')
export class ShellyNgDevicesController {
	private readonly logger = new Logger(ShellyNgDevicesController.name);

	constructor(private readonly deviceManagerService: DeviceManagerService) {}

	@Post('info')
	async getInfo(@Body() createDto: { data: ShellyNgGetInfoDto }): Promise<ShellyNgDeviceInfoModel> {
		let deviceInfo: Awaited<ReturnType<typeof this.deviceManagerService.getDeviceInfo>>;

		try {
			deviceInfo = await this.deviceManagerService.getDeviceInfo(createDto.data.hostname, createDto.data.password);
		} catch (error) {
			if (error instanceof DevicesShellyNgException || error instanceof FetchError) {
				throw new NotFoundException('Device info could not be fetched. Please try again later');
			}

			throw error;
		}

		const shellyDeviceInfo = toInstance(ShellyNgDeviceInfoModel, {
			...deviceInfo,
			firmware: deviceInfo.ver,
			authentication: {
				domain: deviceInfo.auth_domain,
				enabled: deviceInfo.auth_en,
			},
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
			const deviceSpec = toInstance(ShellyNgSupportedDeviceModel, {
				...spec,
				group,
			});

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
}
