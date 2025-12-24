import { Body, Controller, Get, NotFoundException, Param, Post, UnprocessableEntityException } from '@nestjs/common';
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
	DEVICES_ZIGBEE2MQTT_API_TAG_NAME,
	DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
	DEVICES_ZIGBEE2MQTT_TYPE,
	mapZ2mCategoryToDeviceCategory,
} from '../devices-zigbee2mqtt.constants';
import {
	DevicesZigbee2mqttException,
	DevicesZigbee2mqttNotFoundException,
	DevicesZigbee2mqttValidationException,
	Zigbee2mqttBridgeOfflineException,
} from '../devices-zigbee2mqtt.exceptions';
import {
	AdoptDeviceRequestDto,
	MappingPreviewRequestDto,
	ReqAdoptDeviceDto,
	ReqMappingPreviewDto,
} from '../dto/mapping-preview.dto';
import { Zigbee2mqttDeviceEntity } from '../entities/devices-zigbee2mqtt.entity';
import { Z2mRegisteredDevice } from '../interfaces/zigbee2mqtt.interface';
import {
	Z2mExposeInfoModel,
	Z2mMappingPreviewModel,
	Z2mMappingPreviewResponseModel,
	Zigbee2mqttDiscoveredDeviceModel,
	Zigbee2mqttDiscoveredDeviceResponseModel,
	Zigbee2mqttDiscoveredDevicesResponseModel,
} from '../models/zigbee2mqtt-response.model';
import { Z2mDeviceAdoptionService } from '../services/device-adoption.service';
import { Z2mMappingPreviewService } from '../services/mapping-preview.service';
import { Zigbee2mqttService } from '../services/zigbee2mqtt.service';

