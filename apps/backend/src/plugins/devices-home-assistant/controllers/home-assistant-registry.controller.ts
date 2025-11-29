import { Controller, Get, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/api/decorators/api-documentation.decorator';
import { DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME } from '../devices-home-assistant.constants';
import {
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import {
	HomeAssistantDeviceRegistryResponseModel,
	HomeAssistantEntityRegistryResponseModel,
} from '../models/home-assistant-response.model';
import { HomeAssistantWsService } from '../services/home-assistant.ws.service';

@ApiTags(DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME)
@Controller('registry')
export class HomeAssistantRegistryController {
	private readonly logger = new Logger(HomeAssistantRegistryController.name);

	constructor(private readonly homeAssistantWsService: HomeAssistantWsService) {}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME],
		summary: 'Retrieve all Home Assistant devices from registry',
		description: 'Fetches a list of all devices registered in the Home Assistant device registry.',
		operationId: 'get-devices-home-assistant-plugin-device-registry',
	})
	@ApiExtraModels(HomeAssistantDeviceRegistryResponseModel)
	@ApiSuccessResponse(
		HomeAssistantDeviceRegistryResponseModel,
		'A list of Home Assistant devices from registry successfully retrieved',
	)
	@ApiNotFoundResponse('Home Assistant devices registry could not be loaded')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('devices')
	async findAllDevices(): Promise<HomeAssistantDeviceRegistryResponseModel> {
		this.logger.debug('[HOME ASSISTANT][REGISTRY CONTROLLER] Fetching all Home Assistant devices from registry');

		try {
			const devices = await this.homeAssistantWsService.getDevicesRegistry();

			this.logger.debug(`[HOME ASSISTANT][REGISTRY CONTROLLER] Retrieved ${devices.length} devices from registry`);

			const response = new HomeAssistantDeviceRegistryResponseModel();
			response.data = devices;
			return response;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesHomeAssistantValidationException) {
				this.logger.error(
					'[HOME ASSISTANT][REGISTRY CONTROLLER] Devices Home Assistant plugin is not properly configured',
					{
						message: err.message,
						stack: err.stack,
					},
				);

				throw new UnprocessableEntityException('Devices Home Assistant plugin is not properly configured');
			} else if (error instanceof DevicesHomeAssistantNotFoundException) {
				throw new NotFoundException('Home Assistant devices registry could not be loaded from Home Assistant instance');
			}

			this.logger.error('[HOME ASSISTANT][REGISTRY CONTROLLER] Loading Home Assistant devices registry failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME],
		summary: 'Retrieve all Home Assistant entities from registry',
		description: 'Fetches a list of all entities registered in the Home Assistant entity registry.',
		operationId: 'get-devices-home-assistant-plugin-entity-registry',
	})
	@ApiExtraModels(HomeAssistantEntityRegistryResponseModel)
	@ApiSuccessResponse(
		HomeAssistantEntityRegistryResponseModel,
		'A list of Home Assistant entities from registry successfully retrieved',
	)
	@ApiNotFoundResponse('Home Assistant entities registry could not be loaded')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('entities')
	async findAllEntities(): Promise<HomeAssistantEntityRegistryResponseModel> {
		this.logger.debug('[HOME ASSISTANT][REGISTRY CONTROLLER] Fetching all Home Assistant entities from registry');

		try {
			const entities = await this.homeAssistantWsService.getEntitiesRegistry();

			this.logger.debug(`[HOME ASSISTANT][REGISTRY CONTROLLER] Retrieved ${entities.length} entities from registry`);

			const response = new HomeAssistantEntityRegistryResponseModel();
			response.data = entities;
			return response;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesHomeAssistantValidationException) {
				this.logger.error(
					'[HOME ASSISTANT][REGISTRY CONTROLLER] Devices Home Assistant plugin is not properly configured',
					{
						message: err.message,
						stack: err.stack,
					},
				);

				throw new UnprocessableEntityException('Devices Home Assistant plugin is not properly configured');
			} else if (error instanceof DevicesHomeAssistantNotFoundException) {
				throw new NotFoundException(
					'Home Assistant entities registry could not be loaded from Home Assistant instance',
				);
			}

			this.logger.error('[HOME ASSISTANT][REGISTRY CONTROLLER] Loading Home Assistant entities registry failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}
}
