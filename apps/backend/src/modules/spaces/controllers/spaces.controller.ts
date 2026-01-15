import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiExtraModels, ApiNoContentResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

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
import { ReqBulkSetClimateRolesDto, ReqSetClimateRoleDto } from '../dto/climate-role.dto';
import { ReqCreateSpaceDto } from '../dto/create-space.dto';
import { ReqLightingIntentDto } from '../dto/lighting-intent.dto';
import { ReqBulkSetLightingRolesDto, ReqSetLightingRoleDto } from '../dto/lighting-role.dto';
import { ReqSuggestionFeedbackDto } from '../dto/suggestion.dto';
import { ReqUpdateSpaceDto } from '../dto/update-space.dto';
import {
	BulkAssignmentResponseModel,
	BulkAssignmentResultDataModel,
	BulkClimateRoleResultItemModel,
	BulkClimateRolesResponseModel,
	BulkClimateRolesResultDataModel,
	BulkLightingRoleResultItemModel,
	BulkLightingRolesResponseModel,
	BulkLightingRolesResultDataModel,
	CategoryTemplateDataModel,
	CategoryTemplatesResponseModel,
	ClimateIntentResponseModel,
	ClimateIntentResultDataModel,
	ClimateRoleResponseModel,
	ClimateStateDataModel,
	ClimateStateResponseModel,
	ClimateTargetDataModel,
	ClimateTargetsResponseModel,
	ContextSnapshotDataModel,
	ContextSnapshotResponseModel,
	IntentCatalogDataModel,
	IntentCatalogResponseModel,
	IntentCategoryDataModel,
	IntentEnumValueDataModel,
	IntentParamDataModel,
	IntentTypeDataModel,
	LightStateSnapshotDataModel,
	LightTargetDataModel,
	LightTargetsResponseModel,
	LightingContextDataModel,
	LightingIntentResponseModel,
	LightingIntentResultDataModel,
	LightingRoleMetaDataModel,
	LightingRoleResponseModel,
	LightingStateDataModel,
	LightingStateResponseModel,
	LightingSummaryDataModel,
	OtherLightsStateDataModel,
	RoleAggregatedStateDataModel,
	RoleLastIntentDataModel,
	RolesStateMapDataModel,
	ProposedSpaceDataModel,
	ProposedSpacesResponseModel,
	QuickActionDataModel,
	SpaceResponseModel,
	SpacesResponseModel,
	SuggestionDataModel,
	SuggestionFeedbackResponseModel,
	SuggestionFeedbackResultDataModel,
	SuggestionResponseModel,
	UndoResultDataModel,
	UndoResultResponseModel,
	UndoStateDataModel,
	UndoStateResponseModel,
} from '../models/spaces-response.model';
import { SpaceClimateRoleService } from '../services/space-climate-role.service';
import { SpaceContextSnapshotService } from '../services/space-context-snapshot.service';
import { SpaceIntentService } from '../services/space-intent.service';
import { SpaceLightingRoleService } from '../services/space-lighting-role.service';
import { SpaceLightingStateService } from '../services/space-lighting-state.service';
import { SpaceSuggestionService } from '../services/space-suggestion.service';
import { SpaceUndoHistoryService } from '../services/space-undo-history.service';
import { SpacesService } from '../services/spaces.service';
import {
	IntentCategory,
	LightingRole,
	QUICK_ACTION_CATALOG,
	SPACES_MODULE_API_TAG_NAME,
	SPACES_MODULE_NAME,
	SPACE_CATEGORY_TEMPLATES,
	SpaceCategory,
} from '../spaces.constants';
import { SpacesNotFoundException } from '../spaces.exceptions';
import { IntentSpecLoaderService } from '../spec';

