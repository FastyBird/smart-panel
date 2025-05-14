import { Controller, Get, Logger, NotFoundException, Param, UnprocessableEntityException } from '@nestjs/common';

import {
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { HomeAssistantDiscoveredDeviceModel } from '../models/home-assistant.model';
import { HomeAssistantHttpService } from '../services/home-assistant.http.service';

@Controller('discovered-devices')
export class HomeAssistantDiscoveredDevicesController {
	private readonly logger = new Logger(HomeAssistantDiscoveredDevicesController.name);

	constructor(private readonly homeAssistantHttpService: HomeAssistantHttpService) {}

	@Get()
	async findAll(): Promise<HomeAssistantDiscoveredDeviceModel[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all Home Assistant discovered devices');

		try {
			const devices = await this.homeAssistantHttpService.getDiscoveredDevices();

			this.logger.debug(`[LOOKUP ALL] Retrieved ${devices.length} discovered devices`);

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
				throw new NotFoundException(
					'Home Assistant discovered devices could not be loaded from Home Assistant instance',
				);
			}

			this.logger.error('[ERROR] Loading Home Assistant discovered devices failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}

	@Get(':id')
	async findOne(@Param('id') id: string): Promise<HomeAssistantDiscoveredDeviceModel> {
		this.logger.debug(`[LOOKUP] Fetching Home Assistant discovered device id=${id}`);

		try {
			const device = await this.homeAssistantHttpService.getDiscoveredDevice(id);

			this.logger.debug(`[LOOKUP] Found Home Assistant discovered device id=${device.id}`);

			return device;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesHomeAssistantValidationException) {
				this.logger.error('[ERROR] Devices Home Assistant plugin is not properly configured', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException('Devices Home Assistant plugin is not properly configured');
			} else if (error instanceof DevicesHomeAssistantNotFoundException) {
				throw new NotFoundException(
					'Home Assistant discovered device could not be loaded from Home Assistant instance',
				);
			}

			this.logger.error('[ERROR] Loading Home Assistant discovered device failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}
}
