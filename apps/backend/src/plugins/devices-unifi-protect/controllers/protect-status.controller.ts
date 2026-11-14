import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import {
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME } from '../devices-unifi-protect.constants';
import { ProtectStatusResponseModel } from '../models/status.model';
import { ProtectConnectorService } from '../services/protect-connector.service';

@ApiTags(DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME)
@Controller('status')
export class ProtectStatusController {
	constructor(private readonly connectorService: ProtectConnectorService) {}

	@ApiOperation({
		tags: [DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME],
		summary: 'Get UniFi Protect provider status',
		description: 'Returns the managed service and console connection state without exposing the API key.',
		operationId: 'get-devices-unifi-protect-plugin-status',
	})
	@ApiSuccessResponse(ProtectStatusResponseModel, 'UniFi Protect provider status retrieved successfully')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
	getStatus(): ProtectStatusResponseModel {
		const response = new ProtectStatusResponseModel();
		response.data = this.connectorService.getStatus();

		return response;
	}
}
