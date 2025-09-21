import { Controller, Get, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import {
	HomeAssistantDeviceRegistryResponseResultModel,
	HomeAssistantEntityRegistryResponseResultModel,
} from '../models/home-assistant.model';
import { HomeAssistantWsService } from '../services/home-assistant.ws.service';

@Controller('registry')
export class HomeAssistantRegistryController {
	private readonly logger = new Logger(HomeAssistantRegistryController.name);

	constructor(private readonly homeAssistantWsService: HomeAssistantWsService) {}

	@Get('devices')
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