@ApiTags(DEVICES_ZIGBEE2MQTT_API_TAG_NAME)
@Controller('discovered-devices')
export class Zigbee2mqttDiscoveredDevicesController {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'DiscoveredDevicesController',
	);

	constructor(
		private readonly zigbee2mqttService: Zigbee2mqttService,
		private readonly mappingPreviewService: Z2mMappingPreviewService,
		private readonly deviceAdoptionService: Z2mDeviceAdoptionService,
		private readonly devicesService: DevicesService,
	) {}

	@ApiOperation({
		tags: [DEVICES_ZIGBEE2MQTT_API_TAG_NAME],
		summary: 'Retrieve all Zigbee2MQTT discovered devices',
		description:
			'Fetches a list of all Zigbee2MQTT discovered devices that can be adopted into the Smart Panel ecosystem.',
		operationId: 'get-devices-zigbee2mqtt-plugin-devices',
	})
	@ApiSuccessResponse(
		Zigbee2mqttDiscoveredDevicesResponseModel,
		'A list of Zigbee2MQTT discovered devices successfully retrieved',
	)
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Zigbee2MQTT discovered devices could not be loaded')
	@ApiUnprocessableEntityResponse('Devices Zigbee2MQTT plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(): Promise<Zigbee2mqttDiscoveredDevicesResponseModel> {
		this.logger.debug('Fetching all Zigbee2MQTT discovered devices');

		try {
			// Check if bridge is online
			if (!this.zigbee2mqttService.isBridgeOnline()) {
				throw new Zigbee2mqttBridgeOfflineException();
			}

			// Get registered devices from Z2M
			const registeredDevices = this.zigbee2mqttService.getRegisteredDevices();

			// Get already adopted devices
			const adoptedDevices = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);
			const adoptedIdentifiers = new Set(adoptedDevices.map((d) => d.identifier));

			// Transform to response model
			const devices = registeredDevices.map((d) =>
				this.transformToDiscoveredDevice(d, adoptedIdentifiers, adoptedDevices),
			);

			this.logger.debug(`Retrieved ${devices.length} discovered devices`);

			const response = new Zigbee2mqttDiscoveredDevicesResponseModel();
			response.data = toInstance(Zigbee2mqttDiscoveredDeviceModel, devices);
			return response;
		} catch (error) {
			const err = error as Error;

			if (error instanceof Zigbee2mqttBridgeOfflineException) {
				throw new UnprocessableEntityException('Zigbee2MQTT bridge is offline');
			}

			this.logger.error('Loading Zigbee2MQTT discovered devices failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_ZIGBEE2MQTT_API_TAG_NAME],
		summary: 'Retrieve a Zigbee2MQTT discovered device by IEEE address',
		description: 'Fetches a specific Zigbee2MQTT discovered device by its IEEE address.',
		operationId: 'get-devices-zigbee2mqtt-plugin-device',
	})
	@ApiParam({ name: 'ieeeAddress', type: 'string', description: 'Device IEEE address' })
	@ApiSuccessResponse(
		Zigbee2mqttDiscoveredDeviceResponseModel,
		'A Zigbee2MQTT discovered device successfully retrieved',
	)
	@ApiBadRequestResponse('Invalid device IEEE address format')
	@ApiNotFoundResponse('Zigbee2MQTT discovered device not found')
	@ApiUnprocessableEntityResponse('Devices Zigbee2MQTT plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':ieeeAddress')
	async findOne(@Param('ieeeAddress') ieeeAddress: string): Promise<Zigbee2mqttDiscoveredDeviceResponseModel> {
		this.logger.debug(`Fetching Zigbee2MQTT discovered device ieeeAddress=${ieeeAddress}`);

		try {
			// Check if bridge is online
			if (!this.zigbee2mqttService.isBridgeOnline()) {
				throw new Zigbee2mqttBridgeOfflineException();
			}

			// Find device
			const registeredDevices = this.zigbee2mqttService.getRegisteredDevices();
			const z2mDevice = registeredDevices.find((d) => d.ieeeAddress === ieeeAddress);

			if (!z2mDevice) {
				throw new DevicesZigbee2mqttNotFoundException(`Zigbee2MQTT device with IEEE address ${ieeeAddress} not found`);
			}

			// Get already adopted devices
			const adoptedDevices = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);
			const adoptedIdentifiers = new Set(adoptedDevices.map((d) => d.identifier));

			const device = this.transformToDiscoveredDevice(z2mDevice, adoptedIdentifiers, adoptedDevices);

			this.logger.debug(`Found Zigbee2MQTT discovered device ieeeAddress=${z2mDevice.ieeeAddress}`);

			const response = new Zigbee2mqttDiscoveredDeviceResponseModel();
			response.data = toInstance(Zigbee2mqttDiscoveredDeviceModel, device);
			return response;
		} catch (error) {
			const err = error as Error;

			if (error instanceof Zigbee2mqttBridgeOfflineException) {
				throw new UnprocessableEntityException('Zigbee2MQTT bridge is offline');
			} else if (error instanceof DevicesZigbee2mqttNotFoundException) {
				throw new NotFoundException(err.message);
			}

			this.logger.error('Loading Zigbee2MQTT discovered device failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_ZIGBEE2MQTT_API_TAG_NAME],
		summary: 'Preview device mapping',
		description:
			'Generates a preview of how a Zigbee2MQTT device would be mapped to Smart Panel entities. ' +
			'Returns suggested device category, channels, and properties, along with any warnings.',
		operationId: 'preview-devices-zigbee2mqtt-plugin-device-mapping',
	})
	@ApiParam({ name: 'ieeeAddress', type: 'string', description: 'Device IEEE address' })
	@ApiBody({ type: ReqMappingPreviewDto, required: false, description: 'Optional mapping overrides' })
	@ApiSuccessResponse(Z2mMappingPreviewResponseModel, 'Mapping preview generated successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Zigbee2MQTT device not found')
	@ApiUnprocessableEntityResponse('Devices Zigbee2MQTT plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':ieeeAddress/preview-mapping')
	async previewMapping(
		@Param('ieeeAddress') ieeeAddress: string,
		@Body() body?: ReqMappingPreviewDto,
	): Promise<Z2mMappingPreviewResponseModel> {
		this.logger.debug(`Previewing mapping for device ieeeAddress=${ieeeAddress}`);

		try {
			const request = body?.data ? toInstance(MappingPreviewRequestDto, body.data) : undefined;
			const preview = await this.mappingPreviewService.generatePreview(ieeeAddress, request);

			this.logger.debug(
				`Generated mapping preview for device ieeeAddress=${ieeeAddress}, ` +
					`exposes=${preview.exposes.length}, warnings=${preview.warnings.length}, ` +
					`readyToAdopt=${preview.readyToAdopt}`,
			);

			const response = new Z2mMappingPreviewResponseModel();
			response.data = toInstance(Z2mMappingPreviewModel, preview);
			return response;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesZigbee2mqttValidationException) {
				this.logger.error('Devices Zigbee2MQTT plugin validation error', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException(err.message);
			} else if (error instanceof DevicesZigbee2mqttNotFoundException) {
				throw new NotFoundException(err.message);
			}

			this.logger.error('Generating mapping preview failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_ZIGBEE2MQTT_API_TAG_NAME],
		summary: 'Adopt a Zigbee2MQTT device',
		description:
			'Creates a Smart Panel device from a Zigbee2MQTT device based on the provided mapping configuration. ' +
			'This will create the device, channels, and properties in the Smart Panel system.',
		operationId: 'adopt-devices-zigbee2mqtt-plugin-device',
	})
	@ApiBody({ type: ReqAdoptDeviceDto, description: 'Device adoption configuration' })
	@ApiCreatedSuccessResponse(DeviceResponseModel, 'Device adopted successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Zigbee2MQTT device not found')
	@ApiUnprocessableEntityResponse('Device adoption failed due to validation errors or already adopted')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('adopt')
	async adoptDevice(@Body() body: ReqAdoptDeviceDto): Promise<DeviceResponseModel> {
		this.logger.debug(`Adopting device ieeeAddress=${body.data.ieeeAddress}`);

		try {
			const request = toInstance(AdoptDeviceRequestDto, body.data);
			const device = await this.deviceAdoptionService.adoptDevice(request);

			this.logger.debug(`Adopted device ieeeAddress=${body.data.ieeeAddress} as device id=${device.id}`);

			const response = new DeviceResponseModel();
			response.data = device;
			return response;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesZigbee2mqttValidationException) {
				this.logger.error('Device adoption validation failed', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException(err.message);
			} else if (error instanceof DevicesZigbee2mqttNotFoundException) {
				throw new NotFoundException(err.message);
			} else if (error instanceof DevicesZigbee2mqttException) {
				this.logger.error('Device adoption failed', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException(err.message);
			}

			this.logger.error('Device adoption failed with unexpected error', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}

	/**
	 * Transform Z2M registered device to discovered device model
	 */
	private transformToDiscoveredDevice(
		z2mDevice: Z2mRegisteredDevice,
		adoptedIdentifiers: Set<string | null>,
		adoptedDevices: Zigbee2mqttDeviceEntity[],
	): Zigbee2mqttDiscoveredDeviceModel {
		const isAdopted = adoptedIdentifiers.has(z2mDevice.friendlyName);
		const adoptedDevice = adoptedDevices.find((d) => d.identifier === z2mDevice.friendlyName);

		// Calculate suggested category
		let suggestedCategory: DeviceCategory | undefined;
		if (z2mDevice.definition) {
			const exposeTypes = z2mDevice.definition.exposes.map((e) => e.type);
			const propertyNames = z2mDevice.definition.exposes
				.filter((e): e is typeof e & { property: string } => !!e.property)
				.map((e) => e.property);
			suggestedCategory = mapZ2mCategoryToDeviceCategory(exposeTypes, propertyNames);
		}

		// Build exposes info
		const exposes: Z2mExposeInfoModel[] = [];
		if (z2mDevice.definition?.exposes) {
			for (const expose of z2mDevice.definition.exposes) {
				exposes.push({
					type: expose.type,
					name: expose.name,
					property: expose.property,
					label: expose.label,
					access: expose.access,
					unit: 'unit' in expose ? (expose as { unit?: string }).unit : undefined,
				});
			}
		}

		return {
			ieeeAddress: z2mDevice.ieeeAddress,
			friendlyName: z2mDevice.friendlyName,
			type: z2mDevice.type,
			modelId: z2mDevice.modelId,
			manufacturer: z2mDevice.definition?.vendor,
			model: z2mDevice.definition?.model,
			description: z2mDevice.definition?.description,
			powerSource: z2mDevice.powerSource,
			supported: z2mDevice.supported,
			available: z2mDevice.available,
			adopted: isAdopted,
			adoptedDeviceId: adoptedDevice?.id,
			exposes,
			suggestedCategory,
		};
	}
}
