import { Controller, Get, Logger, NotFoundException, Param, UnprocessableEntityException } from '@nestjs/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessArrayResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../common/decorators/api-documentation.decorator';
import { ApiTag } from '../../../common/decorators/api-tag.decorator';
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
	HomeAssistantDiscoveredDeviceResponseModel,
	HomeAssistantDiscoveredDevicesResponseModel,
} from '../models/home-assistant-response.model';
import {
	DevicesHomeAssistantPluginDiscoveredDevice,
	HomeAssistantDiscoveredDeviceModel,
} from '../models/home-assistant.model';
import { HomeAssistantHttpService } from '../services/home-assistant.http.service';

@ApiTag({
	tagName: DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	displayName: DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME,
	description: DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_DESCRIPTION,
})
@Controller('discovered-devices')
export class HomeAssistantDiscoveredDevicesController {
	private readonly logger = new Logger(HomeAssistantDiscoveredDevicesController.name);

	constructor(private readonly homeAssistantHttpService: HomeAssistantHttpService) {}

	@Get()
	@ApiOperation({ summary: 'Retrieve all Home Assistant discovered devices' })
	@ApiSuccessArrayResponse(HomeAssistantDiscoveredDeviceModel)
	@ApiNotFoundResponse('Home Assistant discovered devices could not be loaded')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	async findAll(): Promise<HomeAssistantDiscoveredDeviceModel[]> {
		this.logger.debug('[HOME ASSISTANT][DISCOVERED DEVICES CONTROLLER] Fetching all Home Assistant discovered devices');

		try {
			const devices = await this.homeAssistantHttpService.getDiscoveredDevices();

			this.logger.debug(
				`[HOME ASSISTANT][DISCOVERED DEVICES CONTROLLER] Retrieved ${devices.length} discovered devices`,
			);

			return devices;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesHomeAssistantValidationException) {
				this.logger.error(
					'[HOME ASSISTANT][DISCOVERED DEVICES CONTROLLER] Devices Home Assistant plugin is not properly configured',
					{
						message: err.message,
						stack: err.stack,
					},
				);

				throw new UnprocessableEntityException('Devices Home Assistant plugin is not properly configured');
			} else if (error instanceof DevicesHomeAssistantNotFoundException) {
				throw new NotFoundException(
					'Home Assistant discovered devices could not be loaded from Home Assistant instance',
				);
			}

			this.logger.error(
				'[HOME ASSISTANT][DISCOVERED DEVICES CONTROLLER] Loading Home Assistant discovered devices failed',
				{
					message: err.message,
					stack: err.stack,
				},
			);

			throw error;
		}
	}

	@Get(':id')
	@ApiOperation({ summary: 'Retrieve a Home Assistant discovered device by ID' })
	@ApiParam({ name: 'id', type: 'string', description: 'Discovered device ID' })
	@ApiSuccessResponse(HomeAssistantDiscoveredDeviceModel)
	@ApiBadRequestResponse('Invalid device ID format')
	@ApiNotFoundResponse('Home Assistant discovered device not found')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	async findOne(@Param('id') id: string): Promise<HomeAssistantDiscoveredDeviceModel> {
		this.logger.debug(
			`[HOME ASSISTANT][DISCOVERED DEVICES CONTROLLER] Fetching Home Assistant discovered device id=${id}`,
		);

		try {
			const device = await this.homeAssistantHttpService.getDiscoveredDevice(id);

			this.logger.debug(
				`[HOME ASSISTANT][DISCOVERED DEVICES CONTROLLER] Found Home Assistant discovered device id=${device.id}`,
			);

			return device;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesHomeAssistantValidationException) {
				this.logger.error(
					'[HOME ASSISTANT][DISCOVERED DEVICES CONTROLLER] Devices Home Assistant plugin is not properly configured',
					{
						message: err.message,
						stack: err.stack,
					},
				);

				throw new UnprocessableEntityException('Devices Home Assistant plugin is not properly configured');
			} else if (error instanceof DevicesHomeAssistantNotFoundException) {
				throw new NotFoundException(
					'Home Assistant discovered device could not be loaded from Home Assistant instance',
				);
			}

			this.logger.error(
				'[HOME ASSISTANT][DISCOVERED DEVICES CONTROLLER] Loading Home Assistant discovered device failed',
				{
					message: err.message,
					stack: err.stack,
				},
			);

			throw error;
		}
	}
}
