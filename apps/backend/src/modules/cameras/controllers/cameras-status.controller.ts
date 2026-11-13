import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import { ConfigService } from '../../config/services/config.service';
import {
	ApiForbiddenResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { CAMERAS_MODULE_API_TAG_NAME, CAMERAS_MODULE_NAME } from '../cameras.constants';
import { LiveStreamGateway } from '../gateway/live-stream.gateway';
import { CamerasModuleEnabledGuard } from '../guards/cameras-module-enabled.guard';
import { CamerasConfigModel } from '../models/config.model';
import {
	CamerasRelayStatusModel,
	CamerasSessionsStatusModel,
	CamerasStatusModel,
	CamerasStatusResponseModel,
} from '../models/status.model';
import { Go2rtcService } from '../services/go2rtc.service';

import { requireCameraOwner } from './camera-owner.utils';

@ApiTags(CAMERAS_MODULE_API_TAG_NAME)
@UseGuards(CamerasModuleEnabledGuard)
@Controller('status')
export class CamerasStatusController {
	constructor(
		private readonly configService: ConfigService,
		private readonly go2rtc: Go2rtcService,
		private readonly gateway: LiveStreamGateway,
	) {}

	@ApiOperation({
		tags: [CAMERAS_MODULE_API_TAG_NAME],
		summary: 'Get the live view status',
		description: 'Reports the state of the live view relay and how many live sockets are open.',
		operationId: 'get-cameras-module-status',
	})
	@ApiSuccessResponse(CamerasStatusResponseModel, 'Status retrieved successfully')
	@ApiForbiddenResponse('Cameras are not available to this caller')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	getStatus(@Req() req: AuthenticatedRequest): CamerasStatusResponseModel {
		requireCameraOwner(req);

		const config = this.configService.getModuleConfig<CamerasConfigModel>(CAMERAS_MODULE_NAME);
		const { mode, state, reason, version } = this.go2rtc.getStatus();

		const relay = new CamerasRelayStatusModel();

		relay.mode = mode;
		relay.state = state;
		relay.reason = reason;
		relay.version = version;

		const sessions = new CamerasSessionsStatusModel();

		sessions.active = this.gateway.getActiveCount();
		sessions.max = config.maxSessions;
		sessions.maxPerCamera = config.maxSessionsPerCamera;

		const data = new CamerasStatusModel();

		data.relay = relay;
		data.sessions = sessions;

		const response = new CamerasStatusResponseModel();

		response.data = data;

		return response;
	}
}
