import { Controller, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import {
	SecurityAlertAckAllResponseModel,
	SecurityAlertAckModel,
	SecurityAlertAckResponseModel,
} from '../models/security-alert-ack-response.model';
import { SECURITY_MODULE_API_TAG_NAME } from '../security.constants';
import { SecurityService } from '../services/security.service';

@ApiTags(SECURITY_MODULE_API_TAG_NAME)
@Controller('alerts')
export class SecurityAlertsController {
	constructor(private readonly securityService: SecurityService) {}

	@ApiOperation({
		tags: [SECURITY_MODULE_API_TAG_NAME],
		summary: 'Acknowledge a single security alert',
		description: 'Marks a specific security alert as acknowledged by its deterministic ID',
		operationId: 'acknowledge-security-module-alert',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Alert ID (e.g. sensor:dev_123:smoke)',
	})
	@ApiSuccessResponse(SecurityAlertAckResponseModel, 'Alert acknowledged successfully')
	@ApiBadRequestResponse('Invalid request')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id/ack')
	async acknowledgeOne(@Param('id') id: string): Promise<SecurityAlertAckResponseModel> {
		const result = await this.securityService.acknowledgeAlert(id);

		const data = new SecurityAlertAckModel();
		data.id = result.id;
		data.acknowledged = result.acknowledged;

		const response = new SecurityAlertAckResponseModel();
		response.data = data;

		return response;
	}

	@ApiOperation({
		tags: [SECURITY_MODULE_API_TAG_NAME],
		summary: 'Acknowledge all active security alerts',
		description: 'Marks all currently active security alerts as acknowledged',
		operationId: 'acknowledge-security-module-all-alerts',
	})
	@ApiSuccessResponse(SecurityAlertAckAllResponseModel, 'All active alerts acknowledged successfully')
	@ApiBadRequestResponse('Invalid request')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch('ack')
	async acknowledgeAll(): Promise<SecurityAlertAckAllResponseModel> {
		const results = await this.securityService.acknowledgeAllAlerts();

		const response = new SecurityAlertAckAllResponseModel();
		response.data = results.map((r) => {
			const model = new SecurityAlertAckModel();
			model.id = r.id;
			model.acknowledged = r.acknowledged;

			return model;
		});

		return response;
	}
}
