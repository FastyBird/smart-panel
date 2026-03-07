import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { BUDDY_MODULE_API_TAG_NAME, BUDDY_MODULE_NAME } from '../buddy.constants';
import { ReqUpdatePersonalityDto } from '../dto/update-personality.dto';
import { PersonalityDataModel, PersonalityResponseModel } from '../models/personality-response.model';
import { BuddyPersonalityService } from '../services/buddy-personality.service';

@ApiTags(BUDDY_MODULE_API_TAG_NAME)
@Controller('personality')
export class BuddyPersonalityController {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'BuddyPersonalityController');

	constructor(private readonly personalityService: BuddyPersonalityService) {}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'Get buddy personality',
		description: 'Retrieves the current personality configuration text used in the LLM system prompt.',
		operationId: 'get-buddy-module-personality',
	})
	@ApiSuccessResponse(PersonalityResponseModel, 'Current personality text successfully retrieved.')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async getPersonality(): Promise<PersonalityResponseModel> {
		this.logger.debug('Fetching buddy personality');

		const content = await this.personalityService.getPersonality();

		const data = new PersonalityDataModel();
		data.content = content;

		const response = new PersonalityResponseModel();
		response.data = data;

		return response;
	}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'Update buddy personality',
		description:
			'Updates the personality configuration text that defines the buddy tone and style. ' +
			'Changes take effect on the next conversation message.',
		operationId: 'update-buddy-module-personality',
	})
	@ApiBody({ type: ReqUpdatePersonalityDto, description: 'The personality content to save' })
	@ApiSuccessResponse(PersonalityResponseModel, 'Personality text successfully updated.')
	@ApiBadRequestResponse('Invalid personality data')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch()
	async updatePersonality(@Body() body: ReqUpdatePersonalityDto): Promise<PersonalityResponseModel> {
		this.logger.debug('Updating buddy personality');

		const content = await this.personalityService.setPersonality(body.data.content);

		const data = new PersonalityDataModel();
		data.content = content;

		const response = new PersonalityResponseModel();
		response.data = data;

		return response;
	}
}
