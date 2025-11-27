import { Controller, Get, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import {
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessArrayResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/api/decorators/api-documentation.decorator';
import { ApiTag } from '../../../modules/api/decorators/api-tag.decorator';
import {
	DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_DESCRIPTION,
	DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME,
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
} from '../devices-home-assistant.constants';
import {
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import {
	HomeAssistantDeviceRegistryResponseResultModel,
	HomeAssistantEntityRegistryResponseResultModel,
} from '../models/home-assistant.model';
import { HomeAssistantWsService } from '../services/home-assistant.ws.service';

@ApiTag({
	tagName: DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	displayName: DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME,
	description: DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_DESCRIPTION,
})
@Controller('registry')
export class HomeAssistantRegistryController {
	private readonly logger = new Logger(HomeAssistantRegistryController.name);

	constructor(private readonly homeAssistantWsService: HomeAssistantWsService) {}

	@Get('devices')
	@ApiOperation({ summary: 'Retrieve all Home Assistant devices from registry' })
	@ApiSuccessArrayResponse(HomeAssistantDeviceRegistryResponseResultModel)
	@ApiNotFoundResponse('Home Assistant devices registry could not be loaded')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	async findAllDevices(): Promise<HomeAssistantDeviceRegistryResponseResultModel[]> {
		this.logger.debug('[HOME ASSISTANT][REGISTRY CONTROLLER] Fetching all Home Assistant devices from registry');

		try {
			const devices = await this.homeAssistantWsService.getDevicesRegistry();

			this.logger.debug(`[HOME ASSISTANT][REGISTRY CONTROLLER] Retrieved ${devices.length} devices from registry`);

			return devices;
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

	@Get('entities')
	@ApiOperation({ summary: 'Retrieve all Home Assistant entities from registry' })
	@ApiSuccessArrayResponse(HomeAssistantEntityRegistryResponseResultModel)
	@ApiNotFoundResponse('Home Assistant entities registry could not be loaded')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	async findAllEntities(): Promise<HomeAssistantEntityRegistryResponseResultModel[]> {
		this.logger.debug('[HOME ASSISTANT][REGISTRY CONTROLLER] Fetching all Home Assistant entities from registry');

		try {
			const entities = await this.homeAssistantWsService.getEntitiesRegistry();

			this.logger.debug(`[HOME ASSISTANT][REGISTRY CONTROLLER] Retrieved ${entities.length} entities from registry`);

			return entities;
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
