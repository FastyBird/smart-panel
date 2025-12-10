import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Headers,
	HttpCode,
	Logger,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Req,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { TokenOwnerType } from '../../auth/auth.constants';
import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import { TokensService } from '../../auth/services/tokens.service';
import {
	ApiBadRequestResponse,
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { DISPLAYS_MODULE_API_TAG_NAME, DeploymentMode } from '../displays.constants';
import { ReqUpdateDisplayDto } from '../dto/update-display.dto';
import {
	DisplayResponseModel,
	DisplayTokenRefreshDataModel,
	DisplayTokenRefreshResponseModel,
	DisplayTokensResponseModel,
	DisplaysResponseModel,
	PermitJoinDataModel,
	PermitJoinResponseModel,
	PermitJoinStatusDataModel,
	PermitJoinStatusResponseModel,
} from '../models/displays-response.model';
import { DisplaysService } from '../services/displays.service';
import { PermitJoinService } from '../services/permit-join.service';
import { RegistrationService } from '../services/registration.service';

@ApiTags(DISPLAYS_MODULE_API_TAG_NAME)
@Controller('displays')
export class DisplaysController {
	private readonly logger = new Logger(DisplaysController.name);

	constructor(
		private readonly displaysService: DisplaysService,
		private readonly tokensService: TokensService,
		private readonly registrationService: RegistrationService,
		private readonly permitJoinService: PermitJoinService,
	) {}

	@Get('me')
	@ApiOperation({
		summary: 'Get current display',
		description: "Retrieves the authenticated display's own data. Only accessible by displays.",
	})
	@ApiSuccessResponse(DisplayResponseModel, 'Returns the current display')
	@ApiForbiddenResponse('Not authenticated as a display')
	@ApiNotFoundResponse('Display not found')
	async getMe(@Req() req: AuthenticatedRequest): Promise<DisplayResponseModel> {
		const auth = req.auth;

		if (!auth || auth.type !== 'token' || auth.ownerType !== TokenOwnerType.DISPLAY || !auth.ownerId) {
			this.logger.warn('[GET ME] Attempted access by non-display entity');
			throw new ForbiddenException('This endpoint is only accessible by displays');
		}

		this.logger.debug(`[GET ME] Fetching display data for id=${auth.ownerId}`);

		const display = await this.displaysService.getOneOrThrow(auth.ownerId);

		const response = new DisplayResponseModel();

		response.data = display;

		return response;
	}

	@Patch('me')
	@ApiOperation({
		summary: 'Update current display',
		description: "Updates the authenticated display's own configuration. Only accessible by displays.",
	})
	@ApiSuccessResponse(DisplayResponseModel, 'Returns the updated display')
	@ApiForbiddenResponse('Not authenticated as a display')
	@ApiNotFoundResponse('Display not found')
	@ApiUnprocessableEntityResponse('Invalid display data')
	async updateMe(@Req() req: AuthenticatedRequest, @Body() body: ReqUpdateDisplayDto): Promise<DisplayResponseModel> {
		const auth = req.auth;

		if (!auth || auth.type !== 'token' || auth.ownerType !== TokenOwnerType.DISPLAY || !auth.ownerId) {
			this.logger.warn('[UPDATE ME] Attempted access by non-display entity');
			throw new ForbiddenException('This endpoint is only accessible by displays');
		}

		this.logger.debug(`[UPDATE ME] Updating display with id=${auth.ownerId}`);

		const display = await this.displaysService.update(auth.ownerId, body.data);

		const response = new DisplayResponseModel();

		response.data = display;

		return response;
	}

	@Post('me/refresh-token')
	@ApiOperation({
		summary: 'Refresh display token',
		description:
			'Refreshes the current display token. Returns a new long-lived token and revokes the old one. Only accessible by displays.',
	})
	@ApiSuccessResponse(DisplayTokenRefreshResponseModel, 'Returns the new access token')
	@ApiForbiddenResponse('Not authenticated as a display')
	async refreshToken(
		@Req() req: AuthenticatedRequest,
		@Headers('authorization') authHeader: string,
	): Promise<DisplayTokenRefreshResponseModel> {
		const auth = req.auth;

		if (!auth || auth.type !== 'token' || auth.ownerType !== TokenOwnerType.DISPLAY || !auth.ownerId) {
			this.logger.warn('[REFRESH TOKEN] Attempted access by non-display entity');
			throw new ForbiddenException('This endpoint is only accessible by displays');
		}

		// Extract the token from the Authorization header
		const token = authHeader?.replace('Bearer ', '');

		this.logger.debug(`[REFRESH TOKEN] Refreshing token for display=${auth.ownerId}`);

		const result = await this.registrationService.refreshDisplayToken(auth.ownerId, token);

		const responseData = new DisplayTokenRefreshDataModel();
		responseData.accessToken = result.accessToken;
		responseData.expiresAt = result.expiresAt;

		const response = new DisplayTokenRefreshResponseModel();
		response.data = responseData;

		return response;
	}

	@Get()
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		summary: 'List all displays',
		description: 'Retrieves a list of all registered displays. Requires owner or admin role.',
	})
	@ApiSuccessResponse(DisplaysResponseModel, 'Returns a list of displays')
	async findAll(): Promise<DisplaysResponseModel> {
		this.logger.debug('[GET ALL] Fetching all displays');

		const displays = await this.displaysService.findAll();

		const response = new DisplaysResponseModel();

		response.data = displays;

		return response;
	}

	@Get(':id')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		summary: 'Get display by ID',
		description: 'Retrieves a specific display by its unique identifier. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Display ID' })
	@ApiSuccessResponse(DisplayResponseModel, 'Returns the display')
	@ApiNotFoundResponse('Display not found')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<DisplayResponseModel> {
		this.logger.debug(`[GET] Fetching display with id=${id}`);

		const display = await this.displaysService.getOneOrThrow(id);

		const response = new DisplayResponseModel();

		response.data = display;

		return response;
	}

	@Patch(':id')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		summary: 'Update display',
		description: 'Updates an existing display configuration. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Display ID' })
	@ApiSuccessResponse(DisplayResponseModel, 'Returns the updated display')
	@ApiNotFoundResponse('Display not found')
	@ApiUnprocessableEntityResponse('Invalid display data')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqUpdateDisplayDto,
	): Promise<DisplayResponseModel> {
		this.logger.debug(`[UPDATE] Updating display with id=${id}`);

		const display = await this.displaysService.update(id, body.data);

		const response = new DisplayResponseModel();

		response.data = display;

		return response;
	}

	@Delete(':id')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		summary: 'Delete display',
		description: 'Removes a display from the system. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Display ID' })
	@ApiNoContentResponse({ description: 'Display deleted successfully' })
	@ApiNotFoundResponse('Display not found')
	@HttpCode(204)
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing display with id=${id}`);

		await this.displaysService.remove(id);

		this.logger.debug(`[DELETE] Successfully removed display with id=${id}`);
	}

	@Get(':id/tokens')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		summary: 'List display tokens',
		description:
			'Retrieves all active (non-revoked) tokens for a specific display. Requires owner or admin role. Note: Each display should have at most one active token.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Display ID' })
	@ApiSuccessResponse(DisplayTokensResponseModel, 'Returns the list of display tokens')
	@ApiNotFoundResponse('Display not found')
	async getTokens(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<DisplayTokensResponseModel> {
		this.logger.debug(`[GET TOKENS] Fetching tokens for display with id=${id}`);

		// Verify display exists
		await this.displaysService.getOneOrThrow(id);

		// Get all tokens for this display (only active, non-revoked tokens)
		const allTokens = await this.tokensService.findByOwnerId(id, TokenOwnerType.DISPLAY);
		const activeTokens = allTokens.filter((token) => !token.revoked);

		this.logger.debug(`[GET TOKENS] Found ${activeTokens.length} active tokens for display with id=${id}`);

		const response = new DisplayTokensResponseModel();

		response.data = activeTokens;

		return response;
	}

	@Post(':id/revoke-token')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		summary: 'Revoke display token',
		description:
			'Revokes all active tokens for a specific display. The display will need to re-register to get a new token. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Display ID' })
	@ApiNoContentResponse({ description: 'Display tokens revoked successfully' })
	@ApiNotFoundResponse('Display not found')
	@HttpCode(204)
	async revokeToken(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`[REVOKE TOKEN] Revoking tokens for display with id=${id}`);

		// Verify display exists
		await this.displaysService.getOneOrThrow(id);

		// Revoke all tokens for this display
		await this.tokensService.revokeByOwnerId(id, TokenOwnerType.DISPLAY);

		this.logger.debug(`[REVOKE TOKEN] Successfully revoked tokens for display with id=${id}`);
	}

	@Post('permit-join')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		summary: 'Permit display join',
		description:
			'Opens registration endpoint for the configured duration (default: 2 minutes). Requires owner or admin role. Not available in all-in-one mode.',
	})
	@ApiSuccessResponse(PermitJoinResponseModel, 'Permit join activated successfully')
	@ApiBadRequestResponse('Permit join is not available in all-in-one deployment mode')
	permitJoin(): PermitJoinResponseModel {
		this.logger.debug('[PERMIT JOIN] Activating permit join');

		this.permitJoinService.activatePermitJoin();

		const expiresAt = this.permitJoinService.getExpiresAt();
		const remainingTime = this.permitJoinService.getRemainingTime();

		if (!expiresAt || remainingTime === null) {
			throw new Error('Failed to activate permit join');
		}

		this.logger.debug(`[PERMIT JOIN] Successfully activated, expires at ${expiresAt.toISOString()}`);

		const data = new PermitJoinDataModel();
		data.success = true;
		data.expiresAt = expiresAt;
		data.remainingTime = remainingTime;

		const response = new PermitJoinResponseModel();
		response.data = data;

		return response;
	}

	@Get('permit-join/status')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		summary: 'Get permit join status',
		description: 'Returns the current permit join status. Requires owner or admin role.',
	})
	@ApiSuccessResponse(PermitJoinStatusResponseModel, 'Returns permit join status')
	getPermitJoinStatus(): PermitJoinStatusResponseModel {
		const deploymentMode = this.permitJoinService.getDeploymentMode();
		const available = deploymentMode !== DeploymentMode.ALL_IN_ONE;
		const active = this.permitJoinService.isPermitJoinActive();
		const expiresAt = this.permitJoinService.getExpiresAt();
		const remainingTime = this.permitJoinService.getRemainingTime();

		const data = new PermitJoinStatusDataModel();
		data.active = active;
		data.expiresAt = expiresAt;
		data.remainingTime = remainingTime;
		data.deploymentMode = deploymentMode;
		data.available = available;

		const response = new PermitJoinStatusResponseModel();
		response.data = data;

		return response;
	}

	@Delete('permit-join')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		summary: 'Deactivate permit join',
		description: 'Immediately deactivates permit join. Requires owner or admin role.',
	})
	@ApiNoContentResponse({ description: 'Permit join deactivated successfully' })
	@HttpCode(204)
	deactivatePermitJoin(): void {
		this.logger.debug('[PERMIT JOIN] Deactivating permit join');
		this.permitJoinService.deactivatePermitJoin();
		this.logger.debug('[PERMIT JOIN] Successfully deactivated');
	}
}
