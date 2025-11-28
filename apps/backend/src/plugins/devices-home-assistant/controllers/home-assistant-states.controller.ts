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
	HomeAssistantStateResponseModel,
	HomeAssistantStatesResponseModel,
} from '../models/home-assistant-response.model';
import { HomeAssistantHttpService } from '../services/home-assistant.http.service';

@ApiTags(DEVICES_HOME_ASSISTANT_PLUGIN_NAME)
@Controller('states')
export class HomeAssistantStatesController {
	private readonly logger = new Logger(HomeAssistantStatesController.name);

	constructor(private readonly homeAssistantHttpService: HomeAssistantHttpService) {}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_NAME],
		summary: 'Retrieve all Home Assistant entity states',
		description:
			'Fetches a list of all Home Assistant entity states currently available in the Home Assistant instance.',
		operationId: 'get-devices-home-assistant-plugin-states',
	})
	@ApiSuccessResponse(HomeAssistantStatesResponseModel, 'A list of Home Assistant entity states successfully retrieved')
	@ApiNotFoundResponse('Home Assistant entity states could not be loaded')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(): Promise<HomeAssistantStatesResponseModel> {
		this.logger.debug('[HOME ASSISTANT][STATES CONTROLLER] Fetching all Home Assistant entities states');

		try {
			const states = await this.homeAssistantHttpService.getStates();

			this.logger.debug(`[HOME ASSISTANT][STATES CONTROLLER] Retrieved ${states.length} entities states`);

			const response = new HomeAssistantStatesResponseModel();
			response.data = states;
			return response;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesHomeAssistantValidationException) {
				this.logger.error(
					'[HOME ASSISTANT][STATES CONTROLLER] Devices Home Assistant plugin is not properly configured',
					{
						message: err.message,
						stack: err.stack,
					},
				);

				throw new UnprocessableEntityException('Devices Home Assistant plugin is not properly configured');
			} else if (error instanceof DevicesHomeAssistantNotFoundException) {
				throw new NotFoundException('Home Assistant entities states could not be loaded from Home Assistant instance');
			}

			this.logger.error('[HOME ASSISTANT][STATES CONTROLLER] Loading Home Assistant entities states failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_NAME],
		summary: 'Retrieve a Home Assistant entity state by entity ID',
		description: 'Fetches the current state of a specific Home Assistant entity by its entity ID.',
		operationId: 'get-devices-home-assistant-plugin-state',
	})
	@ApiParam({ name: 'entityId', type: 'string', description: 'Home Assistant entity ID' })
	@ApiSuccessResponse(HomeAssistantStateResponseModel, 'A Home Assistant entity state successfully retrieved')
	@ApiBadRequestResponse('Invalid entity ID format')
	@ApiNotFoundResponse('Home Assistant entity state not found')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':entityId')
	async findOne(@Param('entityId') entityId: string): Promise<HomeAssistantStateResponseModel> {
		this.logger.debug(`[HOME ASSISTANT][STATES CONTROLLER] Fetching Home Assistant entity state id=${entityId}`);

		try {
			const state = await this.homeAssistantHttpService.getState(entityId);

			this.logger.debug(
				`[HOME ASSISTANT][STATES CONTROLLER] Found Home Assistant entity state entityId=${state.entityId}`,
			);

			const response = new HomeAssistantStateResponseModel();
			response.data = state;
			return response;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesHomeAssistantValidationException) {
				this.logger.error(
					'[HOME ASSISTANT][STATES CONTROLLER] Devices Home Assistant plugin is not properly configured',
					{
						message: err.message,
						stack: err.stack,
					},
				);

				throw new UnprocessableEntityException('Devices Home Assistant plugin is not properly configured');
			} else if (error instanceof DevicesHomeAssistantNotFoundException) {
				throw new NotFoundException('Home Assistant entity state could not be loaded from Home Assistant instance');
			}

			this.logger.error('[HOME ASSISTANT][STATES CONTROLLER] Loading Home Assistant entity state failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}
}
