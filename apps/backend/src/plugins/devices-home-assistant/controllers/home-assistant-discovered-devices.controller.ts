import { Controller, Get, Logger, NotFoundException, Param, UnprocessableEntityException } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/api/decorators/api-documentation.decorator';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';
import {
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import {
	HomeAssistantDiscoveredDeviceResponseModel,
	HomeAssistantDiscoveredDevicesResponseModel,
} from '../models/home-assistant-response.model';
import { HomeAssistantHttpService } from '../services/home-assistant.http.service';

@ApiTags(DEVICES_HOME_ASSISTANT_PLUGIN_NAME)
@Controller('discovered-devices')
export class HomeAssistantDiscoveredDevicesController {
	private readonly logger = new Logger(HomeAssistantDiscoveredDevicesController.name);

	constructor(private readonly homeAssistantHttpService: HomeAssistantHttpService) {}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_NAME],
		summary: 'Retrieve all Home Assistant discovered devices',
		description:
			'Fetches a list of all Home Assistant discovered devices that can be adopted into the Smart Panel ecosystem.',
		operationId: 'get-devices-home-assistant-plugin-discovered-devices',
	})
	@ApiSuccessResponse(
		HomeAssistantDiscoveredDevicesResponseModel,
		'A list of Home Assistant discovered devices successfully retrieved',
	)
	@ApiNotFoundResponse('Home Assistant discovered devices could not be loaded')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(): Promise<HomeAssistantDiscoveredDevicesResponseModel> {
		this.logger.debug('[HOME ASSISTANT][DISCOVERED DEVICES CONTROLLER] Fetching all Home Assistant discovered devices');

		try {
			const devices = await this.homeAssistantHttpService.getDiscoveredDevices();

			this.logger.debug(
				`[HOME ASSISTANT][DISCOVERED DEVICES CONTROLLER] Retrieved ${devices.length} discovered devices`,
			);

			const response = new HomeAssistantDiscoveredDevicesResponseModel();
			response.data = devices;
			return response;
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

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_NAME],
		summary: 'Retrieve a Home Assistant discovered device by ID',
		description: 'Fetches a specific Home Assistant discovered device by its identifier.',
		operationId: 'get-devices-home-assistant-plugin-discovered-device',
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
		this.logger.debug(
			`[HOME ASSISTANT][DISCOVERED DEVICES CONTROLLER] Fetching Home Assistant discovered device id=${id}`,
		);

		try {
			const device = await this.homeAssistantHttpService.getDiscoveredDevice(id);

			this.logger.debug(
				`[HOME ASSISTANT][DISCOVERED DEVICES CONTROLLER] Found Home Assistant discovered device id=${device.id}`,
			);

			const response = new HomeAssistantDiscoveredDeviceResponseModel();
			response.data = device;
			return response;
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
