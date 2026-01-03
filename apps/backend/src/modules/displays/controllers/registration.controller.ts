import { Request } from 'express';

import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { Public } from '../../auth/guards/auth.guard';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiForbiddenResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { ALLOWED_USER_AGENTS, DISPLAYS_MODULE_API_TAG_NAME, DISPLAYS_MODULE_NAME } from '../displays.constants';
import { DisplaysRegistrationException } from '../displays.exceptions';
import { ReqRegisterDisplayDto } from '../dto/register-display.dto';
import { RegistrationGuard } from '../guards/registration.guard';
import {
	DisplayRegistrationResponseModel,
	RegistrationStatusDataModel,
	RegistrationStatusResponseModel,
} from '../models/displays-response.model';
import { PermitJoinService } from '../services/permit-join.service';
import { RegistrationService } from '../services/registration.service';
import { extractClientIp, isLocalhost } from '../utils/ip.utils';

@ApiTags(DISPLAYS_MODULE_API_TAG_NAME)
@Controller('register')
export class RegistrationController {
	private readonly logger = createExtensionLogger(DISPLAYS_MODULE_NAME, 'RegistrationController');

	constructor(
		private readonly registrationService: RegistrationService,
		private readonly permitJoinService: PermitJoinService,
	) {}

	@Post()
	@Public()
	@UseGuards(RegistrationGuard)
	@ApiOperation({
		operationId: 'create-displays-module-register',
		summary: 'Register display',
		description:
			'Registers a new display or updates an existing one. Returns a long-lived access token for the display to use in subsequent API and WebSocket requests.',
	})
	@ApiCreatedSuccessResponse(DisplayRegistrationResponseModel, 'Display registered successfully')
	@ApiBadRequestResponse('Invalid user agent or request')
	@ApiForbiddenResponse('Registration not permitted or localhost display already exists')
	@ApiUnprocessableEntityResponse('Invalid registration data')
	async register(
		@Req() request: Request,
		@Headers('user-agent') userAgent: string,
		@Body() body: ReqRegisterDisplayDto,
	): Promise<DisplayRegistrationResponseModel> {
		// Validate user agent
		const isAllowedUserAgent = ALLOWED_USER_AGENTS.some((allowed) => userAgent?.includes(allowed));

		if (!isAllowedUserAgent) {
			this.logger.warn(`Invalid user agent: ${userAgent}`);

			throw new DisplaysRegistrationException('Invalid request source');
		}

		const clientIp = extractClientIp(request);
		const result = await this.registrationService.registerDisplay(body.data, userAgent, clientIp);

		const response = new DisplayRegistrationResponseModel();

		response.data = {
			display: result.display,
			accessToken: result.accessToken,
		};

		return response;
	}

	@Get('status')
	@Public()
	@ApiOperation({
		operationId: 'get-displays-module-register-status',
		summary: 'Check registration status',
		description:
			'Returns whether registration is currently open. Public endpoint for displays to check before attempting registration.',
	})
	@ApiSuccessResponse(RegistrationStatusResponseModel, 'Returns registration status')
	getRegistrationStatus(@Req() request: Request): RegistrationStatusResponseModel {
		const clientIp = extractClientIp(request);
		const isLocalhostConnection = isLocalhost(clientIp);

		// Localhost connections are always allowed, regardless of permit join status
		const open = isLocalhostConnection || this.permitJoinService.isPermitJoinActive();
		const remainingTime = this.permitJoinService.getRemainingTime();

		const data = new RegistrationStatusDataModel();
		data.open = open;
		data.remainingTime = remainingTime;

		const response = new RegistrationStatusResponseModel();
		response.data = data;

		return response;
	}
}
