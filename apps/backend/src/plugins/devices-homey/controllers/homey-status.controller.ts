import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import {
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_HOMEY_PLUGIN_API_TAG_NAME } from '../devices-homey.constants';
import { HomeyStatusResponseModel } from '../models/status.model';
import { HomeyService } from '../services/homey.service';

@ApiTags(DEVICES_HOMEY_PLUGIN_API_TAG_NAME)
@Controller('status')
export class HomeyStatusController {
	constructor(private readonly homeyService: HomeyService) {}

	@ApiOperation({
		tags: [DEVICES_HOMEY_PLUGIN_API_TAG_NAME],
		summary: 'Get Homey provider status',
		description: 'Returns the managed service and transport state without exposing connector credentials.',
		operationId: 'get-devices-homey-plugin-status',
	})
	@ApiSuccessResponse(HomeyStatusResponseModel, 'Homey provider status retrieved successfully')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
	getStatus(): HomeyStatusResponseModel {
		const response = new HomeyStatusResponseModel();
		response.data = this.homeyService.getStatus();

		return response;
	}
}
