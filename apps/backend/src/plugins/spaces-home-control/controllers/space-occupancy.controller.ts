import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { AuthenticatedRequest } from '../../../modules/auth/guards/auth.guard';
import { SPACES_MODULE_API_TAG_NAME } from '../../../modules/spaces/spaces.constants';
import { ApiSuccessResponse } from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { activityActor } from '../activity/activity-actor';
import { ReqActivityRevisionDto } from '../dto/activity-mode.dto';
import { ReqUpdateSpaceOccupancyDto } from '../dto/space-occupancy.dto';
import {
	SpaceOccupancyResponseModel,
	SpaceOccupancySensorModel,
	SpaceOccupancySensorsResponseModel,
	SpaceOccupancyStateModel,
	SpaceOccupancyStateResponseModel,
} from '../models/space-occupancy.model';
import { SpaceOccupancyConfigService } from '../services/space-occupancy-config.service';
import { SpaceOccupancyInputsService } from '../services/space-occupancy-inputs.service';
import { SpaceOccupancyService } from '../services/space-occupancy.service';

@ApiTags(SPACES_MODULE_API_TAG_NAME)
@Controller('spaces/:id/occupancy')
export class SpaceOccupancyController {
	constructor(
		private readonly configs: SpaceOccupancyConfigService,
		private readonly runtime: SpaceOccupancyService,
		private readonly inputs: SpaceOccupancyInputsService,
	) {}

	@ApiOperation({
		tags: [SPACES_MODULE_API_TAG_NAME],
		operationId: 'get-spaces-home-control-plugin-occupancy',
		summary: 'Read occupancy configuration',
		description: 'Read opt-in sensor selection, timeout and occupied/vacant mode mapping. No actuation.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(SpaceOccupancyResponseModel, 'Occupancy configuration')
	@Get()
	async get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<SpaceOccupancyResponseModel> {
		return Object.assign(new SpaceOccupancyResponseModel(), { data: await this.configs.get(id) });
	}
	@ApiOperation({
		tags: [SPACES_MODULE_API_TAG_NAME],
		operationId: 'replace-spaces-home-control-plugin-occupancy',
		summary: 'Replace occupancy configuration',
		description:
			'Owner/admin revision-checked replacement. Empty/unavailable evidence never means vacant. Saving does not issue a mode command.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(SpaceOccupancyResponseModel, 'Saved occupancy configuration')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Put()
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqUpdateSpaceOccupancyDto,
	): Promise<SpaceOccupancyResponseModel> {
		return Object.assign(new SpaceOccupancyResponseModel(), { data: await this.configs.update(id, body.data) });
	}
	@ApiOperation({
		tags: [SPACES_MODULE_API_TAG_NAME],
		operationId: 'state-spaces-home-control-plugin-occupancy',
		summary: 'Read observed occupancy and manual precedence',
		description:
			'Read-only qualified sensor state, vacancy countdown and last software attempt; not a physical acknowledgement.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(SpaceOccupancyStateResponseModel, 'Observed occupancy state')
	@Get('state')
	async state(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<SpaceOccupancyStateResponseModel> {
		return Object.assign(new SpaceOccupancyStateResponseModel(), {
			data: Object.assign(new SpaceOccupancyStateModel(), await this.runtime.stateFor(id)),
		});
	}
	@ApiOperation({
		tags: [SPACES_MODULE_API_TAG_NAME],
		operationId: 'sensors-spaces-home-control-plugin-occupancy',
		summary: 'List eligible room occupancy inputs',
		description:
			'Motion/occupancy DETECTED properties currently belonging to this room or zone. Camera integration is optional.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(SpaceOccupancySensorsResponseModel, 'Eligible sensor properties')
	@Get('sensors')
	async sensors(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<SpaceOccupancySensorsResponseModel> {
		await this.configs.get(id);
		return Object.assign(new SpaceOccupancySensorsResponseModel(), {
			data: (await this.inputs.list(id)).map((sensor) => Object.assign(new SpaceOccupancySensorModel(), sensor)),
		});
	}
	@ApiOperation({
		tags: [SPACES_MODULE_API_TAG_NAME],
		operationId: 'resume-spaces-home-control-plugin-occupancy',
		summary: 'Explicitly clear the occupancy manual override',
		description:
			'Resume observation-driven automation using the current configuration revision. Does not clear thermostat manual hold, OFF or protective controls.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid' })
	@ApiSuccessResponse(SpaceOccupancyResponseModel, 'Resumed occupancy configuration')
	@HttpCode(200)
	@Post('resume')
	async resume(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqActivityRevisionDto,
		@Req() request: AuthenticatedRequest,
	): Promise<SpaceOccupancyResponseModel> {
		activityActor(request.auth);
		return Object.assign(new SpaceOccupancyResponseModel(), {
			data: await this.configs.clearManual(id, body.data.expected_revision),
		});
	}
}
