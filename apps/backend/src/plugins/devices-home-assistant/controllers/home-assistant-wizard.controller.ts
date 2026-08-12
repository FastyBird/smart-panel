import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	NotFoundException,
	Param,
	Post,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME } from '../devices-home-assistant.constants';
import {
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { ReqHomeAssistantWizardAdoptDto } from '../dto/wizard-adopt.dto';
import {
	HomeAssistantWizardAdoptionResponseModel,
	HomeAssistantWizardSessionResponseModel,
} from '../models/wizard.model';
import { HomeAssistantWizardService } from '../services/wizard.service';

@ApiTags(DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME)
@Controller('wizard')
export class HomeAssistantWizardController {
	constructor(private readonly wizardService: HomeAssistantWizardService) {}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME],
		summary: 'Start Home Assistant bulk adoption wizard session',
		description: 'Creates one automatic mapping snapshot for all discoverable Home Assistant devices and helpers.',
		operationId: 'create-devices-home-assistant-plugin-wizard',
	})
	@ApiCreatedSuccessResponse(HomeAssistantWizardSessionResponseModel, 'Wizard session was started successfully')
	@ApiNotFoundResponse('Home Assistant inventory could not be loaded')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	async startSession(): Promise<HomeAssistantWizardSessionResponseModel> {
		try {
			const response = new HomeAssistantWizardSessionResponseModel();
			response.data = await this.wizardService.start();
			return response;
		} catch (error) {
			this.translatePluginError(error);
		}
	}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME],
		summary: 'Get Home Assistant bulk adoption wizard session',
		description: 'Returns the immutable discovery and mapping snapshot for the session.',
		operationId: 'get-devices-home-assistant-plugin-wizard',
	})
	@ApiParam({ name: 'id', type: 'string' })
	@ApiSuccessResponse(HomeAssistantWizardSessionResponseModel, 'Wizard session was successfully retrieved')
	@ApiNotFoundResponse('Wizard session could not be found')
	@Get(':id')
	getSession(@Param('id') id: string): HomeAssistantWizardSessionResponseModel {
		const session = this.wizardService.get(id);

		if (!session) {
			throw new NotFoundException('Wizard session could not be found');
		}

		const response = new HomeAssistantWizardSessionResponseModel();
		response.data = session;
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME],
		summary: 'End Home Assistant bulk adoption wizard session',
		description: 'Deletes the server-side discovery and mapping snapshot.',
		operationId: 'delete-devices-home-assistant-plugin-wizard',
	})
	@ApiParam({ name: 'id', type: 'string' })
	@ApiNoContentResponse({ description: 'Wizard session ended' })
	@Delete(':id')
	@HttpCode(204)
	endSession(@Param('id') id: string): void {
		this.wizardService.end(id);
	}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME],
		summary: 'Adopt selected Home Assistant wizard candidates',
		description:
			'Adopts candidates using the automatic mappings stored in the session. Candidates requiring review are rejected.',
		operationId: 'adopt-devices-home-assistant-plugin-wizard',
	})
	@ApiParam({ name: 'id', type: 'string' })
	@ApiBody({ type: ReqHomeAssistantWizardAdoptDto })
	@ApiSuccessResponse(HomeAssistantWizardAdoptionResponseModel, 'Adoption results returned')
	@ApiBadRequestResponse('Invalid request data')
	@ApiNotFoundResponse('Wizard session could not be found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':id/adopt')
	async adopt(
		@Param('id') id: string,
		@Body() body: ReqHomeAssistantWizardAdoptDto,
	): Promise<HomeAssistantWizardAdoptionResponseModel> {
		const results = await this.wizardService.adopt(id, body.data.keys);

		if (results === null) {
			throw new NotFoundException('Wizard session could not be found');
		}

		const response = new HomeAssistantWizardAdoptionResponseModel();
		response.data = { results };
		return response;
	}

	private translatePluginError(error: unknown): never {
		if (error instanceof DevicesHomeAssistantValidationException) {
			throw new UnprocessableEntityException(error.message);
		}

		if (error instanceof DevicesHomeAssistantNotFoundException) {
			throw new NotFoundException(error.message);
		}

		throw error;
	}
}
