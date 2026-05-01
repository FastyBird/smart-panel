import { Body, Controller, Delete, Get, Param, Post, UnprocessableEntityException } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { DeviceResponseModel } from '../../../modules/devices/models/devices-response.model';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import {
	DEVICES_ZIGBEE_HERDSMAN_API_TAG_NAME,
	DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
	DEVICES_ZIGBEE_HERDSMAN_TYPE,
	extractExposeInfo,
	mapZhCategoryToDeviceCategory,
} from '../devices-zigbee-herdsman.constants';
import { ZigbeeHerdsmanCoordinatorOfflineException } from '../devices-zigbee-herdsman.exceptions';
import {
	ReqZhAdoptDeviceDto,
	ReqZhMappingPreviewDto,
	ReqZhPermitJoinDto,
	ZhAdoptDeviceRequestDto,
	ZhMappingPreviewRequestDto,
} from '../dto/mapping-preview.dto';
import { ZigbeeHerdsmanDeviceEntity } from '../entities/devices-zigbee-herdsman.entity';
import { ZhDiscoveredDevice } from '../interfaces/zigbee-herdsman.interface';
import {
	ZhCoordinatorInfoModel,
	ZhCoordinatorInfoResponseModel,
	ZhExposeInfoModel,
	ZhMappingPreviewModel,
	ZhMappingPreviewResponseModel,
	ZhPermitJoinModel,
	ZhPermitJoinResponseModel,
	ZigbeeHerdsmanDiscoveredDeviceModel,
	ZigbeeHerdsmanDiscoveredDeviceResponseModel,
	ZigbeeHerdsmanDiscoveredDevicesResponseModel,
} from '../models/zigbee-herdsman-response.model';
import { ZhDeviceAdoptionService } from '../services/device-adoption.service';
import { ZhMappingPreviewService } from '../services/mapping-preview.service';
import { ZigbeeHerdsmanService } from '../services/zigbee-herdsman.service';

