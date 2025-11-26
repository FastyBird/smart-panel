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
	HomeAssistantStateResponseModel,
	HomeAssistantStatesResponseModel,
} from '../models/home-assistant-response.model';
import { DevicesHomeAssistantPluginState, HomeAssistantStateModel } from '../models/home-assistant.model';
import { HomeAssistantHttpService } from '../services/home-assistant.http.service';

@ApiTag({
	tagName: DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	displayName: DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME,
	description: DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_DESCRIPTION,
})
@Controller('states')
export class HomeAssistantStatesController {
	private readonly logger = new Logger(HomeAssistantStatesController.name);

	constructor(private readonly homeAssistantHttpService: HomeAssistantHttpService) {}

	@Get()
	@ApiOperation({ summary: 'Retrieve all Home Assistant entity states' })
	@ApiSuccessArrayResponse(HomeAssistantStateModel)
	@ApiNotFoundResponse('Home Assistant entity states could not be loaded')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	async findAll(): Promise<HomeAssistantStateModel[]> {
		this.logger.debug('[HOME ASSISTANT][STATES CONTROLLER] Fetching all Home Assistant entities states');

		try {
			const states = await this.homeAssistantHttpService.getStates();

			this.logger.debug(`[HOME ASSISTANT][STATES CONTROLLER] Retrieved ${states.length} entities states`);

			return states;
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

	@Get(':entityId')
	@ApiOperation({ summary: 'Retrieve a Home Assistant entity state by entity ID' })
	@ApiParam({ name: 'entityId', type: 'string', description: 'Home Assistant entity ID' })
	@ApiSuccessResponse(HomeAssistantStateModel)
	@ApiBadRequestResponse('Invalid entity ID format')
	@ApiNotFoundResponse('Home Assistant entity state not found')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	async findOne(@Param('entityId') entityId: string): Promise<HomeAssistantStateModel> {
		this.logger.debug(`[HOME ASSISTANT][STATES CONTROLLER] Fetching Home Assistant entity state id=${entityId}`);

		try {
			const state = await this.homeAssistantHttpService.getState(entityId);

			this.logger.debug(
				`[HOME ASSISTANT][STATES CONTROLLER] Found Home Assistant entity state entityId=${state.entityId}`,
			);

			return state;
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
