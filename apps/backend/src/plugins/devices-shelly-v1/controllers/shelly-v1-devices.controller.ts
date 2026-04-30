import { validate } from 'class-validator';

import { Body, Controller, Get, NotFoundException, Param, Post, UnprocessableEntityException } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import {
	DESCRIPTORS,
	DEVICES_SHELLY_V1_PLUGIN_API_TAG_NAME,
	DEVICES_SHELLY_V1_PLUGIN_NAME,
} from '../devices-shelly-v1.constants';
import { DevicesShellyV1Exception } from '../devices-shelly-v1.exceptions';
import { DevicesShellyV1PluginReqGetInfo } from '../dto/shelly-v1-probe.dto';
import {
	ShellyV1DeviceInfoResponseModel,
	ShellyV1DiscoverySessionResponseModel,
	ShellyV1SupportedDevicesResponseModel,
} from '../models/shelly-v1-response.model';
import {
	ShellyV1DeviceInfoModel,
	ShellyV1DiscoverySessionModel,
	ShellyV1SupportedDeviceModel,
} from '../models/shelly-v1.model';
import { ShellyV1DiscoveryService } from '../services/shelly-v1-discovery.service';
import { ShellyV1ProbeService } from '../services/shelly-v1-probe.service';

@ApiTags(DEVICES_SHELLY_V1_PLUGIN_API_TAG_NAME)
@Controller('devices')
export class ShellyV1DevicesController {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_V1_PLUGIN_NAME,
		'ShellyV1DevicesController',
	);

	constructor(
		private readonly probeService: ShellyV1ProbeService,
		private readonly discoveryService: ShellyV1DiscoveryService,
	) {}

	@ApiOperation({
		tags: [DEVICES_SHELLY_V1_PLUGIN_API_TAG_NAME],
		summary: 'Start Shelly V1 discovery wizard scan',
		description:
			'Starts a short-lived CoAP/mDNS discovery session for Shelly Generation 1 devices. The session can be polled by the admin wizard and enriched with manual host lookups.',
		operationId: 'create-devices-shelly-v1-plugin-discovery',
	})
	@ApiSuccessResponse(
		ShellyV1DiscoverySessionResponseModel,
		'Shelly V1 discovery session was started. The response includes session timing and discovered device candidates.',
	)
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('discovery')
	startDiscovery(): ShellyV1DiscoverySessionResponseModel {
		const response = new ShellyV1DiscoverySessionResponseModel();
		response.data = toInstance(ShellyV1DiscoverySessionModel, this.discoveryService.start({ duration: 30 }));

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_SHELLY_V1_PLUGIN_API_TAG_NAME],
		summary: 'Get Shelly V1 discovery wizard scan',
		description:
			'Returns the current state of a Shelly V1 discovery session, including remaining scan time and discovered device candidates.',
		operationId: 'get-devices-shelly-v1-plugin-discovery',
	})
	@ApiSuccessResponse(ShellyV1DiscoverySessionResponseModel, 'Shelly V1 discovery session was successfully retrieved.')
	@ApiNotFoundResponse('Discovery session could not be found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('discovery/:id')
	getDiscovery(@Param('id') id: string): ShellyV1DiscoverySessionResponseModel {
		const session = this.discoveryService.get(id);

		if (session === null) {
			throw new NotFoundException('Discovery session could not be found');
		}

		const response = new ShellyV1DiscoverySessionResponseModel();
		response.data = toInstance(ShellyV1DiscoverySessionModel, session);

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_SHELLY_V1_PLUGIN_API_TAG_NAME],
		summary: 'Add a manual Shelly V1 discovery wizard lookup',
		description:
			'Adds a manually entered hostname or IP address to an existing Shelly V1 discovery session. Password-protected devices can be verified by providing their password.',
		operationId: 'create-devices-shelly-v1-plugin-discovery-manual',
	})
	@ApiBody({
		type: DevicesShellyV1PluginReqGetInfo,
		description: 'Manual Shelly V1 discovery lookup data',
	})
	@ApiSuccessResponse(
		ShellyV1DiscoverySessionResponseModel,
		'Manual lookup was added to the Shelly V1 discovery session.',
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiNotFoundResponse('Discovery session could not be found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('discovery/:id/manual')
	async addManualDiscoveryDevice(
		@Param('id') id: string,
		@Body() createDto: DevicesShellyV1PluginReqGetInfo,
	): Promise<ShellyV1DiscoverySessionResponseModel> {
		const session = await this.discoveryService.manual(id, {
			hostname: createDto.data.hostname,
			password: createDto.data.password,
		});

		if (session === null) {
			throw new NotFoundException('Discovery session could not be found');
		}

		const response = new ShellyV1DiscoverySessionResponseModel();
		response.data = toInstance(ShellyV1DiscoverySessionModel, session);

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_SHELLY_V1_PLUGIN_API_TAG_NAME],
		summary: 'Fetch information about a Shelly V1 device',
		description:
			'Retrieves detailed information about a Shelly Generation 1 device by connecting to it using the provided hostname or IP address. The response includes device identification, firmware version, authentication settings, and reachability status.',
		operationId: 'create-devices-shelly-v1-plugin-device-info',
	})
	@ApiBody({
		type: DevicesShellyV1PluginReqGetInfo,
		description: 'The data required to fetch device information',
	})
	@ApiSuccessResponse(
		ShellyV1DeviceInfoResponseModel,
		'Device information was successfully retrieved. The response includes device identification, firmware version, authentication settings, and reachability status.',
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiNotFoundResponse('Device info could not be fetched')
	@ApiUnprocessableEntityResponse('Device info model could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('info')
	async getInfo(@Body() createDto: DevicesShellyV1PluginReqGetInfo): Promise<ShellyV1DeviceInfoResponseModel> {
		this.logger.debug(`Incoming request to probe device at ${createDto.data.hostname}`);

		let probeResult: ShellyV1DeviceInfoModel;

		try {
			probeResult = await this.probeService.probeDevice(createDto.data);
		} catch (error) {
			this.logger.error(`Probe failed: ${error instanceof Error ? error.message : String(error)}`);

			if (error instanceof DevicesShellyV1Exception) {
				// Return a failed probe result instead of throwing
				probeResult = {
					reachable: false,
					authRequired: false,
					host: createDto.data.hostname,
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
			this.logger.error(`Validation failed: ${JSON.stringify(errors)}`);

			throw new UnprocessableEntityException('Device info model could not be created');
		}

		this.logger.debug(`Probe completed for ${createDto.data.hostname}. Reachable: ${shellyProbeResult.reachable}`);

		const response = new ShellyV1DeviceInfoResponseModel();
		response.data = shellyProbeResult;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_SHELLY_V1_PLUGIN_API_TAG_NAME],
		summary: 'Get list of supported Shelly V1 devices',
		description:
			'Retrieves a comprehensive list of all Shelly Generation 1 device models that are supported by this plugin. Each entry includes device specifications and supported categories.',
		operationId: 'get-devices-shelly-v1-plugin-supported',
	})
	@ApiSuccessResponse(
		ShellyV1SupportedDevicesResponseModel,
		'A list of supported Shelly V1 devices was successfully retrieved. Each entry includes device specifications and supported categories.',
	)
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Supported devices list could not be retrieved')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('supported')
	async getSupported(): Promise<ShellyV1SupportedDevicesResponseModel> {
		this.logger.debug('Incoming request to get Shelly V1 supported devices list');

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
				this.logger.error(`Validation failed: ${JSON.stringify(errors)}`);

				continue;
			}

			devices.push(deviceSpec);
		}

		const response = new ShellyV1SupportedDevicesResponseModel();
		response.data = devices;

		return response;
	}
}
