import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { SPACES_MODULE_API_TAG_NAME } from '../../../modules/spaces/spaces.constants';
import { ApiSuccessResponse } from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { ReqUpdateSpaceModeScheduleDto } from '../dto/space-mode-schedule.dto';
import {
	SpaceModeScheduleResponseModel,
	SpaceModeScheduleStateResponseModel,
} from '../models/space-mode-schedule-response.model';
import { SpaceModeScheduleConfigService } from '../services/space-mode-schedule-config.service';
import { SpaceModeSchedulerService } from '../services/space-mode-scheduler.service';

@ApiTags(SPACES_MODULE_API_TAG_NAME)
@Controller('spaces/:id/schedules')
export class SpaceModeSchedulesController {
	constructor(
		private readonly schedules: SpaceModeScheduleConfigService,
		private readonly scheduler: SpaceModeSchedulerService,
	) {}

	@ApiOperation({
		tags: [SPACES_MODULE_API_TAG_NAME],
		operationId: 'get-spaces-home-control-plugin-schedule',
		summary: 'Read the weekly space schedule',
		description: 'Read authored entries, enablement, timezone override and configuration revision. No actuation.',
	})
	@ApiParam({ name: 'id', description: 'Room or zone identity', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(SpaceModeScheduleResponseModel, 'Persisted schedule configuration')
	@Get()
	async get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<SpaceModeScheduleResponseModel> {
		return Object.assign(new SpaceModeScheduleResponseModel(), { data: await this.schedules.get(id) });
	}

	@ApiOperation({
		tags: [SPACES_MODULE_API_TAG_NAME],
		operationId: 'replace-spaces-home-control-plugin-schedule',
		summary: 'Replace the weekly space schedule',
		description:
			'Atomically create, edit or remove entries and change enablement/timezone using an expected revision. Changes apply only to future occurrences; they do not activate a mode.',
	})
	@ApiParam({ name: 'id', description: 'Room or zone identity', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(SpaceModeScheduleResponseModel, 'Saved schedule configuration')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Put()
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqUpdateSpaceModeScheduleDto,
	): Promise<SpaceModeScheduleResponseModel> {
		return Object.assign(new SpaceModeScheduleResponseModel(), { data: await this.schedules.update(id, body.data) });
	}

	@ApiOperation({
		tags: [SPACES_MODULE_API_TAG_NAME],
		operationId: 'state-spaces-home-control-plugin-schedule',
		summary: 'Read current and next scheduled modes',
		description:
			'Evaluate the current plan without replaying missed actions. Planned modes are distinct from actual activity or device state. Includes manual precedence and scheduler availability.',
	})
	@ApiParam({ name: 'id', description: 'Room or zone identity', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(SpaceModeScheduleStateResponseModel, 'Read-only schedule state')
	@Get('state')
	async state(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<SpaceModeScheduleStateResponseModel> {
		return Object.assign(new SpaceModeScheduleStateResponseModel(), {
			data: await this.scheduler.getScheduleState(id),
		});
	}
}
