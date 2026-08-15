import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_HOMEY_PLUGIN_API_TAG_NAME } from '../devices-homey.constants';
import { HomeyTestConnectionRequestDto } from '../dto/test-connection.dto';
import { HomeyTestConnectionResponseModel } from '../models/test-connection.model';
import { HomeyConnectionTestService } from '../services/homey-connection-test.service';

@ApiTags(DEVICES_HOMEY_PLUGIN_API_TAG_NAME)
@Controller()
export class HomeyTestConnectionController {
	constructor(private readonly connectionTestService: HomeyConnectionTestService) {}

	@ApiOperation({
		tags: [DEVICES_HOMEY_PLUGIN_API_TAG_NAME],
		summary: 'Test a Homey connection',
		description: 'Tests either the fully persisted Homey configuration or a complete unsaved URL and new API-key pair.',
		operationId: 'test-devices-homey-plugin-connection',
	})
	@ApiBody({ type: HomeyTestConnectionRequestDto })
	@ApiSuccessResponse(HomeyTestConnectionResponseModel, 'Homey connection test completed')
	@ApiBadRequestResponse('Invalid saved or candidate connection test request')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('test-connection')
	@HttpCode(200)
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async testConnection(@Body() body: HomeyTestConnectionRequestDto): Promise<HomeyTestConnectionResponseModel> {
		const response = new HomeyTestConnectionResponseModel();
		response.data = await this.connectionTestService.testConnection(body.data);

		return response;
	}
}
