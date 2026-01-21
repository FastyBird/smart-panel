import { validate } from 'class-validator';
import { FetchError } from 'node-fetch';

import { Body, Controller, Get, NotFoundException, Post, UnprocessableEntityException } from '@nestjs/common';
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
	DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME,
	DEVICES_SHELLY_NG_PLUGIN_NAME,
} from '../devices-shelly-ng.constants';
import { DevicesShellyNgException } from '../devices-shelly-ng.exceptions';
import { DevicesShellyNgPluginReqGetInfo } from '../dto/shelly-ng-get-info.dto';
import { MappingLoaderService } from '../mappings';
import {
	ShellyNgDeviceInfoResponseModel,
	ShellyNgMappingReloadResponseModel,
	ShellyNgSupportedDevicesResponseModel,
} from '../models/shelly-ng-response.model';
import { ShellyNgDeviceInfoModel, ShellyNgSupportedDeviceModel } from '../models/shelly-ng.model';
import { DeviceManagerService } from '../services/device-manager.service';

@ApiTags(DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME)
@Controller('devices')
export class ShellyNgDevicesController {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_NG_PLUGIN_NAME,
		'ShellyNgDevicesController',
	);

	constructor(
		private readonly deviceManagerService: DeviceManagerService,
		private readonly mappingLoaderService: MappingLoaderService,
	) {}

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
			this.logger.error(`Validation failed: ${JSON.stringify(errors)}`);

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
				this.logger.error(`Validation failed: ${JSON.stringify(errors)}`);

				continue;
			}

			devices.push(deviceSpec);
		}

		const response = new ShellyNgSupportedDevicesResponseModel();
		response.data = devices;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME],
		summary: 'Reload YAML mapping configurations',
		description:
			'Reloads all YAML mapping configuration files from built-in and user directories. This is useful after modifying custom mapping files without restarting the application. The cache is cleared before reloading. Returns validation results including any errors or warnings encountered during reload.',
		operationId: 'post-devices-shelly-ng-plugin-reload-mappings',
	})
	@ApiSuccessResponse(
		ShellyNgMappingReloadResponseModel,
		'Mapping configurations reload operation completed. Returns statistics about loaded mappings, cache status, and any validation errors or warnings.',
	)
	@ApiInternalServerErrorResponse('Internal server error during mapping reload')
	@Post('mappings/reload')
	reloadMappings(): ShellyNgMappingReloadResponseModel {
		try {
			const reloadResult = this.mappingLoaderService.reload();
			const cacheStats = this.mappingLoaderService.getCacheStats();
			const loadResults = this.mappingLoaderService.getLoadResults();

			// Collect all errors and warnings for detailed reporting
			const allErrors: string[] = [];
			const allWarnings: string[] = [];

			for (const result of loadResults) {
				if (result.errors) {
					allErrors.push(...result.errors.map((e) => `${result.source}: ${e}`));
				}
				if (result.warnings) {
					allWarnings.push(...result.warnings.map((w) => `${result.source}: ${w}`));
				}
			}

			if (reloadResult.success) {
				this.logger.log('Mapping configurations reloaded successfully', {
					mappingsLoaded: reloadResult.mappingsLoaded,
					filesLoaded: reloadResult.filesLoaded,
					warnings: reloadResult.warnings,
					cacheSize: cacheStats.size,
				});
			} else {
				this.logger.warn('Mapping configurations reloaded with errors', {
					mappingsLoaded: reloadResult.mappingsLoaded,
					filesLoaded: reloadResult.filesLoaded,
					filesFailed: reloadResult.filesFailed,
					errors: reloadResult.errors,
					warnings: reloadResult.warnings,
					errorDetails: allErrors.slice(0, 10), // Limit to first 10 errors in log
				});
			}

			const response = new ShellyNgMappingReloadResponseModel();
			response.data = {
				success: reloadResult.success,
				cacheStats,
				reloadStats: {
					mappingsLoaded: reloadResult.mappingsLoaded,
					filesLoaded: reloadResult.filesLoaded,
					filesFailed: reloadResult.filesFailed,
					errors: reloadResult.errors,
					warnings: reloadResult.warnings,
					errorDetails: allErrors.length > 0 ? allErrors : undefined,
					warningDetails: allWarnings.length > 0 ? allWarnings : undefined,
				},
			};

			return response;
		} catch (error) {
			this.logger.error('Failed to reload mapping configurations', {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});

			throw new UnprocessableEntityException('Failed to reload mapping configurations');
		}
	}
}
