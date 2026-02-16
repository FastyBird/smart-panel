import { Controller, Param, Patch, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
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
	@ApiNotFoundResponse('Alert not found among active alerts')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id/ack')
	async acknowledgeOne(
		@Param('id') id: string,
		@Req() req: AuthenticatedRequest,
	): Promise<SecurityAlertAckResponseModel> {
		const acknowledgedBy = this.extractIdentity(req);
		const result = await this.securityService.acknowledgeAlert(id, acknowledgedBy);

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
	async acknowledgeAll(@Req() req: AuthenticatedRequest): Promise<SecurityAlertAckAllResponseModel> {
		const acknowledgedBy = this.extractIdentity(req);
		const results = await this.securityService.acknowledgeAllAlerts(acknowledgedBy);

		const response = new SecurityAlertAckAllResponseModel();
		response.data = results.map((r) => {
			const model = new SecurityAlertAckModel();
			model.id = r.id;
			model.acknowledged = r.acknowledged;

			return model;
		});

		return response;
	}

	private extractIdentity(req: AuthenticatedRequest): string | undefined {
		if (req.auth == null) {
			return undefined;
		}

		if (req.auth.type === 'user') {
			return req.auth.id;
		}

		return req.auth.tokenId;
	}
}
