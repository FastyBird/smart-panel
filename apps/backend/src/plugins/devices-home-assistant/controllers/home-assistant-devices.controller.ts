import { Controller, Get, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { HomeAssistantDeviceModel } from '../models/home-assistant.model';
import { HomeAssistantHttpService } from '../services/home-assistant.http.service';

@Controller('devices')
export class HomeAssistantDevicesController {
	private readonly logger = new Logger(HomeAssistantDevicesController.name);

	constructor(private readonly haService: HomeAssistantHttpService) {}

	@Get()
	async findAll(): Promise<HomeAssistantDeviceModel[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all Home Assistant devices');

		try {
			const devices = await this.haService.getDevices();

			this.logger.debug(`[LOOKUP ALL] Retrieved ${devices.length} devices`);

			return devices;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesHomeAssistantValidationException) {
				this.logger.error('[ERROR] Devices Home Assistant plugin is not properly configured', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException('Devices Home Assistant plugin is not properly configured');
			} else if (error instanceof DevicesHomeAssistantNotFoundException) {
				throw new NotFoundException('Home Assistant devices could not be loaded from Home Assistant instance');
			}

			this.logger.error('[ERROR] Loading Home Assistant devices failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}
}
