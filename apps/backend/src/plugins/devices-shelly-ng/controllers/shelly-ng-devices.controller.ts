import { validate } from 'class-validator';
import { FetchError } from 'node-fetch';

import { Body, Controller, Get, Logger, NotFoundException, Post, UnprocessableEntityException } from '@nestjs/common';
import { ApiBody, ApiOperation } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessArrayResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/api/decorators/api-documentation.decorator';
import { ApiTag } from '../../../modules/api/decorators/api-tag.decorator';
import { toInstance } from '../../../common/utils/transform.utils';
import {
	DEVICES_SHELLY_NG_PLUGIN_API_TAG_DESCRIPTION,
	DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME,
	DEVICES_SHELLY_NG_PLUGIN_NAME,
} from '../devices-shelly-ng.constants';
import { DESCRIPTORS } from '../devices-shelly-ng.constants';
import { DevicesShellyNgException } from '../devices-shelly-ng.exceptions';
import {
	DevicesShellyNgPluginCreateDeviceInfo,
	DevicesShellyNgPluginReqCreateDeviceInfo,
	ReqShellyNgGetInfoDto,
	ShellyNgGetInfoDto,
} from '../dto/shelly-ng-get-info.dto';
import {
	ShellyNgDeviceInfoResponseModel,
	ShellyNgSupportedDevicesResponseModel,
} from '../models/shelly-ng-response.model';
import {
	DevicesShellyNgPluginDeviceInfo,
	DevicesShellyNgPluginSupportedDevice,
	ShellyNgDeviceInfoAuthenticationModel,
	ShellyNgDeviceInfoComponentModel,
	ShellyNgDeviceInfoModel,
	ShellyNgSupportedDeviceComponentModel,
	ShellyNgSupportedDeviceModel,
	ShellyNgSupportedDeviceSystemComponentModel,
} from '../models/shelly-ng.model';
import { DeviceManagerService } from '../services/device-manager.service';

@ApiTag({
	tagName: DEVICES_SHELLY_NG_PLUGIN_NAME,
	displayName: DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME,
	description: DEVICES_SHELLY_NG_PLUGIN_API_TAG_DESCRIPTION,
})
@Controller('devices')
export class ShellyNgDevicesController {
	private readonly logger = new Logger(ShellyNgDevicesController.name);

	constructor(private readonly deviceManagerService: DeviceManagerService) {}

	@Post('info')
	@ApiOperation({ summary: 'Fetch information about a Shelly NG device' })
	@ApiBody({ type: ReqShellyNgGetInfoDto })
	@ApiSuccessResponse(ShellyNgDeviceInfoModel)
	@ApiBadRequestResponse('Invalid request data')
	@ApiNotFoundResponse('Device info could not be fetched')
	@ApiUnprocessableEntityResponse('Device info model could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	async getInfo(@Body() createDto: ReqShellyNgGetInfoDto): Promise<ShellyNgDeviceInfoModel> {
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
	@ApiOperation({ summary: 'Get list of supported Shelly NG devices' })
	@ApiSuccessArrayResponse(ShellyNgSupportedDeviceModel)
	@ApiInternalServerErrorResponse('Internal server error')
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