@ApiTags(DEVICES_ZIGBEE_HERDSMAN_API_TAG_NAME)
@Controller('discovered-devices')
export class ZigbeeHerdsmanDiscoveredDevicesController {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
		'DiscoveredDevicesController',
	);

	constructor(
		private readonly zigbeeHerdsmanService: ZigbeeHerdsmanService,
		private readonly mappingPreviewService: ZhMappingPreviewService,
		private readonly deviceAdoptionService: ZhDeviceAdoptionService,
		private readonly devicesService: DevicesService,
	) {}

	// =========================================================================
	// Static routes — must be declared before parameterized (:ieeeAddress) routes
	// to prevent NestJS from treating 'coordinator-info' as an :ieeeAddress param.
	// =========================================================================

	@ApiOperation({
		tags: [DEVICES_ZIGBEE_HERDSMAN_API_TAG_NAME],
		summary: 'Retrieve all discovered Zigbee devices',
		description: 'Fetches a list of all Zigbee devices discovered via the zigbee-herdsman coordinator.',
		operationId: 'get-devices-zigbee-herdsman-plugin-devices',
	})
	@ApiSuccessResponse(
		ZigbeeHerdsmanDiscoveredDevicesResponseModel,
		'A list of discovered Zigbee devices successfully retrieved',
	)
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiUnprocessableEntityResponse('Zigbee coordinator is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(): Promise<ZigbeeHerdsmanDiscoveredDevicesResponseModel> {
		this.logger.debug('Fetching all discovered Zigbee devices');

		try {
			if (!this.zigbeeHerdsmanService.isCoordinatorOnline()) {
				throw new ZigbeeHerdsmanCoordinatorOfflineException();
			}

			const discoveredDevices = this.zigbeeHerdsmanService.getDiscoveredDevices();
			const adoptedDevices =
				await this.devicesService.findAll<ZigbeeHerdsmanDeviceEntity>(DEVICES_ZIGBEE_HERDSMAN_TYPE);
			const adoptedAddresses = new Set(adoptedDevices.map((d) => d.ieeeAddress));

			const devices = discoveredDevices.map((d) =>
				this.transformToDiscoveredDevice(d, adoptedAddresses, adoptedDevices),
			);

			const response = new ZigbeeHerdsmanDiscoveredDevicesResponseModel();
			response.data = toInstance(ZigbeeHerdsmanDiscoveredDeviceModel, devices);
			return response;
		} catch (error) {
			if (error instanceof ZigbeeHerdsmanCoordinatorOfflineException) {
				throw new UnprocessableEntityException('Zigbee coordinator is offline');
			}
			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_ZIGBEE_HERDSMAN_API_TAG_NAME],
		summary: 'Get coordinator information',
		description: 'Returns information about the Zigbee coordinator including firmware version and network details.',
		operationId: 'get-devices-zigbee-herdsman-plugin-coordinator-info',
	})
	@ApiSuccessResponse(ZhCoordinatorInfoResponseModel, 'Coordinator info retrieved')
	@ApiUnprocessableEntityResponse('Coordinator offline')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('coordinator-info')
	async getCoordinatorInfo(): Promise<ZhCoordinatorInfoResponseModel> {
		if (!this.zigbeeHerdsmanService.isCoordinatorOnline()) {
			throw new UnprocessableEntityException('Zigbee coordinator is offline');
		}

		const info = await this.zigbeeHerdsmanService.getCoordinatorInfo();
		if (!info) {
			throw new UnprocessableEntityException('Could not retrieve coordinator information');
		}

		const result: ZhCoordinatorInfoModel = {
			type: info.type,
			ieeeAddress: info.ieeeAddress,
			firmwareVersion: info.firmwareVersion,
			channel: info.channel,
			panId: info.panId,
			pairedDeviceCount: info.pairedDeviceCount,
			permitJoin: this.zigbeeHerdsmanService.isPermitJoinEnabled(),
		};

		const response = new ZhCoordinatorInfoResponseModel();
		response.data = toInstance(ZhCoordinatorInfoModel, result);
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_ZIGBEE_HERDSMAN_API_TAG_NAME],
		summary: 'Adopt a Zigbee device',
		description: 'Creates a Smart Panel device from a Zigbee device based on the provided mapping.',
		operationId: 'adopt-devices-zigbee-herdsman-plugin-device',
	})
	@ApiBody({ type: ReqZhAdoptDeviceDto, description: 'Device adoption configuration' })
	@ApiCreatedSuccessResponse(DeviceResponseModel, 'Device adopted successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Zigbee device not found')
	@ApiUnprocessableEntityResponse('Device adoption failed')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('adopt')
	async adoptDevice(@Body() body: ReqZhAdoptDeviceDto): Promise<DeviceResponseModel> {
		this.logger.debug(`Adopting device ieeeAddress=${body.data.ieeeAddress}`);

		// Service throws HttpException subclasses (404, 422, 500) with correct
		// status codes — let NestJS handle them directly without re-wrapping.
		const request = toInstance(ZhAdoptDeviceRequestDto, body.data);
		const device = await this.deviceAdoptionService.adoptDevice(request);

		const response = new DeviceResponseModel();
		response.data = device;
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_ZIGBEE_HERDSMAN_API_TAG_NAME],
		summary: 'Enable or disable permit join',
		description: 'Controls whether new devices can join the Zigbee network.',
		operationId: 'permit-join-devices-zigbee-herdsman-plugin',
	})
	@ApiBody({ type: ReqZhPermitJoinDto, description: 'Permit join configuration' })
	@ApiSuccessResponse(ZhPermitJoinResponseModel, 'Permit join state updated')
	@ApiUnprocessableEntityResponse('Coordinator offline')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('permit-join')
	async permitJoin(@Body() body: ReqZhPermitJoinDto): Promise<ZhPermitJoinResponseModel> {
		this.logger.debug(`Setting permit join: enabled=${body.data.enabled}`);

		try {
			if (!this.zigbeeHerdsmanService.isCoordinatorOnline()) {
				throw new ZigbeeHerdsmanCoordinatorOfflineException();
			}

			await this.zigbeeHerdsmanService.permitJoin(body.data.enabled, body.data.timeout);

			const result: ZhPermitJoinModel = {
				enabled: body.data.enabled,
				timeout: body.data.enabled ? (body.data.timeout ?? 254) : 0,
			};

			const response = new ZhPermitJoinResponseModel();
			response.data = toInstance(ZhPermitJoinModel, result);
			return response;
		} catch (error) {
			if (error instanceof ZigbeeHerdsmanCoordinatorOfflineException) {
				throw new UnprocessableEntityException('Zigbee coordinator is offline');
			}
			throw error;
		}
	}

	// =========================================================================
	// Parameterized routes — after static routes to avoid shadowing.
	// =========================================================================

	@ApiOperation({
		tags: [DEVICES_ZIGBEE_HERDSMAN_API_TAG_NAME],
		summary: 'Preview device mapping',
		description: 'Generates a preview of how a Zigbee device would be mapped to Smart Panel entities.',
		operationId: 'preview-devices-zigbee-herdsman-plugin-device-mapping',
	})
	@ApiParam({ name: 'ieeeAddress', type: 'string', description: 'Device IEEE address' })
	@ApiBody({ type: ReqZhMappingPreviewDto, required: false, description: 'Optional mapping overrides' })
	@ApiSuccessResponse(ZhMappingPreviewResponseModel, 'Mapping preview generated successfully')
	@ApiNotFoundResponse('Zigbee device not found')
	@ApiUnprocessableEntityResponse('Zigbee coordinator is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':ieeeAddress/preview-mapping')
	async previewMapping(
		@Param('ieeeAddress') ieeeAddress: string,
		@Body() body?: ReqZhMappingPreviewDto,
	): Promise<ZhMappingPreviewResponseModel> {
		this.logger.debug(`Previewing mapping for device ieeeAddress=${ieeeAddress}`);

		// Service throws HttpException subclasses (404, 422) — let NestJS handle them directly.
		const request = body?.data ? toInstance(ZhMappingPreviewRequestDto, body.data) : undefined;
		const preview = await this.mappingPreviewService.generatePreview(ieeeAddress, request);

		const response = new ZhMappingPreviewResponseModel();
		response.data = toInstance(ZhMappingPreviewModel, preview);
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_ZIGBEE_HERDSMAN_API_TAG_NAME],
		summary: 'Remove a device from the Zigbee network',
		description: 'Removes a device from the Zigbee network and optionally deletes the Smart Panel entity.',
		operationId: 'remove-devices-zigbee-herdsman-plugin-device',
	})
	@ApiParam({ name: 'ieeeAddress', type: 'string', description: 'Device IEEE address' })
	@ApiSuccessResponse(ZigbeeHerdsmanDiscoveredDeviceResponseModel, 'Device removed successfully')
	@ApiNotFoundResponse('Device not found')
	@ApiUnprocessableEntityResponse('Coordinator offline')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':ieeeAddress')
	async removeDevice(@Param('ieeeAddress') ieeeAddress: string): Promise<void> {
		this.logger.debug(`Removing device ieeeAddress=${ieeeAddress}`);

		if (!this.zigbeeHerdsmanService.isCoordinatorOnline()) {
			throw new UnprocessableEntityException('Zigbee coordinator is offline');
		}

		try {
			await this.zigbeeHerdsmanService.removeDevice(ieeeAddress);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to remove device ${ieeeAddress}`, {
				message: err.message,
				stack: err.stack,
			});

			throw new UnprocessableEntityException(`Failed to remove device: ${err.message}`);
		}
	}

	// =========================================================================
	// Private helpers
	// =========================================================================

	private transformToDiscoveredDevice(
		discovered: ZhDiscoveredDevice,
		adoptedAddresses: Set<string>,
		adoptedDevices: ZigbeeHerdsmanDeviceEntity[],
	): ZigbeeHerdsmanDiscoveredDeviceModel {
		const isAdopted = adoptedAddresses.has(discovered.ieeeAddress);
		const adoptedDevice = adoptedDevices.find((d) => d.ieeeAddress === discovered.ieeeAddress);

		let suggestedCategory: DeviceCategory | undefined = undefined;
		if (discovered.definition) {
			const { exposeTypes, propertyNames } = extractExposeInfo(discovered.definition.exposes);
			suggestedCategory = mapZhCategoryToDeviceCategory(exposeTypes, propertyNames);
		}

		const exposes: ZhExposeInfoModel[] = [];
		if (discovered.definition?.exposes) {
			for (const expose of discovered.definition.exposes) {
				exposes.push({
					type: expose.type,
					name: expose.name,
					property: expose.property,
					label: expose.label,
					access: expose.access,
					unit: 'unit' in expose ? (expose as { unit?: string }).unit : undefined,
				});

				// For composite types (light, switch, climate, etc.), also include
				// nested features so the API consumer can see actual capabilities.
				if ('features' in expose && Array.isArray(expose.features)) {
					for (const feature of expose.features as Array<{
						type: string;
						name?: string;
						property?: string;
						label?: string;
						access?: number;
						unit?: string;
					}>) {
						exposes.push({
							type: feature.type,
							name: feature.name ?? feature.property,
							property: feature.property,
							label: feature.label,
							access: feature.access,
							unit: feature.unit,
						});
					}
				}
			}
		}

		return {
			ieeeAddress: discovered.ieeeAddress,
			friendlyName: discovered.friendlyName,
			type: discovered.type,
			modelId: discovered.modelId ?? undefined,
			manufacturer: discovered.definition?.vendor,
			model: discovered.definition?.model,
			description: discovered.definition?.description,
			powerSource: discovered.powerSource ?? undefined,
			interviewStatus: discovered.interviewStatus,
			available: discovered.available,
			adopted: isAdopted,
			adoptedDeviceId: adoptedDevice?.id,
			exposes,
			suggestedCategory,
		};
	}
}
