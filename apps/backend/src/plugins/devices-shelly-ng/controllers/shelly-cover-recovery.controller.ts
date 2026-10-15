import { Body, Controller, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthenticatedRequest } from '../../../modules/auth/guards/auth.guard';
import {
	ApiBadRequestResponse,
	ApiConflictResponse,
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME } from '../devices-shelly-ng.constants';
import { ReqRecoverCoverOrderingDto } from '../dto/cover-recovery.dto';
import { CoverRecoveryContextResponseModel, CoverRecoveryResponseModel } from '../models/cover-recovery.model';
import { ShellyCoverRecoveryService } from '../services/shelly-cover-recovery.service';

@ApiTags(DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME)
@Controller('devices/:deviceId/channels/:channelId/properties/:propertyId/cover-ordering-recovery')
export class ShellyCoverRecoveryController {
	constructor(private readonly recovery: ShellyCoverRecoveryService) {}
	private actor(request: AuthenticatedRequest): string {
		const auth = request.auth;
		if (auth?.type !== 'user' || !auth.id || ![UserRole.OWNER, UserRole.ADMIN].includes(auth.role))
			throw new ForbiddenException('Identified owner or administrator required');
		return auth.id;
	}
	@ApiOperation({
		tags: [DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME],
		summary: 'Get unresolved ordinary cover ordering context',
		description:
			'Owner/admin only. Short-lived canonical metadata and connection context; this is not command authority.',
		operationId: 'get-devices-shelly-ng-plugin-cover-ordering-recovery',
	})
	@ApiSuccessResponse(CoverRecoveryContextResponseModel, 'Current unresolved ordinary cover ordering context')
	@ApiForbiddenResponse('Identified owner or administrator user session required')
	@ApiBadRequestResponse('Invalid canonical device/channel/property identifiers')
	@ApiNotFoundResponse('No current canonical motor or unresolved ordering reservation')
	@ApiConflictResponse('Recovery context or guarded provider changed')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Get()
	async context(
		@Req() request: AuthenticatedRequest,
		@Param('deviceId', new ParseUUIDPipe()) deviceId: string,
		@Param('channelId', new ParseUUIDPipe()) channelId: string,
		@Param('propertyId', new ParseUUIDPipe()) propertyId: string,
	): Promise<CoverRecoveryContextResponseModel> {
		const response = new CoverRecoveryContextResponseModel();
		response.data = await this.recovery.context(this.actor(request), deviceId, channelId, propertyId);
		return response;
	}
	@ApiOperation({
		tags: [DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME],
		summary: 'Accept unresolved ordinary cover ordering uncertainty',
		description:
			'Explicit owner/admin physical handback responsibility. Previously sent actions may still execute. Fresh nonmoving status is a current-condition prerequisite, never upstream drain proof or command completion. No hardware command is sent.',
		operationId: 'recover-devices-shelly-ng-plugin-cover-ordering',
	})
	@ApiSuccessResponse(CoverRecoveryResponseModel, 'Audited operator uncertainty override; no command confirmation')
	@ApiForbiddenResponse('Identified owner or administrator user session required')
	@ApiBadRequestResponse('Explicit acknowledgement, bounded reason and current context required')
	@ApiNotFoundResponse('Current canonical ordinary physical motor is unavailable')
	@ApiConflictResponse(
		'Active dispatch, stale context/reservation, invalid current condition or audit conflict; ordering stays unresolved',
	)
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Post()
	@HttpCode(200)
	async recover(
		@Req() request: AuthenticatedRequest,
		@Param('deviceId', new ParseUUIDPipe()) deviceId: string,
		@Param('channelId', new ParseUUIDPipe()) channelId: string,
		@Param('propertyId', new ParseUUIDPipe()) propertyId: string,
		@Body() dto: ReqRecoverCoverOrderingDto,
	): Promise<CoverRecoveryResponseModel> {
		const response = new CoverRecoveryResponseModel();
		response.data = await this.recovery.recover(this.actor(request), deviceId, channelId, propertyId, dto.data);
		return response;
	}
}
