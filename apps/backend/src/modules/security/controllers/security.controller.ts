import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { SecurityStatusResponseModel } from '../models/security-response.model';
import { SECURITY_MODULE_API_TAG_NAME } from '../security.constants';
import { SecurityService } from '../services/security.service';

@ApiTags(SECURITY_MODULE_API_TAG_NAME)
@Controller('status')
export class SecurityController {
	constructor(private readonly securityService: SecurityService) {}

	@ApiOperation({
		tags: [SECURITY_MODULE_API_TAG_NAME],
		summary: 'Get security status',
		description: 'Retrieve the current security status including armed state, alarm state, and active alerts',
		operationId: 'get-security-module-status',
	})
	@ApiSuccessResponse(SecurityStatusResponseModel, 'Security status retrieved successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async getStatus(): Promise<SecurityStatusResponseModel> {
		const data = await this.securityService.getStatus();

		const response = new SecurityStatusResponseModel();
		response.data = data;

		return response;
	}
}
