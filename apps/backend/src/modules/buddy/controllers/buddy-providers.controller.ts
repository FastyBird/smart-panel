import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { BUDDY_MODULE_API_TAG_NAME, BUDDY_MODULE_NAME } from '../buddy.constants';
import { ProviderStatusesResponseModel } from '../models/provider-status.model';
import { BuddyProviderStatusService } from '../services/buddy-provider-status.service';

@ApiTags(BUDDY_MODULE_API_TAG_NAME)
@Controller('providers')
export class BuddyProvidersController {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'BuddyProvidersController');

	constructor(private readonly providerStatusService: BuddyProviderStatusService) {}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'List provider statuses',
		description:
			'Retrieves the configuration status of all registered LLM providers, including whether each is enabled, configured, and currently selected.',
		operationId: 'get-buddy-module-provider-statuses',
	})
	@ApiSuccessResponse(ProviderStatusesResponseModel, 'A list of provider statuses successfully retrieved.')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	getProviderStatuses(): ProviderStatusesResponseModel {
		this.logger.debug('Fetching provider statuses');

		const statuses = this.providerStatusService.getProviderStatuses();

		this.logger.debug(`Retrieved ${statuses.length} provider statuses`);

		const response = new ProviderStatusesResponseModel();

		response.data = statuses;

		return response;
	}
}
