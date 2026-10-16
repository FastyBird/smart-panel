import { Body, Controller, Get, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Post, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { AuthenticatedRequest } from '../../../modules/auth/guards/auth.guard';
import { SPACES_MODULE_API_TAG_NAME } from '../../../modules/spaces/spaces.constants';
import { ApiSuccessResponse } from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { activityActor } from '../activity/activity-actor';
import { ActivityMode } from '../activity/space-activity.constants';
import { ReqActivityRevisionDto, ReqDeactivateActivityDto, ReqUpdateActivityModeDto } from '../dto/activity-mode.dto';
import {
	ActivityConfigurationResponseModel,
	ActivityModesResponseModel,
	ActivityPreviewResponseModel,
	ActivityStateResponseModel,
} from '../models/activity-response.model';
import { SpaceActivityConfigService } from '../services/space-activity-config.service';
import { SpaceModeService } from '../services/space-mode.service';

@ApiTags(SPACES_MODULE_API_TAG_NAME)
@Controller('spaces/:id/activity-modes')
export class SpaceModesController {
	constructor(
		private readonly modes: SpaceModeService,
		private readonly configs: SpaceActivityConfigService,
	) {}

	@ApiOperation({
		tags: [SPACES_MODULE_API_TAG_NAME],
		operationId: 'available-spaces-home-control-plugin-activity-mode',
		summary: 'List enabled space activity modes',
		description: 'List enabled space activity modes.',
	})
	@ApiParam({ name: 'id', description: 'Space ID', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(ActivityModesResponseModel, 'List enabled space activity modes')
	@Get('')
	async available(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<ActivityModesResponseModel> {
		return Object.assign(new ActivityModesResponseModel(), {
			data: (await this.modes.getAvailableModes(id)).filter((mode) => mode.activityEnabled),
		});
	}

	@ApiOperation({
		tags: [SPACES_MODULE_API_TAG_NAME],
		operationId: 'active-spaces-home-control-plugin-activity-mode',
		summary: 'Read persisted activity state',
		description: 'Read persisted activity state.',
	})
	@ApiParam({ name: 'id', description: 'Space ID', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(ActivityStateResponseModel, 'Read persisted activity state')
	@Get('active')
	async active(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<ActivityStateResponseModel> {
		return Object.assign(new ActivityStateResponseModel(), { data: await this.modes.getActiveMode(id) });
	}

	@ApiOperation({
		tags: [SPACES_MODULE_API_TAG_NAME],
		operationId: 'configuration-spaces-home-control-plugin-activity-mode',
		summary: 'Read space activity configuration',
		description: 'Read space activity configuration.',
	})
	@ApiParam({ name: 'id', description: 'Space ID', type: 'string', format: 'uuid' })
	@ApiParam({ name: 'mode', description: 'Built-in activity', enum: ActivityMode })
	@ApiSuccessResponse(ActivityConfigurationResponseModel, 'Read space activity configuration')
	@Get(':mode/config')
	async configuration(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Param('mode', new ParseEnumPipe(ActivityMode)) mode: ActivityMode,
	): Promise<ActivityConfigurationResponseModel> {
		return Object.assign(new ActivityConfigurationResponseModel(), { data: await this.configs.get(id, mode) });
	}

	@ApiOperation({
		tags: [SPACES_MODULE_API_TAG_NAME],
		operationId: 'update-spaces-home-control-plugin-activity-mode',
		summary: 'Replace space activity configuration using revision CAS',
		description: 'Replace space activity configuration using revision CAS.',
	})
	@ApiParam({ name: 'id', description: 'Space ID', type: 'string', format: 'uuid' })
	@ApiParam({ name: 'mode', description: 'Built-in activity', enum: ActivityMode })
	@ApiSuccessResponse(ActivityConfigurationResponseModel, 'Replace space activity configuration using revision CAS')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Put(':mode/config')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Param('mode', new ParseEnumPipe(ActivityMode)) mode: ActivityMode,
		@Body() body: ReqUpdateActivityModeDto,
	): Promise<ActivityConfigurationResponseModel> {
		return Object.assign(new ActivityConfigurationResponseModel(), {
			data: await this.configs.update(id, mode, body.data),
		});
	}

	@ApiOperation({
		tags: [SPACES_MODULE_API_TAG_NAME],
		operationId: 'reset-spaces-home-control-plugin-activity-mode',
		summary: 'Copy authored defaults into this space using revision CAS',
		description: 'Copy authored defaults into this space using revision CAS.',
	})
	@ApiParam({ name: 'id', description: 'Space ID', type: 'string', format: 'uuid' })
	@ApiParam({ name: 'mode', description: 'Built-in activity', enum: ActivityMode })
	@ApiSuccessResponse(ActivityConfigurationResponseModel, 'Copy authored defaults into this space using revision CAS')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Post(':mode/config/reset')
	@HttpCode(200)
	async reset(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Param('mode', new ParseEnumPipe(ActivityMode)) mode: ActivityMode,
		@Body() body: ReqActivityRevisionDto,
	): Promise<ActivityConfigurationResponseModel> {
		return Object.assign(new ActivityConfigurationResponseModel(), {
			data: await this.configs.reset(id, mode, body.data.expected_revision),
		});
	}

	@ApiOperation({
		tags: [SPACES_MODULE_API_TAG_NAME],
		operationId: 'preview-spaces-home-control-plugin-activity-mode',
		summary: 'Preview domain readiness without actuation',
		description: 'Preview domain readiness without actuation.',
	})
	@ApiParam({ name: 'id', description: 'Space ID', type: 'string', format: 'uuid' })
	@ApiParam({ name: 'mode', description: 'Built-in activity', enum: ActivityMode })
	@ApiSuccessResponse(ActivityPreviewResponseModel, 'Preview domain readiness without actuation')
	@Post(':mode/preview')
	@HttpCode(200)
	async preview(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Param('mode', new ParseEnumPipe(ActivityMode)) mode: ActivityMode,
		@Body() body: ReqActivityRevisionDto,
	): Promise<ActivityPreviewResponseModel> {
		return Object.assign(new ActivityPreviewResponseModel(), {
			data: await this.modes.preview(id, mode, body.data.expected_revision),
		});
	}

	@ApiOperation({
		tags: [SPACES_MODULE_API_TAG_NAME],
		operationId: 'activate-spaces-home-control-plugin-activity-mode',
		summary: 'Activate a mode; preserve selection on partial failure',
		description: 'Activate a mode; preserve selection on partial failure.',
	})
	@ApiParam({ name: 'id', description: 'Space ID', type: 'string', format: 'uuid' })
	@ApiParam({ name: 'mode', description: 'Built-in activity', enum: ActivityMode })
	@ApiSuccessResponse(ActivityStateResponseModel, 'Activate a mode; preserve selection on partial failure')
	@Post(':mode/activate')
	@HttpCode(200)
	async activate(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Param('mode', new ParseEnumPipe(ActivityMode)) mode: ActivityMode,
		@Body() body: ReqActivityRevisionDto,
		@Req() request: AuthenticatedRequest,
	): Promise<ActivityStateResponseModel> {
		return Object.assign(new ActivityStateResponseModel(), {
			data: await this.modes.activateMode(id, mode, body.data.expected_revision, activityActor(request.auth)),
		});
	}

	@ApiOperation({
		tags: [SPACES_MODULE_API_TAG_NAME],
		operationId: 'deactivate-spaces-home-control-plugin-activity-mode',
		summary: 'Clear manual selection; no invented undo of device changes',
		description: 'Clear manual selection; no invented undo of device changes.',
	})
	@ApiParam({ name: 'id', description: 'Space ID', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(ActivityStateResponseModel, 'Clear manual selection; no invented undo of device changes')
	@Post('deactivate')
	@HttpCode(200)
	async deactivate(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqDeactivateActivityDto,
		@Req() request: AuthenticatedRequest,
	): Promise<ActivityStateResponseModel> {
		return Object.assign(new ActivityStateResponseModel(), {
			data: await this.modes.deactivateMode(id, body.data.activation_id, activityActor(request.auth)),
		});
	}
}
