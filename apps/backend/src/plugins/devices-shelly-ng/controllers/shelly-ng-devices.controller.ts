import { validate } from 'class-validator';
import { FetchError } from 'node-fetch';

import { Body, Controller, Get, Logger, NotFoundException, Post, UnprocessableEntityException } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME } from '../devices-shelly-ng.constants';
import { DESCRIPTORS } from '../devices-shelly-ng.constants';
import { DevicesShellyNgException } from '../devices-shelly-ng.exceptions';
import { DevicesShellyNgPluginReqGetInfo } from '../dto/shelly-ng-get-info.dto';
import {
	ShellyNgDeviceInfoResponseModel,
	ShellyNgSupportedDevicesResponseModel,
} from '../models/shelly-ng-response.model';
import { ShellyNgDeviceInfoModel, ShellyNgSupportedDeviceModel } from '../models/shelly-ng.model';
import { DeviceManagerService } from '../services/device-manager.service';

@ApiTags(DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME)
@Controller('devices')
export class ShellyNgDevicesController {
	private readonly logger = new Logger(ShellyNgDevicesController.name);

	constructor(private readonly deviceManagerService: DeviceManagerService) {}

	@ApiOperation({
		tags: [DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME],
		summary: 'Fetch information about a Shelly NG device',
		description:
			'Retrieves detailed information about a Shelly Next-Generation device by connecting to it using the provided hostname or IP address. The response includes device identification, firmware version, authentication settings, and available components.',
		operationId: 'create-devices-shelly-ng-plugin-device-info',
	})
	@ApiBody({
		type: DevicesShellyNgPluginReqGetInfo,
		description: 'The data required to fetch device information',
	})
	@ApiSuccessResponse(
		ShellyNgDeviceInfoResponseModel,
		'Device information was successfully retrieved. The response includes device identification, firmware version, authentication settings, and available components.',
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiNotFoundResponse('Device info could not be fetched')
	@ApiUnprocessableEntityResponse('Device info model could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('info')
	async getInfo(@Body() createDto: DevicesShellyNgPluginReqGetInfo): Promise<ShellyNgDeviceInfoResponseModel> {
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

		const response = new ShellyNgDeviceInfoResponseModel();
		response.data = shellyDeviceInfo;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME],
		summary: 'Get list of supported Shelly NG devices',
		description:
			'Retrieves a comprehensive list of all Shelly Next-Generation device models that are supported by this plugin. Each entry includes device specifications, available components, and supported categories.',
		operationId: 'get-devices-shelly-ng-plugin-supported',
	})
	@ApiSuccessResponse(
		ShellyNgSupportedDevicesResponseModel,
		'A list of supported Shelly NG devices was successfully retrieved. Each entry includes device specifications, available components, and supported categories.',
	)
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Supported devices list could not be retrieved')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('supported')
	async getSupported(): Promise<ShellyNgSupportedDevicesResponseModel> {
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

		const response = new ShellyNgSupportedDevicesResponseModel();
		response.data = devices;

		return response;
	}
}
