import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME } from '../devices-unifi-protect.constants';
import { ProtectTestConnectionRequestDto } from '../dto/test-connection.dto';
import { ProtectTestConnectionResponseModel } from '../models/test-connection.model';
import { ProtectConnectionTestService } from '../services/protect-connection-test.service';

@ApiTags(DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME)
@Controller()
export class ProtectTestConnectionController {
	constructor(private readonly connectionTestService: ProtectConnectionTestService) {}

	@ApiOperation({
		tags: [DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME],
		summary: 'Test a UniFi Protect connection',
		description:
			'Tests the saved configuration or a complete unsaved candidate with a new API key. The console certificate is checked before the key is sent, and the presented fingerprint and a suggested TLS server name are returned.',
		operationId: 'test-devices-unifi-protect-plugin-connection',
	})
	@ApiBody({ type: ProtectTestConnectionRequestDto })
	@ApiSuccessResponse(ProtectTestConnectionResponseModel, 'UniFi Protect connection test completed')
	@ApiBadRequestResponse('Invalid saved or candidate connection test request')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('test-connection')
	@HttpCode(200)
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async testConnection(@Body() body: ProtectTestConnectionRequestDto): Promise<ProtectTestConnectionResponseModel> {
		const response = new ProtectTestConnectionResponseModel();
		response.data = await this.connectionTestService.testConnection(body.data);

		return response;
	}
}
