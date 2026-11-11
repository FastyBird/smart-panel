import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import {
	ApiBadRequestResponse,
	ApiForbiddenResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { AUTOMATIONS_MODULE_API_TAG_NAME, AUTOMATIONS_MODULE_NAME } from '../automations.constants';
import { AutomationRunResponseModel } from '../models/automations-response.model';
import { AutomationRunHistoryService } from '../services/automation-run-history.service';

@ApiTags(AUTOMATIONS_MODULE_API_TAG_NAME)
@Controller('runs')
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class AutomationRunsController {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationRunsController');

	constructor(private readonly runHistory: AutomationRunHistoryService) {}

	@ApiOperation({
		tags: [AUTOMATIONS_MODULE_API_TAG_NAME],
		summary: 'Retrieve a run of an automation with its trace',
		description:
			'Fetches one stored run with its trace: what started it, every node it reached in order, the output each node took, the value each condition observed and what each action answered. The identifier is the `run_id` a manual trigger answers with. A run is stored when it ends, or when it parks on a Delay; a run that is neither has no record yet. Requires the owner or admin role.',
		operationId: 'get-automations-module-run',
	})
	@ApiParam({ name: 'runId', type: 'string', format: 'uuid', description: 'Run ID' })
	@ApiSuccessResponse(AutomationRunResponseModel, 'The run was successfully retrieved.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiForbiddenResponse('Only owners and admins can read automations')
	@ApiNotFoundResponse('Run not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':runId')
	async findOne(
		@Param('runId', new ParseUUIDPipe({ version: '4' })) runId: string,
	): Promise<AutomationRunResponseModel> {
		const run = await this.runHistory.findOne(runId);

		if (!run) {
			this.logger.debug(`[LOOKUP] Run with id=${runId} not found`);

			throw new NotFoundException('Requested run does not exist');
		}

		const response = new AutomationRunResponseModel();
		response.data = run;

		return response;
	}
}
