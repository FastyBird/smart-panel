import { validate } from 'class-validator';

import { Body, Controller, Get, Logger, Post, UnprocessableEntityException } from '@nestjs/common';
import { ApiBody, ApiOperation } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessArrayResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/api/decorators/api-documentation.decorator';
import { ApiTag } from '../../../modules/api/decorators/api-tag.decorator';
import { toInstance } from '../../../common/utils/transform.utils';
import {
	DEVICES_SHELLY_V1_PLUGIN_API_TAG_DESCRIPTION,
	DEVICES_SHELLY_V1_PLUGIN_API_TAG_NAME,
	DEVICES_SHELLY_V1_PLUGIN_NAME,
} from '../devices-shelly-v1.constants';
import { DESCRIPTORS } from '../devices-shelly-v1.constants';
import { DevicesShellyV1Exception } from '../devices-shelly-v1.exceptions';
import {
	DevicesShellyV1PluginCreateDeviceInfo,
	DevicesShellyV1PluginReqCreateDeviceInfo,
	ShellyV1ProbeDto,
} from '../dto/shelly-v1-probe.dto';
import {
	ShellyV1DeviceInfoResponseModel,
	ShellyV1SupportedDevicesResponseModel,
} from '../models/shelly-v1-response.model';
import {
	DevicesShellyV1PluginDeviceInfo,
	DevicesShellyV1PluginSupportedDevice,
	ShellyV1DeviceInfoModel,
	ShellyV1SupportedDeviceModel,
} from '../models/shelly-v1.model';
import { ShellyV1ProbeService } from '../services/shelly-v1-probe.service';

@ApiTag({
	tagName: DEVICES_SHELLY_V1_PLUGIN_NAME,
	displayName: DEVICES_SHELLY_V1_PLUGIN_API_TAG_NAME,
	description: DEVICES_SHELLY_V1_PLUGIN_API_TAG_DESCRIPTION,
})
@Controller('devices')
export class ShellyV1DevicesController {
	private readonly logger = new Logger(ShellyV1DevicesController.name);

	constructor(private readonly probeService: ShellyV1ProbeService) {}

	@Post('info')
	@ApiOperation({ summary: 'Probe a Shelly V1 device to retrieve device information' })
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				data: {
					$ref: '#/components/schemas/DevicesShellyV1PluginShellyV1Probe',
				},
			},
			required: ['data'],
		},
	})
	@ApiSuccessResponse(ShellyV1DeviceInfoModel, 'Device probed successfully')
	@ApiBadRequestResponse('Invalid request data')
	@ApiUnprocessableEntityResponse('Probe result model could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	async getInfo(@Body() body: { data: ShellyV1ProbeDto }): Promise<ShellyV1DeviceInfoModel> {
		this.logger.debug(`[SHELLY V1][DEVICES CONTROLLER] Incoming request to probe device at ${body.data.host}`);

		let probeResult: ShellyV1DeviceInfoModel;

		try {
			probeResult = await this.probeService.probeDevice(body.data);
		} catch (error) {
			this.logger.error(
				`[SHELLY V1][DEVICES CONTROLLER] Probe failed: ${error instanceof Error ? error.message : String(error)}`,
			);

			if (error instanceof DevicesShellyV1Exception) {
				// Return a failed probe result instead of throwing
				probeResult = {
					reachable: false,
					authRequired: false,
					host: body.data.host,
				};
			} else {
				throw error;
			}
		}

		const shellyProbeResult = toInstance(ShellyV1DeviceInfoModel, probeResult);

		const errors = await validate(shellyProbeResult, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[SHELLY V1][DEVICES CONTROLLER] Validation failed: ${JSON.stringify(errors)}`);

			throw new UnprocessableEntityException('Probe result model could not be created');
		}

		this.logger.debug(
			`[SHELLY V1][DEVICES CONTROLLER] Probe completed for ${body.data.host}. Reachable: ${shellyProbeResult.reachable}`,
		);

		return shellyProbeResult;
	}

	@Get('supported')
	@ApiOperation({ summary: 'Get list of supported Shelly V1 devices' })
	@ApiSuccessArrayResponse(ShellyV1SupportedDeviceModel, 'List of supported devices retrieved successfully')
	@ApiInternalServerErrorResponse('Internal server error')
	async getSupported(): Promise<ShellyV1SupportedDeviceModel[]> {
		this.logger.debug('[SHELLY V1][DEVICES CONTROLLER] Incoming request to get Shelly V1 supported devices list');

		const devices: ShellyV1SupportedDeviceModel[] = [];

		for (const [group, spec] of Object.entries(DESCRIPTORS)) {
			const deviceSpec = toInstance(ShellyV1SupportedDeviceModel, {
				...spec,
				group,
			});

			const errors = await validate(deviceSpec, {
				whitelist: true,
				forbidNonWhitelisted: true,
				stopAtFirstError: false,
			});

			if (errors.length > 0) {
				this.logger.error(`[SHELLY V1][DEVICES CONTROLLER] Validation failed: ${JSON.stringify(errors)}`);

				continue;
			}

			devices.push(deviceSpec);
		}

		return devices;
	}
}