@ApiTags(SPACES_MODULE_API_TAG_NAME)
@ApiExtraModels(
	LightingStateResponseModel,
	LightingStateDataModel,
	RolesStateMapDataModel,
	RoleAggregatedStateDataModel,
	RoleLastIntentDataModel,
	OtherLightsStateDataModel,
)
@Controller('spaces')
export class SpacesController {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpacesController');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly spaceIntentService: SpaceIntentService,
		private readonly spaceLightingRoleService: SpaceLightingRoleService,
		private readonly spaceLightingStateService: SpaceLightingStateService,
		private readonly spaceClimateRoleService: SpaceClimateRoleService,
		private readonly spaceSuggestionService: SpaceSuggestionService,
		private readonly spaceContextSnapshotService: SpaceContextSnapshotService,
		private readonly spaceUndoHistoryService: SpaceUndoHistoryService,
		private readonly intentSpecLoaderService: IntentSpecLoaderService,
	) {}

	@Get()
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
			model.type = p.type;
			model.category = p.category;
			model.deviceIds = p.deviceIds;
			model.deviceCount = p.deviceCount;
			return model;
		});

		return response;
	}

	@Get('categories/templates')
	@ApiOperation({
		operationId: 'get-spaces-module-category-templates',
		summary: 'List space category templates',
		description:
			'Retrieves all available space category templates with their default icons and descriptions. ' +
			'Templates provide suggested values when creating spaces of common room types.',
	})
	@ApiSuccessResponse(CategoryTemplatesResponseModel, 'Returns category templates')
	getCategoryTemplates(): CategoryTemplatesResponseModel {
		this.logger.debug('Fetching category templates');

		const templates = Object.entries(SPACE_CATEGORY_TEMPLATES).map(([category, template]) => {
			const model = new CategoryTemplateDataModel();
			model.category = category as SpaceCategory;
			model.icon = template.icon;
			model.description = template.description;
			return model;
		});

		const response = new CategoryTemplatesResponseModel();
		response.data = templates;

		return response;
	}

	@Get('intents/catalog')
	@ApiOperation({
		operationId: 'get-spaces-module-intent-catalog',
		summary: 'Get intent catalog',
		description:
			'Retrieves the complete intent catalog with all available intent categories, intent types, ' +
			'quick actions, and lighting roles. This provides metadata for building UI controls ' +
			'and discovering available space control capabilities.',
	})
	@ApiSuccessResponse(IntentCatalogResponseModel, 'Returns the intent catalog')
	getIntentCatalog(): IntentCatalogResponseModel {
		this.logger.debug('Fetching intent catalog');

		// Get intent categories from YAML spec loader
		const intentCatalog = this.intentSpecLoaderService.getIntentCatalog();

		// Transform intent categories
		const categories = intentCatalog.map((cat) => {
			const categoryData = new IntentCategoryDataModel();
			categoryData.category = cat.category as IntentCategory;
			categoryData.label = cat.label;
			categoryData.description = cat.description;
			categoryData.icon = cat.icon;
			categoryData.intents = cat.intents.map((intent) => {
				const intentData = new IntentTypeDataModel();
				intentData.type = intent.type;
				intentData.label = intent.label;
				intentData.description = intent.description;
				intentData.icon = intent.icon;
				intentData.params = intent.params.map((param) => {
					const paramData = new IntentParamDataModel();
					paramData.name = param.name;
					paramData.type = param.type;
					paramData.required = param.required;
					paramData.description = param.description;
					paramData.minValue = param.minValue;
					paramData.maxValue = param.maxValue;
					if (param.enumValues) {
						paramData.enumValues = param.enumValues.map((ev) => {
							const enumData = new IntentEnumValueDataModel();
							enumData.value = ev.value;
							enumData.label = ev.label;
							enumData.description = ev.description;
							enumData.icon = ev.icon;
							return enumData;
						});
					}
					return paramData;
				});
				return intentData;
			});
			return categoryData;
		});

		// Transform quick actions (still from constants for now)
		const quickActions = QUICK_ACTION_CATALOG.map((qa) => {
			const actionData = new QuickActionDataModel();
			actionData.type = qa.type;
			actionData.label = qa.label;
			actionData.description = qa.description;
			actionData.icon = qa.icon;
			actionData.category = qa.category;
			return actionData;
		});

		// Get lighting roles from YAML spec loader (via enums)
		const lightingRolesFromSpec = this.intentSpecLoaderService.getIntentCatalog().find((c) => c.category === 'lighting');
		const roleParam = lightingRolesFromSpec?.intents
			.find((i) => i.type === 'role_on')
			?.params.find((p) => p.name === 'role');

		const lightingRoles = (roleParam?.enumValues ?? []).map((role) => {
			const roleData = new LightingRoleMetaDataModel();
			roleData.value = role.value as LightingRole;
			roleData.label = role.label;
			roleData.description = role.description;
			roleData.icon = role.icon;
			return roleData;
		});

		const catalogData = new IntentCatalogDataModel();
		catalogData.categories = categories;
		catalogData.quickActions = quickActions;
		catalogData.lightingRoles = lightingRoles;

		const response = new IntentCatalogResponseModel();
		response.data = catalogData;

		return response;
	}

	@Get(':id')
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

	@Get(':id/children')
	@ApiOperation({
		operationId: 'get-spaces-module-space-children',
		summary: 'List child rooms of a zone',
		description: 'Retrieves all child rooms that belong to a zone. Only applicable for zones; returns empty for rooms.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Zone ID' })
	@ApiSuccessResponse(SpacesResponseModel, 'Returns the list of child rooms')
	@ApiNotFoundResponse('Space not found')
	async findChildren(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<SpacesResponseModel> {
		this.logger.debug(`Fetching child rooms for zone with id=${id}`);

		const children = await this.spacesService.getChildRooms(id);

		const response = new SpacesResponseModel();
		response.data = children;

		return response;
	}

	@Get(':id/parent')
	@ApiOperation({
		operationId: 'get-spaces-module-space-parent',
		summary: 'Get parent zone of a room',
		description:
			'Retrieves the parent zone for a room. Returns null if the room has no parent zone. ' +
			'Zones do not have parents.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Room ID' })
	@ApiSuccessResponse(SpaceResponseModel, 'Returns the parent zone or null')
	@ApiNotFoundResponse('Space not found')
	async findParent(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<SpaceResponseModel> {
		this.logger.debug(`Fetching parent zone for room with id=${id}`);

		const parent = await this.spacesService.getParentZone(id);

		const response = new SpaceResponseModel();
		response.data = parent;

		return response;
	}

	@Get('zones')
	@ApiOperation({
		operationId: 'get-spaces-module-zones',
		summary: 'List all zones',
		description: 'Retrieves all spaces of type zone. Useful for parent selection dropdowns.',
	})
	@ApiSuccessResponse(SpacesResponseModel, 'Returns a list of zones')
	async findAllZones(): Promise<SpacesResponseModel> {
		this.logger.debug('Fetching all zones');

		const zones = await this.spacesService.findAllZones();

		const response = new SpacesResponseModel();
		response.data = zones;

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
		stateData.mode = state.mode;
		stateData.currentTemperature = state.currentTemperature;
		stateData.currentHumidity = state.currentHumidity;
		stateData.targetTemperature = state.targetTemperature;
		stateData.heatingSetpoint = state.heatingSetpoint;
		stateData.coolingSetpoint = state.coolingSetpoint;
		stateData.minSetpoint = state.minSetpoint;
		stateData.maxSetpoint = state.maxSetpoint;
		stateData.canSetSetpoint = state.canSetSetpoint;
		stateData.supportsHeating = state.supportsHeating;
		stateData.supportsCooling = state.supportsCooling;
		stateData.isMixed = state.isMixed;
		stateData.devicesCount = state.devicesCount;

		const response = new ClimateStateResponseModel();
		response.data = stateData;

		return response;
	}

	@Post(':id/intents/climate')
	@ApiOperation({
		operationId: 'create-spaces-module-space-climate-intent',
		summary: 'Execute climate intent for space',
		description:
			'Executes a climate intent command for all primary climate devices (thermostats, heating units, air conditioners) in the space. ' +
			'Supports setpoint delta (+/- adjustments), direct setpoint set, and mode changes (HEAT/COOL/AUTO/OFF). ' +
			'Devices are filtered by their role (HEATING_ONLY, COOLING_ONLY, AUTO) and capability (presence of HEATER/COOLER channels). ' +
			'The target setpoint is clamped to the intersection of all device limits (most restrictive range).',
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
		resultData.mode = result.mode;
		resultData.newSetpoint = result.newSetpoint;
		resultData.heatingSetpoint = result.heatingSetpoint;
		resultData.coolingSetpoint = result.coolingSetpoint;

		const response = new ClimateIntentResponseModel();
		response.data = resultData;

		return response;
	}

	// ================================
	// Lighting State & Role Endpoints
	// ================================

	@Get(':id/lighting/state')
	@ApiOperation({
		operationId: 'get-spaces-module-space-lighting-state',
		summary: 'Get aggregated lighting state for space',
		description:
			'Retrieves the aggregated lighting state for a space, including per-role state (on/off, brightness, mixed status), ' +
			'mode detection (which lighting mode current state matches), and summary statistics. ' +
			'This endpoint provides pre-calculated values for UI display without panel-side calculation.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(LightingStateResponseModel, 'Returns the aggregated lighting state')
	@ApiNotFoundResponse('Space not found')
	async getLightingState(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<LightingStateResponseModel> {
		this.logger.debug(`Fetching lighting state for space with id=${id}`);

		const state = await this.spaceLightingStateService.getLightingState(id);

		if (!state) {
			throw new SpacesNotFoundException('Space not found');
		}

		const stateData = new LightingStateDataModel();
		stateData.detectedMode = state.detectedMode;
		stateData.modeConfidence = state.modeConfidence;
		stateData.modeMatchPercentage = state.modeMatchPercentage;
		stateData.lastAppliedMode = state.lastAppliedMode;
		stateData.lastAppliedAt = state.lastAppliedAt;
		stateData.totalLights = state.totalLights;
		stateData.lightsOn = state.lightsOn;
		stateData.averageBrightness = state.averageBrightness;

		// Map roles
		const rolesMap = new RolesStateMapDataModel();

		for (const [roleKey, roleState] of Object.entries(state.roles)) {
			const roleData = new RoleAggregatedStateDataModel();
			roleData.role = roleState.role;
			roleData.isOn = roleState.isOn;
			roleData.isOnMixed = roleState.isOnMixed;
			roleData.brightness = roleState.brightness;
			roleData.colorTemperature = roleState.colorTemperature;
			roleData.color = roleState.color;
			roleData.white = roleState.white;
			roleData.isBrightnessMixed = roleState.isBrightnessMixed;
			roleData.isColorTemperatureMixed = roleState.isColorTemperatureMixed;
			roleData.isColorMixed = roleState.isColorMixed;
			roleData.isWhiteMixed = roleState.isWhiteMixed;
			roleData.lastIntent = roleState.lastIntent;
			roleData.devicesCount = roleState.devicesCount;
			roleData.devicesOn = roleState.devicesOn;

			(rolesMap as Record<string, RoleAggregatedStateDataModel>)[roleKey] = roleData;
		}

		stateData.roles = rolesMap;

		// Map other lights
		const otherData = new OtherLightsStateDataModel();
		otherData.isOn = state.other.isOn;
		otherData.isOnMixed = state.other.isOnMixed;
		otherData.brightness = state.other.brightness;
		otherData.colorTemperature = state.other.colorTemperature;
		otherData.color = state.other.color;
		otherData.white = state.other.white;
		otherData.isBrightnessMixed = state.other.isBrightnessMixed;
		otherData.isColorTemperatureMixed = state.other.isColorTemperatureMixed;
		otherData.isColorMixed = state.other.isColorMixed;
		otherData.isWhiteMixed = state.other.isWhiteMixed;
		otherData.devicesCount = state.other.devicesCount;
		otherData.devicesOn = state.other.devicesOn;
		stateData.other = otherData;

		const response = new LightingStateResponseModel();
		response.data = stateData;

		return response;
	}

	@Get(':id/lighting/targets')
	@ApiOperation({
		operationId: 'get-spaces-module-space-lighting-targets',
		summary: 'List light targets in space',
		description:
			'Retrieves all controllable light targets (device/channel pairs) in a space ' +
			'along with their current role assignments and capabilities.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(LightTargetsResponseModel, 'Returns the list of light targets with role assignments')
	@ApiNotFoundResponse('Space not found')
	async getLightTargets(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<LightTargetsResponseModel> {
		this.logger.debug(`Fetching light targets for space with id=${id}`);

		const targets = await this.spaceLightingRoleService.getLightTargetsInSpace(id);

		const response = new LightTargetsResponseModel();
		response.data = targets.map((t) => {
			const model = new LightTargetDataModel();
			model.deviceId = t.deviceId;
			model.deviceName = t.deviceName;
			model.channelId = t.channelId;
			model.channelName = t.channelName;
			model.role = t.role;
			model.priority = t.priority;
			model.hasBrightness = t.hasBrightness;
			model.hasColorTemp = t.hasColorTemp;
			model.hasColor = t.hasColor;
			return model;
		});

		return response;
	}

	@Post(':id/lighting/roles')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space-lighting-role',
		summary: 'Set lighting role for a light target',
		description:
			'Sets or updates the lighting role for a specific device/channel in a space. ' + 'Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(LightingRoleResponseModel, 'Returns the created/updated lighting role assignment')
	@ApiNotFoundResponse('Space not found')
	@ApiBadRequestResponse('Invalid role data')
	@ApiUnprocessableEntityResponse('Role assignment validation failed')
	async setLightingRole(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqSetLightingRoleDto,
	): Promise<LightingRoleResponseModel> {
		this.logger.debug(`Setting lighting role for space with id=${id}`);

		const role = await this.spaceLightingRoleService.setRole(id, body.data);

		const response = new LightingRoleResponseModel();
		response.data = role;

		return response;
	}

	@Post(':id/lighting/roles/bulk')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space-lighting-roles-bulk',
		summary: 'Bulk set lighting roles for light targets',
		description:
			'Sets or updates lighting roles for multiple device/channels in a space in a single operation. ' +
			'Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(BulkLightingRolesResponseModel, 'Returns the bulk update result')
	@ApiNotFoundResponse('Space not found')
	@ApiBadRequestResponse('Invalid role data')
	@ApiUnprocessableEntityResponse('Role assignment validation failed')
	async bulkSetLightingRoles(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqBulkSetLightingRolesDto,
	): Promise<BulkLightingRolesResponseModel> {
		this.logger.debug(`Bulk setting lighting roles for space with id=${id}`);

		const result = await this.spaceLightingRoleService.bulkSetRoles(id, body.data.roles);

		const resultData = new BulkLightingRolesResultDataModel();
		resultData.success = result.success;
		resultData.totalCount = result.totalCount;
		resultData.successCount = result.successCount;
		resultData.failureCount = result.failureCount;
		resultData.results = result.results.map((item) => {
			const resultItem = new BulkLightingRoleResultItemModel();
			resultItem.deviceId = item.deviceId;
			resultItem.channelId = item.channelId;
			resultItem.success = item.success;
			resultItem.role = item.role;
			resultItem.error = item.error;
			return resultItem;
		});

		const response = new BulkLightingRolesResponseModel();
		response.data = resultData;

		return response;
	}

	@Post(':id/lighting/roles/defaults')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space-lighting-roles-defaults',
		summary: 'Apply default lighting roles',
		description:
			'Infers and applies default lighting roles for all lights in the space. ' +
			'First light becomes MAIN, remaining lights become AMBIENT. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(BulkLightingRolesResponseModel, 'Returns the bulk update result')
	@ApiNotFoundResponse('Space not found')
	async applyDefaultLightingRoles(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<BulkLightingRolesResponseModel> {
		this.logger.debug(`Applying default lighting roles for space with id=${id}`);

		const defaultRoles = await this.spaceLightingRoleService.inferDefaultLightingRoles(id);
		const result = await this.spaceLightingRoleService.bulkSetRoles(id, defaultRoles);

		const resultData = new BulkLightingRolesResultDataModel();
		resultData.success = result.success;
		resultData.totalCount = result.totalCount;
		resultData.successCount = result.successCount;
		resultData.failureCount = result.failureCount;
		resultData.results = result.results.map((item) => {
			const resultItem = new BulkLightingRoleResultItemModel();
			resultItem.deviceId = item.deviceId;
			resultItem.channelId = item.channelId;
			resultItem.success = item.success;
			resultItem.role = item.role;
			resultItem.error = item.error;
			return resultItem;
		});

		const response = new BulkLightingRolesResponseModel();
		response.data = resultData;

		return response;
	}

	@Delete(':id/lighting/roles/:deviceId/:channelId')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'delete-spaces-module-space-lighting-role',
		summary: 'Delete lighting role assignment',
		description:
			'Removes the lighting role assignment for a specific device/channel in a space. ' +
			'Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiNoContentResponse({ description: 'Lighting role deleted successfully' })
	@ApiNotFoundResponse('Space not found')
	@HttpCode(204)
	async deleteLightingRole(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
	): Promise<void> {
		this.logger.debug(`Deleting lighting role for space=${id} device=${deviceId} channel=${channelId}`);

		await this.spaceLightingRoleService.deleteRole(id, deviceId, channelId);

		this.logger.debug(`Successfully deleted lighting role for device=${deviceId} channel=${channelId}`);
	}

	// ================================
	// Climate Role Endpoints
	// ================================

	@Get(':id/climate/targets')
	@ApiOperation({
		operationId: 'get-spaces-module-space-climate-targets',
		summary: 'List climate targets in space',
		description:
			'Retrieves all controllable climate devices in a space ' +
			'along with their current role assignments and capabilities.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(ClimateTargetsResponseModel, 'Returns the list of climate devices with role assignments')
	@ApiNotFoundResponse('Space not found')
	async getClimateTargets(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<ClimateTargetsResponseModel> {
		this.logger.debug(`Fetching climate targets for space with id=${id}`);

		const targets = await this.spaceClimateRoleService.getClimateTargetsInSpace(id);

		const response = new ClimateTargetsResponseModel();
		response.data = targets.map((t) => {
			const model = new ClimateTargetDataModel();
			model.deviceId = t.deviceId;
			model.deviceName = t.deviceName;
			model.deviceCategory = t.deviceCategory;
			model.channelId = t.channelId;
			model.channelName = t.channelName;
			model.channelCategory = t.channelCategory;
			model.role = t.role;
			model.priority = t.priority;
			model.hasTemperature = t.hasTemperature;
			model.hasHumidity = t.hasHumidity;
			model.hasMode = t.hasMode;
			return model;
		});

		return response;
	}

	@Post(':id/climate/roles')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space-climate-role',
		summary: 'Set or remove climate role for a climate device',
		description:
			'Sets, updates, or removes the climate role for a specific device in a space. ' +
			'Omit the role field or set it to null to remove an existing role assignment. ' +
			'Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(
		ClimateRoleResponseModel,
		'Returns the created/updated climate role assignment, or null if removed',
	)
	@ApiNotFoundResponse('Space not found')
	@ApiBadRequestResponse('Invalid role data')
	@ApiUnprocessableEntityResponse('Role assignment validation failed')
	async setClimateRole(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqSetClimateRoleDto,
	): Promise<ClimateRoleResponseModel> {
		this.logger.debug(`Setting climate role for space with id=${id}`);

		const role = await this.spaceClimateRoleService.setRole(id, body.data);

		const response = new ClimateRoleResponseModel();
		response.data = role;

		return response;
	}

	@Post(':id/climate/roles/bulk')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space-climate-roles-bulk',
		summary: 'Bulk set climate roles for climate devices',
		description:
			'Sets or updates climate roles for multiple devices in a space in a single operation. ' +
			'Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(BulkClimateRolesResponseModel, 'Returns the bulk update result')
	@ApiNotFoundResponse('Space not found')
	@ApiBadRequestResponse('Invalid role data')
	@ApiUnprocessableEntityResponse('Role assignment validation failed')
	async bulkSetClimateRoles(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqBulkSetClimateRolesDto,
	): Promise<BulkClimateRolesResponseModel> {
		this.logger.debug(`Bulk setting climate roles for space with id=${id}`);

		const result = await this.spaceClimateRoleService.bulkSetRoles(id, body.data.roles);

		const resultData = new BulkClimateRolesResultDataModel();
		resultData.success = result.success;
		resultData.totalCount = result.totalCount;
		resultData.successCount = result.successCount;
		resultData.failureCount = result.failureCount;
		resultData.results = result.results.map((item) => {
			const resultItem = new BulkClimateRoleResultItemModel();
			resultItem.deviceId = item.deviceId;
			resultItem.channelId = item.channelId;
			resultItem.success = item.success;
			resultItem.role = item.role;
			resultItem.error = item.error;
			return resultItem;
		});

		const response = new BulkClimateRolesResponseModel();
		response.data = resultData;

		return response;
	}

	@Post(':id/climate/roles/defaults')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space-climate-roles-defaults',
		summary: 'Apply default climate roles',
		description:
			'Infers and applies default climate roles for all climate devices in the space. ' +
			'Thermostats become PRIMARY, heaters/AC become AUXILIARY, fans become VENTILATION, ' +
			'humidifiers/dehumidifiers become HUMIDITY. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(BulkClimateRolesResponseModel, 'Returns the bulk update result')
	@ApiNotFoundResponse('Space not found')
	async applyDefaultClimateRoles(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<BulkClimateRolesResponseModel> {
		this.logger.debug(`Applying default climate roles for space with id=${id}`);

		const defaultRoles = await this.spaceClimateRoleService.inferDefaultClimateRoles(id);
		const result = await this.spaceClimateRoleService.bulkSetRoles(id, defaultRoles);

		const resultData = new BulkClimateRolesResultDataModel();
		resultData.success = result.success;
		resultData.totalCount = result.totalCount;
		resultData.successCount = result.successCount;
		resultData.failureCount = result.failureCount;
		resultData.results = result.results.map((item) => {
			const resultItem = new BulkClimateRoleResultItemModel();
			resultItem.deviceId = item.deviceId;
			resultItem.channelId = item.channelId;
			resultItem.success = item.success;
			resultItem.role = item.role;
			resultItem.error = item.error;
			return resultItem;
		});

		const response = new BulkClimateRolesResponseModel();
		response.data = resultData;

		return response;
	}

	@Delete(':id/climate/roles/:deviceId')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'delete-spaces-module-space-climate-role',
		summary: 'Delete climate role assignment',
		description:
			'Removes the climate role assignment for a specific device in a space. ' +
			'For actuator roles (PRIMARY, AUXILIARY, etc.), only deviceId is needed. ' +
			'For sensor roles (TEMPERATURE_SENSOR, HUMIDITY_SENSOR), channelId query parameter must be provided. ' +
			'Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiQuery({
		name: 'channelId',
		type: 'string',
		format: 'uuid',
		required: false,
		description: 'Channel ID (required for sensor roles, omit for actuator roles)',
	})
	@ApiNoContentResponse({ description: 'Climate role deleted successfully' })
	@ApiNotFoundResponse('Space not found')
	@HttpCode(204)
	async deleteClimateRole(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Query('channelId', new ParseUUIDPipe({ version: '4', optional: true })) channelId?: string,
	): Promise<void> {
		this.logger.debug(`Deleting climate role for space=${id} device=${deviceId} channel=${channelId ?? 'null'}`);

		await this.spaceClimateRoleService.deleteRole(id, deviceId, channelId);

		this.logger.debug(`Successfully deleted climate role for device=${deviceId} channel=${channelId ?? 'null'}`);
	}

	// ================================
	// Suggestion Endpoints
	// ================================

	@Get(':id/suggestion')
	@ApiOperation({
		operationId: 'get-spaces-module-space-suggestion',
		summary: 'Get suggestion for space',
		description:
			'Retrieves a single, non-intrusive suggestion for the space based on current time and lighting state. ' +
			'Returns null if no suggestion is applicable or suggestions are disabled for this space. ' +
			'Suggestions have a cooldown period to avoid repetition.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(SuggestionResponseModel, 'Returns the suggestion or null')
	@ApiNotFoundResponse('Space not found')
	async getSuggestion(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<SuggestionResponseModel> {
		this.logger.debug(`Getting suggestion for space with id=${id}`);

		const suggestion = await this.spaceSuggestionService.getSuggestion(id);

		const response = new SuggestionResponseModel();

		if (suggestion) {
			const suggestionData = new SuggestionDataModel();
			suggestionData.type = suggestion.type;
			suggestionData.title = suggestion.title;
			suggestionData.reason = suggestion.reason;
			suggestionData.lightingMode = suggestion.lightingMode;
			response.data = suggestionData;
		} else {
			response.data = null;
		}

		return response;
	}

	@Post(':id/suggestion/feedback')
	@ApiOperation({
		operationId: 'create-spaces-module-space-suggestion-feedback',
		summary: 'Submit suggestion feedback',
		description:
			'Records user feedback for a suggestion (applied or dismissed). ' +
			'If applied, the corresponding lighting intent is executed. ' +
			'A cooldown is set to prevent the same suggestion from reappearing immediately.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(SuggestionFeedbackResponseModel, 'Returns the feedback result')
	@ApiNotFoundResponse('Space not found')
	@ApiBadRequestResponse('Invalid feedback data')
	async submitSuggestionFeedback(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqSuggestionFeedbackDto,
	): Promise<SuggestionFeedbackResponseModel> {
		this.logger.debug(`Submitting suggestion feedback for space with id=${id}`);

		const result = await this.spaceSuggestionService.recordFeedback(id, body.data.suggestionType, body.data.feedback);

		const resultData = new SuggestionFeedbackResultDataModel();
		resultData.success = result.success;
		resultData.intentExecuted = result.intentExecuted;

		const response = new SuggestionFeedbackResponseModel();
		response.data = resultData;

		return response;
	}

	// ================================
	// Context Snapshot Endpoints
	// ================================

	@Get(':id/context/snapshot')
	@ApiOperation({
		operationId: 'get-spaces-module-space-context-snapshot',
		summary: 'Capture context snapshot for space',
		description:
			'Captures a complete context snapshot of the current state of a space, including ' +
			'lighting state (on/off, brightness, color) for all lights and climate state ' +
			'(current temperature, setpoint). Useful for undo functionality, scene saving, ' +
			'and providing context for automation decisions.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(ContextSnapshotResponseModel, 'Returns the context snapshot')
	@ApiNotFoundResponse('Space not found')
	async captureContextSnapshot(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<ContextSnapshotResponseModel> {
		this.logger.debug(`Capturing context snapshot for space with id=${id}`);

		const snapshot = await this.spaceContextSnapshotService.captureSnapshot(id);

		if (!snapshot) {
			throw new SpacesNotFoundException('Space not found');
		}

		// Transform lighting snapshot to response model
		const lightingSummary = new LightingSummaryDataModel();
		lightingSummary.totalLights = snapshot.lighting.summary.totalLights;
		lightingSummary.lightsOn = snapshot.lighting.summary.lightsOn;
		lightingSummary.averageBrightness = snapshot.lighting.summary.averageBrightness;

		const lights = snapshot.lighting.lights.map((light) => {
			const lightData = new LightStateSnapshotDataModel();
			lightData.deviceId = light.deviceId;
			lightData.deviceName = light.deviceName;
			lightData.channelId = light.channelId;
			lightData.channelName = light.channelName;
			lightData.role = light.role;
			lightData.isOn = light.isOn;
			lightData.brightness = light.brightness;
			lightData.colorTemperature = light.colorTemperature;
			lightData.color = light.color;
			return lightData;
		});

		const lightingContext = new LightingContextDataModel();
		lightingContext.summary = lightingSummary;
		lightingContext.lights = lights;

		// Transform climate state to response model
		const climateState = new ClimateStateDataModel();
		climateState.hasClimate = snapshot.climate.hasClimate;
		climateState.mode = snapshot.climate.mode;
		climateState.currentTemperature = snapshot.climate.currentTemperature;
		climateState.currentHumidity = snapshot.climate.currentHumidity;
		climateState.targetTemperature = snapshot.climate.targetTemperature;
		climateState.heatingSetpoint = snapshot.climate.heatingSetpoint;
		climateState.coolingSetpoint = snapshot.climate.coolingSetpoint;
		climateState.minSetpoint = snapshot.climate.minSetpoint;
		climateState.maxSetpoint = snapshot.climate.maxSetpoint;
		climateState.canSetSetpoint = snapshot.climate.canSetSetpoint;
		climateState.supportsHeating = snapshot.climate.supportsHeating;
		climateState.supportsCooling = snapshot.climate.supportsCooling;
		climateState.isMixed = snapshot.climate.isMixed;
		climateState.devicesCount = snapshot.climate.devicesCount;

		const snapshotData = new ContextSnapshotDataModel();
		snapshotData.spaceId = snapshot.spaceId;
		snapshotData.spaceName = snapshot.spaceName;
		snapshotData.capturedAt = snapshot.capturedAt;
		snapshotData.lighting = lightingContext;
		snapshotData.climate = climateState;

		const response = new ContextSnapshotResponseModel();
		response.data = snapshotData;

		return response;
	}

	// ================================
	// Undo History Endpoints
	// ================================

	@Get(':id/undo')
	@ApiOperation({
		operationId: 'get-spaces-module-space-undo-state',
		summary: 'Get undo state for space',
		description:
			'Retrieves the current undo state for a space, indicating whether an undo action is available. ' +
			'The undo entry expires after 5 minutes and only the most recent intent can be undone.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(UndoStateResponseModel, 'Returns the undo state')
	@ApiNotFoundResponse('Space not found')
	async getUndoState(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<UndoStateResponseModel> {
		this.logger.debug(`Fetching undo state for space with id=${id}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(id);

		const undoEntry = this.spaceUndoHistoryService.peekUndoEntry(id);

		const stateData = new UndoStateDataModel();

		if (undoEntry) {
			// Calculate expiration time using the service's configured TTL
			const ttlMs = this.spaceUndoHistoryService.getEntryTtlMs();
			const expiresAt = new Date(undoEntry.capturedAt.getTime() + ttlMs);
			const expiresInMs = expiresAt.getTime() - Date.now();
			const expiresInSeconds = Math.max(0, Math.floor(expiresInMs / 1000));

			stateData.canUndo = true;
			stateData.actionDescription = undoEntry.actionDescription;
			stateData.intentCategory = undoEntry.intentCategory;
			stateData.capturedAt = undoEntry.capturedAt;
			stateData.expiresInSeconds = expiresInSeconds;
		} else {
			stateData.canUndo = false;
			stateData.actionDescription = null;
			stateData.intentCategory = null;
			stateData.capturedAt = null;
			stateData.expiresInSeconds = null;
		}

		const response = new UndoStateResponseModel();
		response.data = stateData;

		return response;
	}

	@Post(':id/intents/undo')
	@ApiOperation({
		operationId: 'create-spaces-module-space-undo',
		summary: 'Undo the last intent for space',
		description:
			'Reverts the most recent lighting or climate intent by restoring device states to their ' +
			'values before the intent was executed. Only the most recent intent can be undone, and ' +
			'the undo entry expires after 5 minutes.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(UndoResultResponseModel, 'Returns the undo result')
	@ApiNotFoundResponse('Space not found')
	async executeUndo(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<UndoResultResponseModel> {
		this.logger.debug(`Executing undo for space with id=${id}`);

		// Verify space exists
		await this.spacesService.getOneOrThrow(id);

		const result = await this.spaceUndoHistoryService.executeUndo(id);

		const resultData = new UndoResultDataModel();
		resultData.success = result.success;
		resultData.restoredDevices = result.restoredDevices;
		resultData.failedDevices = result.failedDevices;
		resultData.message = result.message;

		const response = new UndoResultResponseModel();
		response.data = resultData;

		return response;
	}
}
