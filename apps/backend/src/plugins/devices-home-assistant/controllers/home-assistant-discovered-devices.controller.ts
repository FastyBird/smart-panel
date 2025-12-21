import { Body, Controller, Get, NotFoundException, Param, Post, UnprocessableEntityException } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { DeviceResponseModel } from '../../../modules/devices/models/devices-response.model';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import {
	DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME,
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
} from '../devices-home-assistant.constants';
import {
	DevicesHomeAssistantException,
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { AdoptDeviceRequestDto, MappingPreviewRequestDto } from '../dto/mapping-preview.dto';
import {
	HomeAssistantDiscoveredDeviceResponseModel,
	HomeAssistantDiscoveredDevicesResponseModel,
} from '../models/home-assistant-response.model';
import { MappingPreviewResponseModel } from '../models/mapping-preview.model';
import { DeviceAdoptionService } from '../services/device-adoption.service';
import { HomeAssistantHttpService } from '../services/home-assistant.http.service';
import { MappingPreviewService } from '../services/mapping-preview.service';

@ApiTags(DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME)
@Controller('discovered-devices')
export class HomeAssistantDiscoveredDevicesController {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'HomeAssistantDiscoveredDevicesController',
	);

	constructor(
		private readonly homeAssistantHttpService: HomeAssistantHttpService,
		private readonly mappingPreviewService: MappingPreviewService,
		private readonly deviceAdoptionService: DeviceAdoptionService,
	) {}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME],
		summary: 'Retrieve all Home Assistant discovered devices',
		description:
			'Fetches a list of all Home Assistant discovered devices that can be adopted into the Smart Panel ecosystem.',
		operationId: 'get-devices-home-assistant-plugin-devices',
	})
	@ApiSuccessResponse(
		HomeAssistantDiscoveredDevicesResponseModel,
		'A list of Home Assistant discovered devices successfully retrieved',
	)
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Home Assistant discovered devices could not be loaded')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(): Promise<HomeAssistantDiscoveredDevicesResponseModel> {
		this.logger.debug('Fetching all Home Assistant discovered devices');

		try {
			const devices = await this.homeAssistantHttpService.getDiscoveredDevices();

			this.logger.debug(`Retrieved ${devices.length} discovered devices`);

			const response = new HomeAssistantDiscoveredDevicesResponseModel();
			response.data = devices;
			return response;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesHomeAssistantValidationException) {
				this.logger.error('Devices Home Assistant plugin is not properly configured', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException('Devices Home Assistant plugin is not properly configured');
			} else if (error instanceof DevicesHomeAssistantNotFoundException) {
				throw new NotFoundException(
					'Home Assistant discovered devices could not be loaded from Home Assistant instance',
				);
			}

			this.logger.error('Loading Home Assistant discovered devices failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME],
		summary: 'Retrieve a Home Assistant discovered device by ID',
		description: 'Fetches a specific Home Assistant discovered device by its identifier.',
		operationId: 'get-devices-home-assistant-plugin-device',
	})
	@ApiParam({ name: 'id', type: 'string', description: 'Discovered device ID' })
	@ApiSuccessResponse(
		HomeAssistantDiscoveredDeviceResponseModel,
		'A Home Assistant discovered device successfully retrieved',
	)
	@ApiBadRequestResponse('Invalid device ID format')
	@ApiNotFoundResponse('Home Assistant discovered device not found')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(@Param('id') id: string): Promise<HomeAssistantDiscoveredDeviceResponseModel> {
		this.logger.debug(`Fetching Home Assistant discovered device id=${id}`);

		try {
			const device = await this.homeAssistantHttpService.getDiscoveredDevice(id);

			this.logger.debug(`Found Home Assistant discovered device id=${device.id}`);

			const response = new HomeAssistantDiscoveredDeviceResponseModel();
			response.data = device;
			return response;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesHomeAssistantValidationException) {
				this.logger.error('Devices Home Assistant plugin is not properly configured', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException('Devices Home Assistant plugin is not properly configured');
			} else if (error instanceof DevicesHomeAssistantNotFoundException) {
				throw new NotFoundException(
					'Home Assistant discovered device could not be loaded from Home Assistant instance',
				);
			}

			this.logger.error('Loading Home Assistant discovered device failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME],
		summary: 'Preview device mapping',
		description:
			'Generates a preview of how a Home Assistant device would be mapped to Smart Panel entities. ' +
			'Returns suggested device category, channels, and properties, along with any warnings about missing required elements.',
		operationId: 'preview-devices-home-assistant-plugin-device-mapping',
	})
	@ApiParam({ name: 'id', type: 'string', description: 'Home Assistant device ID' })
	@ApiBody({ type: MappingPreviewRequestDto, required: false, description: 'Optional mapping overrides' })
	@ApiSuccessResponse(MappingPreviewResponseModel, 'Mapping preview generated successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Home Assistant device not found')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':id/preview-mapping')
	async previewMapping(
		@Param('id') id: string,
		@Body() body?: MappingPreviewRequestDto,
	): Promise<MappingPreviewResponseModel> {
		this.logger.debug(`Previewing mapping for device id=${id}`);

		try {
			const request = body ? toInstance(MappingPreviewRequestDto, body) : undefined;
			const preview = await this.mappingPreviewService.generatePreview(id, request);

			this.logger.debug(
				`Generated mapping preview for device id=${id}, entities=${preview.entities.length}, warnings=${preview.warnings.length}, readyToAdopt=${preview.readyToAdopt}`,
			);

			const response = new MappingPreviewResponseModel();
			response.data = preview;
			return response;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesHomeAssistantValidationException) {
				this.logger.error('Devices Home Assistant plugin is not properly configured', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException('Devices Home Assistant plugin is not properly configured');
			} else if (error instanceof DevicesHomeAssistantNotFoundException) {
				throw new NotFoundException(`Home Assistant device ${id} not found`);
			}

			this.logger.error('Generating mapping preview failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME],
		summary: 'Adopt a Home Assistant device',
		description:
			'Creates a Smart Panel device from a Home Assistant device based on the provided mapping configuration. ' +
			'This will create the device, channels, and properties in the Smart Panel system.',
		operationId: 'adopt-devices-home-assistant-plugin-device',
	})
	@ApiBody({ type: AdoptDeviceRequestDto, description: 'Device adoption configuration' })
	@ApiCreatedSuccessResponse(DeviceResponseModel, 'Device adopted successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Home Assistant device not found')
	@ApiUnprocessableEntityResponse('Device adoption failed due to validation errors or already adopted')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('adopt')
	async adoptDevice(@Body() body: AdoptDeviceRequestDto): Promise<DeviceResponseModel> {
		this.logger.debug(`Adopting device ha_device_id=${body.haDeviceId}`);

		try {
			const request = toInstance(AdoptDeviceRequestDto, body);
			const device = await this.deviceAdoptionService.adoptDevice(request);

			this.logger.debug(`Adopted device ha_device_id=${body.haDeviceId} as device id=${device.id}`);

			const response = new DeviceResponseModel();
			response.data = device;
			return response;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesHomeAssistantValidationException) {
				this.logger.error('Device adoption validation failed', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException(err.message);
			} else if (error instanceof DevicesHomeAssistantNotFoundException) {
				throw new NotFoundException(err.message);
			} else if (error instanceof DevicesHomeAssistantException) {
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
}
