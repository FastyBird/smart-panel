import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { DevicesResponseModel } from '../../devices/models/devices-response.model';
import { DisplaysResponseModel } from '../../displays/models/displays-response.model';
import {
	ApiBadRequestResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { ReqBulkAssignDto } from '../dto/bulk-assign.dto';
import { ReqClimateIntentDto } from '../dto/climate-intent.dto';
import { ReqCreateSpaceDto } from '../dto/create-space.dto';
import { ReqLightingIntentDto } from '../dto/lighting-intent.dto';
import { ReqUpdateSpaceDto } from '../dto/update-space.dto';
import {
	BulkAssignmentResponseModel,
	BulkAssignmentResultDataModel,
	ClimateIntentResponseModel,
	ClimateIntentResultDataModel,
	ClimateStateDataModel,
	ClimateStateResponseModel,
	LightingIntentResponseModel,
	LightingIntentResultDataModel,
	ProposedSpaceDataModel,
	ProposedSpacesResponseModel,
	SpaceResponseModel,
	SpacesResponseModel,
} from '../models/spaces-response.model';
import { SpaceIntentService } from '../services/space-intent.service';
import { SpacesService } from '../services/spaces.service';
import { SPACES_MODULE_API_TAG_NAME, SPACES_MODULE_NAME } from '../spaces.constants';

@ApiTags(SPACES_MODULE_API_TAG_NAME)
@Controller('spaces')
export class SpacesController {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpacesController');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly spaceIntentService: SpaceIntentService,
	) {}

	@Get()
	@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
	@ApiOperation({
		operationId: 'get-spaces-module-spaces',
		summary: 'List all spaces',
		description: 'Retrieves a list of all spaces (rooms/zones).',
	})
	@ApiSuccessResponse(SpacesResponseModel, 'Returns a list of spaces')
	async findAll(): Promise<SpacesResponseModel> {
		this.logger.debug('Fetching all spaces');

		const spaces = await this.spacesService.findAll();

		const response = new SpacesResponseModel();

		response.data = spaces;

		return response;
	}

	@Get('propose')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'get-spaces-module-propose',
		summary: 'Propose spaces from device names',
		description:
			'Analyzes device names and proposes space (room) names based on common patterns. ' +
			'Returns a list of proposed spaces with matching device IDs. Requires owner or admin role.',
	})
	@ApiSuccessResponse(ProposedSpacesResponseModel, 'Returns proposed spaces')
	async proposeSpaces(): Promise<ProposedSpacesResponseModel> {
		this.logger.debug('Proposing spaces from device names');

		const proposals = await this.spacesService.proposeSpaces();

		const response = new ProposedSpacesResponseModel();

		response.data = proposals.map((p) => {
			const model = new ProposedSpaceDataModel();
			model.name = p.name;
			model.deviceIds = p.deviceIds;
			model.deviceCount = p.deviceCount;
			return model;
		});

		return response;
	}

	@Get(':id')
	@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
	@ApiOperation({
		operationId: 'get-spaces-module-space',
		summary: 'Get space by ID',
		description: 'Retrieves a specific space by its unique identifier.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(SpaceResponseModel, 'Returns the space')
	@ApiNotFoundResponse('Space not found')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<SpaceResponseModel> {
		this.logger.debug(`Fetching space with id=${id}`);

		const space = await this.spacesService.getOneOrThrow(id);

		const response = new SpaceResponseModel();

		response.data = space;

		return response;
	}

	@Post()
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space',
		summary: 'Create a new space',
		description: 'Creates a new space (room/zone). Requires owner or admin role.',
	})
	@ApiSuccessResponse(SpaceResponseModel, 'Returns the created space')
	@ApiBadRequestResponse('Invalid space data')
	@ApiUnprocessableEntityResponse('Space validation failed')
	async create(@Body() body: ReqCreateSpaceDto): Promise<SpaceResponseModel> {
		this.logger.debug('Creating new space');

		const space = await this.spacesService.create(body.data);

		const response = new SpaceResponseModel();

		response.data = space;

		return response;
	}

	@Patch(':id')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'update-spaces-module-space',
		summary: 'Update space',
		description: 'Updates an existing space. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(SpaceResponseModel, 'Returns the updated space')
	@ApiNotFoundResponse('Space not found')
	@ApiUnprocessableEntityResponse('Invalid space data')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqUpdateSpaceDto,
	): Promise<SpaceResponseModel> {
		this.logger.debug(`Updating space with id=${id}`);

		const space = await this.spacesService.update(id, body.data);

		const response = new SpaceResponseModel();

		response.data = space;

		return response;
	}

	@Delete(':id')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'delete-spaces-module-space',
		summary: 'Delete space',
		description:
			'Removes a space from the system. Devices and displays in this space will be unassigned. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiNoContentResponse({ description: 'Space deleted successfully' })
	@ApiNotFoundResponse('Space not found')
	@HttpCode(204)
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`Removing space with id=${id}`);

		await this.spacesService.remove(id);

		this.logger.debug(`Successfully removed space with id=${id}`);
	}

	@Get(':id/devices')
	@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
	@ApiOperation({
		operationId: 'get-spaces-module-space-devices',
		summary: 'List devices in space',
		description: 'Retrieves all devices assigned to a specific space.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(DevicesResponseModel, 'Returns the list of devices in the space')
	@ApiNotFoundResponse('Space not found')
	async findDevices(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<DevicesResponseModel> {
		this.logger.debug(`Fetching devices for space with id=${id}`);

		const devices = await this.spacesService.findDevicesBySpace(id);

		const response = new DevicesResponseModel();

		response.data = devices;

		return response;
	}

	@Get(':id/displays')
	@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
	@ApiOperation({
		operationId: 'get-spaces-module-space-displays',
		summary: 'List displays in space',
		description: 'Retrieves all displays assigned to a specific space.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(DisplaysResponseModel, 'Returns the list of displays in the space')
	@ApiNotFoundResponse('Space not found')
	async findDisplays(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<DisplaysResponseModel> {
		this.logger.debug(`Fetching displays for space with id=${id}`);

		const displays = await this.spacesService.findDisplaysBySpace(id);

		const response = new DisplaysResponseModel();

		response.data = displays;

		return response;
	}

	@Post(':id/assign')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space-assign',
		summary: 'Bulk assign devices/displays to space',
		description:
			'Assigns multiple devices and/or displays to a space in a single operation. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(BulkAssignmentResponseModel, 'Returns the assignment result')
	@ApiNotFoundResponse('Space not found')
	@ApiUnprocessableEntityResponse('Invalid assignment data')
	async bulkAssign(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqBulkAssignDto,
	): Promise<BulkAssignmentResponseModel> {
		this.logger.debug(`Bulk assigning to space with id=${id}`);

		const result = await this.spacesService.bulkAssign(id, body.data);

		const resultData = new BulkAssignmentResultDataModel();
		resultData.success = true;
		resultData.devicesAssigned = result.devicesAssigned;
		resultData.displaysAssigned = result.displaysAssigned;

		const response = new BulkAssignmentResponseModel();
		response.data = resultData;

		return response;
	}

	@Post(':id/intents/lighting')
	@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
	@ApiOperation({
		operationId: 'create-spaces-module-space-lighting-intent',
		summary: 'Execute lighting intent for space',
		description:
			'Executes a lighting intent command for all lights in the space. ' +
			'Supports off, on, mode (work/relax/night), and brightness delta operations. ' +
			'Commands are applied only to lighting devices with supported capabilities.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(LightingIntentResponseModel, 'Returns the intent execution result')
	@ApiNotFoundResponse('Space not found')
	@ApiUnprocessableEntityResponse('Invalid intent data')
	async executeLightingIntent(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqLightingIntentDto,
	): Promise<LightingIntentResponseModel> {
		this.logger.debug(`Executing lighting intent for space with id=${id}`);

		const result = await this.spaceIntentService.executeLightingIntent(id, body.data);

		const resultData = new LightingIntentResultDataModel();
		resultData.success = result.success;
		resultData.affectedDevices = result.affectedDevices;
		resultData.failedDevices = result.failedDevices;

		const response = new LightingIntentResponseModel();
		response.data = resultData;

		return response;
	}

	@Get(':id/climate')
	@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
	@ApiOperation({
		operationId: 'get-spaces-module-space-climate',
		summary: 'Get climate state for space',
		description:
			'Retrieves the current climate state for a space, including temperature readings, ' +
			'target setpoint, and information about available climate control capabilities.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(ClimateStateResponseModel, 'Returns the climate state')
	@ApiNotFoundResponse('Space not found')
	async getClimateState(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<ClimateStateResponseModel> {
		this.logger.debug(`Fetching climate state for space with id=${id}`);

		const state = await this.spaceIntentService.getClimateState(id);

		const stateData = new ClimateStateDataModel();
		stateData.hasClimate = state.hasClimate;
		stateData.currentTemperature = state.currentTemperature;
		stateData.targetTemperature = state.targetTemperature;
		stateData.minSetpoint = state.minSetpoint;
		stateData.maxSetpoint = state.maxSetpoint;
		stateData.canSetSetpoint = state.canSetSetpoint;
		stateData.primaryThermostatId = state.primaryThermostatId;
		stateData.primarySensorId = state.primarySensorId;

		const response = new ClimateStateResponseModel();
		response.data = stateData;

		return response;
	}

	@Post(':id/intents/climate')
	@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
	@ApiOperation({
		operationId: 'create-spaces-module-space-climate-intent',
		summary: 'Execute climate intent for space',
		description:
			'Executes a climate intent command for the primary thermostat in the space. ' +
			'Supports setpoint delta (+/- adjustments) and direct setpoint set operations. ' +
			'The target setpoint is clamped to safe min/max limits.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(ClimateIntentResponseModel, 'Returns the intent execution result')
	@ApiNotFoundResponse('Space not found')
	@ApiUnprocessableEntityResponse('Invalid intent data')
	async executeClimateIntent(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqClimateIntentDto,
	): Promise<ClimateIntentResponseModel> {
		this.logger.debug(`Executing climate intent for space with id=${id}`);

		const result = await this.spaceIntentService.executeClimateIntent(id, body.data);

		const resultData = new ClimateIntentResultDataModel();
		resultData.success = result.success;
		resultData.affectedDevices = result.affectedDevices;
		resultData.failedDevices = result.failedDevices;
		resultData.newSetpoint = result.newSetpoint;

		const response = new ClimateIntentResponseModel();
		response.data = resultData;

		return response;
	}
}
