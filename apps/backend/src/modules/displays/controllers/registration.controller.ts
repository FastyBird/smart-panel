import { Body, Controller, Headers, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../auth/guards/auth.guard';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { ALLOWED_USER_AGENTS, DISPLAYS_MODULE_API_TAG_NAME } from '../displays.constants';
import { DisplaysRegistrationException } from '../displays.exceptions';
import { ReqRegisterDisplayDto } from '../dto/register-display.dto';
import { DisplayRegistrationResponseModel } from '../models/displays-response.model';
import { RegistrationService } from '../services/registration.service';

@ApiTags(DISPLAYS_MODULE_API_TAG_NAME)
@Controller('register')
export class RegistrationController {
	private readonly logger = new Logger(RegistrationController.name);

	constructor(private readonly registrationService: RegistrationService) {}

	@Post()
	@Public()
	@ApiOperation({
		summary: 'Register display',
		description:
			'Registers a new display or updates an existing one. Returns a long-lived access token for the display to use in subsequent API and WebSocket requests.',
	})
	@ApiCreatedSuccessResponse(DisplayRegistrationResponseModel, 'Display registered successfully')
	@ApiBadRequestResponse('Invalid user agent or request')
	@ApiUnprocessableEntityResponse('Invalid registration data')
	async register(
		@Headers('user-agent') userAgent: string,
		@Body() body: ReqRegisterDisplayDto,
	): Promise<DisplayRegistrationResponseModel> {
		this.logger.debug(`[REGISTER] Display registration request received`);

		// Validate user agent
		const isAllowedUserAgent = ALLOWED_USER_AGENTS.some((allowed) => userAgent?.includes(allowed));

		if (!isAllowedUserAgent) {
			this.logger.warn(`[REGISTER] Invalid user agent: ${userAgent}`);

			throw new DisplaysRegistrationException('Invalid request source');
		}

		const result = await this.registrationService.registerDisplay(body.data, userAgent);

		const response = new DisplayRegistrationResponseModel();

		response.data = {
			display: result.display,
			accessToken: result.accessToken,
		};

		return response;
	}
}
