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
import { ReqCoversIntentDto } from '../dto/covers-intent.dto';
import { ReqBulkSetCoversRolesDto, ReqSetCoversRoleDto } from '../dto/covers-role.dto';
import { ReqCreateSpaceDto } from '../dto/create-space.dto';
import { ReqLightingIntentDto } from '../dto/lighting-intent.dto';
import { ReqBulkSetLightingRolesDto, ReqSetLightingRoleDto } from '../dto/lighting-role.dto';
import { ReqMediaIntentDto } from '../dto/media-intent.dto';
import { ReqBulkSetMediaRolesDto, ReqSetMediaRoleDto } from '../dto/media-role.dto';
import { ReqBulkSetSensorRolesDto, ReqSetSensorRoleDto } from '../dto/sensor-role.dto';
import { ReqSuggestionFeedbackDto } from '../dto/suggestion.dto';
import { ReqUpdateSpaceDto } from '../dto/update-space.dto';
import {
	BulkAssignmentResponseModel,
	BulkAssignmentResultDataModel,
	BulkClimateRoleResultItemModel,
	BulkClimateRolesResponseModel,
	BulkClimateRolesResultDataModel,
	BulkCoversRoleResultItemModel,
	BulkCoversRolesResponseModel,
	BulkCoversRolesResultDataModel,
	BulkLightingRoleResultItemModel,
	BulkLightingRolesResponseModel,
	BulkLightingRolesResultDataModel,
	BulkMediaRoleResultItemModel,
	BulkMediaRolesResponseModel,
	BulkMediaRolesResultDataModel,
	BulkSensorRoleResultItemModel,
	BulkSensorRolesResponseModel,
	BulkSensorRolesResultDataModel,
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
	CoversIntentResponseModel,
	CoversIntentResultDataModel,
	CoversModeOrchestrationDataModel,
	CoversRolePositionRuleDataModel,
	CoversRoleResponseModel,
	CoversStateDataModel,
	CoversStateResponseModel,
	CoversTargetDataModel,
	CoversTargetsResponseModel,
	EnvironmentSummaryDataModel,
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
	LightingModeOrchestrationDataModel,
	LightingRoleBrightnessRuleDataModel,
	LightingRoleMetaDataModel,
	LightingRoleResponseModel,
	LightingStateDataModel,
	LightingStateResponseModel,
	LightingSummaryDataModel,
	MediaIntentResponseModel,
	MediaIntentResultDataModel,
	MediaRoleResponseModel,
	MediaRoleStateDataModel,
	MediaStateDataModel,
	MediaStateResponseModel,
	MediaTargetDataModel,
	MediaTargetsResponseModel,
	OtherLightsStateDataModel,
	OtherMediaStateDataModel,
	ProposedSpaceDataModel,
	ProposedSpacesResponseModel,
	QuickActionDataModel,
	RoleAggregatedStateDataModel,
	RoleLastIntentDataModel,
	RolesStateMapDataModel,
	SafetyAlertDataModel,
	SensorReadingDataModel,
	SensorRoleReadingsDataModel,
	SensorRoleResponseModel,
	SensorStateDataModel,
	SensorStateResponseModel,
	SensorTargetDataModel,
	SensorTargetsResponseModel,
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
import { SpaceCoversRoleService } from '../services/space-covers-role.service';
import { SpaceIntentService } from '../services/space-intent.service';
import { SpaceLightingRoleService } from '../services/space-lighting-role.service';
import { SpaceLightingStateService } from '../services/space-lighting-state.service';
import { SpaceMediaRoleService } from '../services/space-media-role.service';
import { SpaceMediaStateService } from '../services/space-media-state.service';
import { SpaceSensorRoleService } from '../services/space-sensor-role.service';
import { SpaceSensorStateService } from '../services/space-sensor-state.service';
import { SpaceSuggestionService } from '../services/space-suggestion.service';
import { SpaceUndoHistoryService } from '../services/space-undo-history.service';
import { SpacesService } from '../services/spaces.service';
import {
	CoversMode,
	IntentCategory,
	LightingMode,
	LightingRole,
	MediaRole,
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
	SensorStateResponseModel,
	SensorStateDataModel,
	SensorReadingDataModel,
	SensorRoleReadingsDataModel,
	EnvironmentSummaryDataModel,
	SafetyAlertDataModel,
	SensorTargetsResponseModel,
	SensorTargetDataModel,
	SensorRoleResponseModel,
	BulkSensorRolesResponseModel,
	BulkSensorRolesResultDataModel,
	BulkSensorRoleResultItemModel,
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
		private readonly spaceCoversRoleService: SpaceCoversRoleService,
		private readonly spaceMediaRoleService: SpaceMediaRoleService,
		private readonly spaceMediaStateService: SpaceMediaStateService,
		private readonly spaceSensorRoleService: SpaceSensorRoleService,
		private readonly spaceSensorStateService: SpaceSensorStateService,
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
		const lightingRolesFromSpec = this.intentSpecLoaderService
			.getIntentCatalog()
			.find((c) => c.category === 'lighting');
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

		// Get lighting mode orchestrations from YAML spec loader
		const lightingModesMap = this.intentSpecLoaderService.getAllLightingModeOrchestrations();
		const lightingModes: LightingModeOrchestrationDataModel[] = [];
		for (const [modeKey, modeConfig] of lightingModesMap) {
			const modeData = new LightingModeOrchestrationDataModel();
			modeData.mode = modeKey as LightingMode;
			modeData.label = modeConfig.label;
			modeData.description = modeConfig.description;
			modeData.icon = modeConfig.icon;
			modeData.mvpBrightness = modeConfig.mvpBrightness;
			modeData.fallbackRoles = modeConfig.fallbackRoles;
			modeData.fallbackBrightness = modeConfig.fallbackBrightness;

			// Transform role rules
			const roles: Record<string, LightingRoleBrightnessRuleDataModel> = {};
			for (const [roleKey, roleRule] of Object.entries(modeConfig.roles)) {
				const ruleData = new LightingRoleBrightnessRuleDataModel();
				ruleData.on = roleRule.on;
				ruleData.brightness = roleRule.brightness;
				roles[roleKey] = ruleData;
			}
			modeData.roles = roles;

			lightingModes.push(modeData);
		}

		// Get covers mode orchestrations from YAML spec loader
		const coversModesMap = this.intentSpecLoaderService.getAllCoversModeOrchestrations();
		const coversModes: CoversModeOrchestrationDataModel[] = [];
		for (const [modeKey, modeConfig] of coversModesMap) {
			const modeData = new CoversModeOrchestrationDataModel();
			modeData.mode = modeKey as CoversMode;
			modeData.label = modeConfig.label;
			modeData.description = modeConfig.description;
			modeData.icon = modeConfig.icon;
			modeData.mvpPosition = modeConfig.mvpPosition;

			// Transform role rules
			const roles: Record<string, CoversRolePositionRuleDataModel> = {};
			for (const [roleKey, roleRule] of Object.entries(modeConfig.roles)) {
				const ruleData = new CoversRolePositionRuleDataModel();
				ruleData.position = roleRule.position;
				ruleData.tilt = roleRule.tilt;
				roles[roleKey] = ruleData;
			}
			modeData.roles = roles;

			coversModes.push(modeData);
		}

		const catalogData = new IntentCatalogDataModel();
		catalogData.categories = categories;
		catalogData.quickActions = quickActions;
		catalogData.lightingRoles = lightingRoles;
		catalogData.lightingModes = lightingModes;
		catalogData.coversModes = coversModes;

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

		if (!result) {
			throw new SpacesNotFoundException('Space not found');
		}

		const resultData = new LightingIntentResultDataModel();
		resultData.success = result.success;
		resultData.affectedDevices = result.affectedDevices;
		resultData.failedDevices = result.failedDevices;
		resultData.skippedOfflineDevices = result.skippedOfflineDevices;
		resultData.offlineDeviceIds = result.offlineDeviceIds;
		resultData.failedTargets = result.failedTargets ?? null;

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

		if (!state) {
			throw new SpacesNotFoundException('Space not found');
		}

		const stateData = new ClimateStateDataModel();
		stateData.hasClimate = state.hasClimate;
		stateData.mode = state.mode;
		stateData.currentTemperature = state.currentTemperature;
		stateData.currentHumidity = state.currentHumidity;
		stateData.heatingSetpoint = state.heatingSetpoint;
		stateData.coolingSetpoint = state.coolingSetpoint;
		stateData.minSetpoint = state.minSetpoint;
		stateData.maxSetpoint = state.maxSetpoint;
		stateData.supportsHeating = state.supportsHeating;
		stateData.supportsCooling = state.supportsCooling;
		stateData.isHeating = state.isHeating;
		stateData.isCooling = state.isCooling;
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
		this.logger.debug(
			`Executing climate intent for space with id=${id}, ` +
				`type=${body.data.type}, mode=${body.data.mode}, ` +
				`heatingSetpoint=${body.data.heatingSetpoint}, coolingSetpoint=${body.data.coolingSetpoint}`,
		);

		const result = await this.spaceIntentService.executeClimateIntent(id, body.data);

		if (!result) {
			throw new SpacesNotFoundException('Space not found');
		}

		const resultData = new ClimateIntentResultDataModel();
		resultData.success = result.success;
		resultData.affectedDevices = result.affectedDevices;
		resultData.failedDevices = result.failedDevices;
		resultData.skippedOfflineDevices = result.skippedOfflineDevices;
		resultData.offlineDeviceIds = result.offlineDeviceIds;
		resultData.failedTargets = result.failedTargets ?? null;
		resultData.mode = result.mode;
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
		stateData.hasLights = state.hasLights;
		stateData.detectedMode = state.detectedMode;
		stateData.modeConfidence = state.modeConfidence;
		stateData.modeMatchPercentage = state.modeMatchPercentage;
		stateData.isModeFromIntent = state.isModeFromIntent;
		stateData.lastAppliedMode = state.lastAppliedMode;
		stateData.lastAppliedAt = state.lastAppliedAt;
		stateData.totalLights = state.totalLights;
		stateData.lightsOn = state.lightsOn;
		stateData.averageBrightness = state.averageBrightness;
		stateData.lightsByRole = state.lightsByRole;

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
			model.hasAirQuality = t.hasAirQuality;
			model.hasAirParticulate = t.hasAirParticulate;
			model.hasCarbonDioxide = t.hasCarbonDioxide;
			model.hasVolatileOrganicCompounds = t.hasVolatileOrganicCompounds;
			model.hasPressure = t.hasPressure;
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
	// Covers State & Intent Endpoints
	// ================================

	@Get(':id/covers')
	@ApiOperation({
		operationId: 'get-spaces-module-space-covers',
		summary: 'Get covers state for space',
		description:
			'Retrieves the current covers state for a space, including average position, ' +
			'open/closed status, and device counts by role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(CoversStateResponseModel, 'Returns the covers state')
	@ApiNotFoundResponse('Space not found')
	async getCoversState(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<CoversStateResponseModel> {
		this.logger.debug(`Fetching covers state for space with id=${id}`);

		const state = await this.spaceIntentService.getCoversState(id);

		if (!state) {
			throw new SpacesNotFoundException('Space not found');
		}

		const response = new CoversStateResponseModel();
		response.data = CoversStateDataModel.fromState(state);

		return response;
	}

	@Post(':id/intents/covers')
	@ApiOperation({
		operationId: 'create-spaces-module-space-covers-intent',
		summary: 'Execute covers intent for space',
		description:
			'Executes a covers intent command for all window coverings in the space. ' +
			'Supports open, close, set_position, position_delta, role_position, and set_mode operations. ' +
			'Commands are applied based on device capabilities and role assignments.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(CoversIntentResponseModel, 'Returns the intent execution result')
	@ApiNotFoundResponse('Space not found')
	@ApiUnprocessableEntityResponse('Invalid intent data')
	async executeCoversIntent(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqCoversIntentDto,
	): Promise<CoversIntentResponseModel> {
		this.logger.debug(`Executing covers intent for space with id=${id}`);

		const result = await this.spaceIntentService.executeCoversIntent(id, body.data);

		if (!result) {
			throw new SpacesNotFoundException('Space not found');
		}

		const resultData = new CoversIntentResultDataModel();
		resultData.success = result.success;
		resultData.affectedDevices = result.affectedDevices;
		resultData.failedDevices = result.failedDevices;
		resultData.skippedOfflineDevices = result.skippedOfflineDevices;
		resultData.offlineDeviceIds = result.offlineDeviceIds;
		resultData.failedTargets = result.failedTargets ?? null;
		resultData.newPosition = result.newPosition;

		const response = new CoversIntentResponseModel();
		response.data = resultData;

		return response;
	}

	// ================================
	// Covers Role Endpoints
	// ================================

	@Get(':id/covers/targets')
	@ApiOperation({
		operationId: 'get-spaces-module-space-covers-targets',
		summary: 'List covers targets in space',
		description:
			'Retrieves all controllable window covering targets (device/channel pairs) in a space ' +
			'along with their current role assignments and capabilities.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(CoversTargetsResponseModel, 'Returns the list of covers targets with role assignments')
	@ApiNotFoundResponse('Space not found')
	async getCoversTargets(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<CoversTargetsResponseModel> {
		this.logger.debug(`Fetching covers targets for space with id=${id}`);

		const targets = await this.spaceCoversRoleService.getCoversTargetsInSpace(id);

		const response = new CoversTargetsResponseModel();
		response.data = targets.map((t) => {
			const model = new CoversTargetDataModel();
			model.deviceId = t.deviceId;
			model.deviceName = t.deviceName;
			model.channelId = t.channelId;
			model.channelName = t.channelName;
			model.role = t.role;
			model.priority = t.priority;
			model.hasPosition = t.hasPosition;
			model.hasCommand = t.hasCommand;
			model.hasTilt = t.hasTilt;
			model.coverType = t.coverType;
			return model;
		});

		return response;
	}

	@Post(':id/covers/roles')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space-covers-role',
		summary: 'Set covers role for a covers target',
		description:
			'Sets or updates the covers role for a specific device/channel in a space. ' + 'Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(CoversRoleResponseModel, 'Returns the created/updated covers role assignment')
	@ApiNotFoundResponse('Space not found')
	@ApiBadRequestResponse('Invalid role data')
	@ApiUnprocessableEntityResponse('Role assignment validation failed')
	async setCoversRole(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqSetCoversRoleDto,
	): Promise<CoversRoleResponseModel> {
		this.logger.debug(`Setting covers role for space with id=${id}`);

		const role = await this.spaceCoversRoleService.setRole(id, body.data);

		const response = new CoversRoleResponseModel();
		response.data = role;

		return response;
	}

	@Post(':id/covers/roles/bulk')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space-covers-roles-bulk',
		summary: 'Bulk set covers roles for covers targets',
		description:
			'Sets or updates covers roles for multiple device/channels in a space in a single operation. ' +
			'Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(BulkCoversRolesResponseModel, 'Returns the bulk update result')
	@ApiNotFoundResponse('Space not found')
	@ApiBadRequestResponse('Invalid role data')
	@ApiUnprocessableEntityResponse('Role assignment validation failed')
	async bulkSetCoversRoles(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqBulkSetCoversRolesDto,
	): Promise<BulkCoversRolesResponseModel> {
		this.logger.debug(`Bulk setting covers roles for space with id=${id}`);

		const result = await this.spaceCoversRoleService.bulkSetRoles(id, body.data.roles);

		const resultData = new BulkCoversRolesResultDataModel();
		resultData.success = result.success;
		resultData.totalCount = result.totalCount;
		resultData.successCount = result.successCount;
		resultData.failureCount = result.failureCount;
		resultData.results = result.results.map((item) => {
			const resultItem = new BulkCoversRoleResultItemModel();
			resultItem.deviceId = item.deviceId;
			resultItem.channelId = item.channelId;
			resultItem.success = item.success;
			resultItem.role = item.role;
			resultItem.error = item.error;
			return resultItem;
		});

		const response = new BulkCoversRolesResponseModel();
		response.data = resultData;

		return response;
	}

	@Post(':id/covers/roles/defaults')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space-covers-roles-defaults',
		summary: 'Apply default covers roles',
		description:
			'Infers and applies default covers roles for all window coverings in the space. ' +
			'First cover becomes PRIMARY, remaining covers are assigned based on type. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(BulkCoversRolesResponseModel, 'Returns the bulk update result')
	@ApiNotFoundResponse('Space not found')
	async applyDefaultCoversRoles(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<BulkCoversRolesResponseModel> {
		this.logger.debug(`Applying default covers roles for space with id=${id}`);

		const defaultRoles = await this.spaceCoversRoleService.inferDefaultCoversRoles(id);
		const result = await this.spaceCoversRoleService.bulkSetRoles(id, defaultRoles);

		const resultData = new BulkCoversRolesResultDataModel();
		resultData.success = result.success;
		resultData.totalCount = result.totalCount;
		resultData.successCount = result.successCount;
		resultData.failureCount = result.failureCount;
		resultData.results = result.results.map((item) => {
			const resultItem = new BulkCoversRoleResultItemModel();
			resultItem.deviceId = item.deviceId;
			resultItem.channelId = item.channelId;
			resultItem.success = item.success;
			resultItem.role = item.role;
			resultItem.error = item.error;
			return resultItem;
		});

		const response = new BulkCoversRolesResponseModel();
		response.data = resultData;

		return response;
	}

	@Delete(':id/covers/roles/:deviceId/:channelId')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'delete-spaces-module-space-covers-role',
		summary: 'Delete covers role assignment',
		description:
			'Removes the covers role assignment for a specific device/channel in a space. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiNoContentResponse({ description: 'Covers role deleted successfully' })
	@ApiNotFoundResponse('Space not found')
	@HttpCode(204)
	async deleteCoversRole(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
	): Promise<void> {
		this.logger.debug(`Deleting covers role for space=${id} device=${deviceId} channel=${channelId}`);

		await this.spaceCoversRoleService.deleteRole(id, deviceId, channelId);

		this.logger.debug(`Successfully deleted covers role for device=${deviceId} channel=${channelId}`);
	}

	// ================================
	// Sensor State & Role Endpoints
	// ================================

	@Get(':id/sensors')
	@ApiOperation({
		operationId: 'get-spaces-module-space-sensors',
		summary: 'Get sensor state for space',
		description:
			'Retrieves the current sensor state for a space, including aggregated readings, ' +
			'environment summary, safety alerts, motion/occupancy status, and readings grouped by role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(SensorStateResponseModel, 'Returns the sensor state')
	@ApiNotFoundResponse('Space not found')
	async getSensorState(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<SensorStateResponseModel> {
		this.logger.debug(`Fetching sensor state for space with id=${id}`);

		const state = await this.spaceSensorStateService.getSensorState(id);

		if (!state) {
			throw new SpacesNotFoundException('Space not found');
		}

		const stateData = new SensorStateDataModel();
		stateData.hasSensors = state.hasSensors;
		stateData.totalSensors = state.totalSensors;
		stateData.sensorsByRole = state.sensorsByRole;

		if (state.environment) {
			const envData = new EnvironmentSummaryDataModel();
			envData.averageTemperature = state.environment.averageTemperature;
			envData.averageHumidity = state.environment.averageHumidity;
			envData.averagePressure = state.environment.averagePressure;
			envData.averageIlluminance = state.environment.averageIlluminance;
			stateData.environment = envData;
		} else {
			stateData.environment = null;
		}

		stateData.safetyAlerts = state.safetyAlerts.map((alert) => {
			const alertData = new SafetyAlertDataModel();
			alertData.channelCategory = alert.channelCategory;
			alertData.deviceId = alert.deviceId;
			alertData.deviceName = alert.deviceName;
			alertData.channelId = alert.channelId;
			alertData.triggered = alert.triggered;
			return alertData;
		});
		stateData.hasSafetyAlert = state.hasSafetyAlert;
		stateData.motionDetected = state.motionDetected;
		stateData.occupancyDetected = state.occupancyDetected;

		stateData.readings = state.readings.map((roleReadings) => {
			const roleData = new SensorRoleReadingsDataModel();
			roleData.role = roleReadings.role;
			roleData.sensorsCount = roleReadings.sensorsCount;
			roleData.readings = roleReadings.readings.map((reading) => {
				const readingData = new SensorReadingDataModel();
				readingData.deviceId = reading.deviceId;
				readingData.deviceName = reading.deviceName;
				readingData.channelId = reading.channelId;
				readingData.channelName = reading.channelName;
				readingData.channelCategory = reading.channelCategory;
				readingData.value = reading.value;
				readingData.unit = reading.unit;
				readingData.role = reading.role;
				return readingData;
			});
			return roleData;
		});

		const response = new SensorStateResponseModel();
		response.data = stateData;

		return response;
	}

	@Get(':id/sensors/targets')
	@ApiOperation({
		operationId: 'get-spaces-module-space-sensor-targets',
		summary: 'Get sensor targets in space',
		description:
			'Retrieves all sensor channels in a space that can be assigned roles, ' +
			'including their current role assignments.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(SensorTargetsResponseModel, 'Returns the list of sensor targets')
	@ApiNotFoundResponse('Space not found')
	async getSensorTargets(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<SensorTargetsResponseModel> {
		this.logger.debug(`Fetching sensor targets for space with id=${id}`);

		const targets = await this.spaceSensorRoleService.getSensorTargetsInSpace(id);

		const response = new SensorTargetsResponseModel();
		response.data = targets.map((t) => {
			const model = new SensorTargetDataModel();
			model.deviceId = t.deviceId;
			model.deviceName = t.deviceName;
			model.deviceCategory = t.deviceCategory;
			model.channelId = t.channelId;
			model.channelName = t.channelName;
			model.channelCategory = t.channelCategory;
			model.role = t.role;
			model.priority = t.priority;
			return model;
		});

		return response;
	}

	@Post(':id/sensors/roles')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space-sensor-role',
		summary: 'Set sensor role for a sensor target',
		description:
			'Sets or updates the sensor role for a specific device/channel in a space. ' + 'Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(SensorRoleResponseModel, 'Returns the created/updated sensor role assignment')
	@ApiNotFoundResponse('Space not found')
	@ApiBadRequestResponse('Invalid role data')
	@ApiUnprocessableEntityResponse('Role assignment validation failed')
	async setSensorRole(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqSetSensorRoleDto,
	): Promise<SensorRoleResponseModel> {
		this.logger.debug(`Setting sensor role for space with id=${id}`);

		const role = await this.spaceSensorRoleService.setRole(id, body.data);

		const response = new SensorRoleResponseModel();
		response.data = role;

		return response;
	}

	@Post(':id/sensors/roles/bulk')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space-sensor-roles-bulk',
		summary: 'Bulk set sensor roles for sensor targets',
		description:
			'Sets or updates sensor roles for multiple device/channels in a space in a single operation. ' +
			'Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(BulkSensorRolesResponseModel, 'Returns the bulk update result')
	@ApiNotFoundResponse('Space not found')
	@ApiBadRequestResponse('Invalid role data')
	@ApiUnprocessableEntityResponse('Role assignment validation failed')
	async bulkSetSensorRoles(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqBulkSetSensorRolesDto,
	): Promise<BulkSensorRolesResponseModel> {
		this.logger.debug(`Bulk setting sensor roles for space with id=${id}`);

		const result = await this.spaceSensorRoleService.bulkSetRoles(id, body.data.roles);

		const resultData = new BulkSensorRolesResultDataModel();
		resultData.success = result.success;
		resultData.totalCount = result.totalCount;
		resultData.successCount = result.successCount;
		resultData.failureCount = result.failureCount;
		resultData.results = result.results.map((item) => {
			const resultItem = new BulkSensorRoleResultItemModel();
			resultItem.deviceId = item.deviceId;
			resultItem.channelId = item.channelId;
			resultItem.success = item.success;
			resultItem.role = item.role;
			resultItem.error = item.error;
			return resultItem;
		});

		const response = new BulkSensorRolesResponseModel();
		response.data = resultData;

		return response;
	}

	@Post(':id/sensors/roles/defaults')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space-sensor-roles-defaults',
		summary: 'Apply default sensor roles',
		description:
			'Infers and applies default sensor roles for all sensor channels in the space ' +
			'based on channel category (environment, safety, security, air quality, energy). ' +
			'Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(BulkSensorRolesResponseModel, 'Returns the bulk update result')
	@ApiNotFoundResponse('Space not found')
	async applyDefaultSensorRoles(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<BulkSensorRolesResponseModel> {
		this.logger.debug(`Applying default sensor roles for space with id=${id}`);

		const defaultRoles = await this.spaceSensorRoleService.inferDefaultSensorRoles(id);
		const result = await this.spaceSensorRoleService.bulkSetRoles(id, defaultRoles);

		const resultData = new BulkSensorRolesResultDataModel();
		resultData.success = result.success;
		resultData.totalCount = result.totalCount;
		resultData.successCount = result.successCount;
		resultData.failureCount = result.failureCount;
		resultData.results = result.results.map((item) => {
			const resultItem = new BulkSensorRoleResultItemModel();
			resultItem.deviceId = item.deviceId;
			resultItem.channelId = item.channelId;
			resultItem.success = item.success;
			resultItem.role = item.role;
			resultItem.error = item.error;
			return resultItem;
		});

		const response = new BulkSensorRolesResponseModel();
		response.data = resultData;

		return response;
	}

	@Delete(':id/sensors/roles/:deviceId/:channelId')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'delete-spaces-module-space-sensor-role',
		summary: 'Delete sensor role assignment',
		description:
			'Removes the sensor role assignment for a specific device/channel in a space. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiNoContentResponse({ description: 'Sensor role deleted successfully' })
	@ApiNotFoundResponse('Space not found')
	@HttpCode(204)
	async deleteSensorRole(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
	): Promise<void> {
		this.logger.debug(`Deleting sensor role for space=${id} device=${deviceId} channel=${channelId}`);

		await this.spaceSensorRoleService.deleteRole(id, deviceId, channelId);

		this.logger.debug(`Successfully deleted sensor role for device=${deviceId} channel=${channelId}`);
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
		climateState.heatingSetpoint = snapshot.climate.heatingSetpoint;
		climateState.coolingSetpoint = snapshot.climate.coolingSetpoint;
		climateState.minSetpoint = snapshot.climate.minSetpoint;
		climateState.maxSetpoint = snapshot.climate.maxSetpoint;
		climateState.supportsHeating = snapshot.climate.supportsHeating;
		climateState.supportsCooling = snapshot.climate.supportsCooling;
		climateState.isHeating = snapshot.climate.isHeating;
		climateState.isCooling = snapshot.climate.isCooling;
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

	// ================================
	// Media State & Intent Endpoints
	// ================================

	@Get(':id/media')
	@ApiOperation({
		operationId: 'get-spaces-module-space-media',
		summary: 'Get media state for space',
		description:
			'Retrieves the current media state for a space, including volume levels, ' +
			'power status, mute status, and device counts by role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(MediaStateResponseModel, 'Returns the media state')
	@ApiNotFoundResponse('Space not found')
	async getMediaState(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<MediaStateResponseModel> {
		this.logger.debug(`Fetching media state for space with id=${id}`);

		const state = await this.spaceIntentService.getMediaState(id);

		if (!state) {
			throw new SpacesNotFoundException('Space not found');
		}

		const stateData = new MediaStateDataModel();
		const rolesMap: Record<string, MediaRoleStateDataModel> = {};
		const devicesByRole: Record<string, number> = {};

		for (const [role, roleState] of Object.entries(state.roles ?? {})) {
			if (!roleState) continue;

			const roleModel = new MediaRoleStateDataModel();
			roleModel.role = role as MediaRole;
			roleModel.isOn = roleState.isOn;
			roleModel.isOnMixed = roleState.isOnMixed;
			roleModel.volume = roleState.volume;
			roleModel.isVolumeMixed = roleState.isVolumeMixed;
			roleModel.isMuted = roleState.isMuted;
			roleModel.isMutedMixed = roleState.isMutedMixed;
			roleModel.devicesCount = roleState.devicesCount;
			roleModel.devicesOn = roleState.devicesOn;

			rolesMap[role] = roleModel;
			devicesByRole[role] = roleState.devicesCount;
		}

		const otherModel = new OtherMediaStateDataModel();
		otherModel.isOn = state.other?.isOn ?? false;
		otherModel.isOnMixed = state.other?.isOnMixed ?? false;
		otherModel.volume = state.other?.volume ?? null;
		otherModel.isVolumeMixed = state.other?.isVolumeMixed ?? false;
		otherModel.isMuted = state.other?.isMuted ?? false;
		otherModel.isMutedMixed = state.other?.isMutedMixed ?? false;
		otherModel.devicesCount = state.other?.devicesCount ?? 0;
		otherModel.devicesOn = state.other?.devicesOn ?? 0;

		if (otherModel.devicesCount > 0) {
			devicesByRole.other = otherModel.devicesCount;
		}

		stateData.hasMedia = state.totalDevices > 0;
		stateData.anyOn = state.devicesOn > 0;
		stateData.allOff = state.devicesOn === 0;
		stateData.averageVolume = state.averageVolume;
		stateData.anyMuted = state.anyMuted;
		stateData.devicesCount = state.totalDevices;
		stateData.devicesByRole = devicesByRole;
		stateData.lastAppliedMode = state.lastAppliedMode ?? null;
		stateData.lastAppliedAt = state.lastAppliedAt ?? null;
		stateData.lastAppliedVolume = state.lastAppliedVolume ?? null;
		stateData.lastAppliedMuted = state.lastAppliedMuted ?? null;
		stateData.detectedMode = state.detectedMode ?? null;
		stateData.modeConfidence = state.modeConfidence ?? 'none';
		stateData.modeMatchPercentage = state.modeMatchPercentage ?? null;
		stateData.roles = rolesMap;
		stateData.other = otherModel;

		const response = new MediaStateResponseModel();
		response.data = stateData;

		return response;
	}

	@Post(':id/intents/media')
	@ApiOperation({
		operationId: 'create-spaces-module-space-media-intent',
		summary: 'Execute media intent for space',
		description:
			'Executes a media intent command for all media devices in the space. ' +
			'Supports power_on, power_off, volume_set, volume_delta, mute, unmute, and set_mode operations. ' +
			'Commands are applied based on device capabilities and role assignments.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(MediaIntentResponseModel, 'Returns the intent execution result')
	@ApiNotFoundResponse('Space not found')
	@ApiUnprocessableEntityResponse('Invalid intent data')
	async executeMediaIntent(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqMediaIntentDto,
	): Promise<MediaIntentResponseModel> {
		this.logger.debug(`Executing media intent for space with id=${id}`);

		const result = await this.spaceIntentService.executeMediaIntent(id, body.data);

		if (!result) {
			throw new SpacesNotFoundException('Space not found');
		}

		const resultData = new MediaIntentResultDataModel();
		resultData.success = result.success;
		resultData.affectedDevices = result.affectedDevices;
		resultData.failedDevices = result.failedDevices;
		resultData.skippedOfflineDevices = result.skippedOfflineDevices;
		resultData.offlineDeviceIds = result.offlineDeviceIds;
		resultData.newVolume = result.newVolume ?? null;
		resultData.isMuted = result.isMuted ?? null;
		resultData.failedTargets = result.failedTargets ?? null;

		const response = new MediaIntentResponseModel();
		response.data = resultData;

		return response;
	}

	// ================================
	// Media Role Endpoints
	// ================================

	@Get(':id/media/targets')
	@ApiOperation({
		operationId: 'get-spaces-module-space-media-targets',
		summary: 'List media targets in space',
		description:
			'Retrieves all controllable media targets (device/channel pairs) in a space ' +
			'along with their current role assignments and capabilities.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(MediaTargetsResponseModel, 'Returns the list of media targets with role assignments')
	@ApiNotFoundResponse('Space not found')
	async getMediaTargets(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<MediaTargetsResponseModel> {
		this.logger.debug(`Fetching media targets for space with id=${id}`);

		const targets = await this.spaceMediaRoleService.getMediaTargetsInSpace(id);

		const response = new MediaTargetsResponseModel();
		response.data = targets.map((t) => {
			const model = new MediaTargetDataModel();
			model.deviceId = t.deviceId;
			model.deviceName = t.deviceName;
			model.deviceCategory = t.deviceCategory;
			model.role = t.role;
			model.priority = t.priority;
			model.hasOn = t.hasOn;
			model.hasVolume = t.hasVolume;
			model.hasMute = t.hasMute;
			return model;
		});

		return response;
	}

	@Post(':id/media/roles')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space-media-role',
		summary: 'Set media role for a media target',
		description:
			'Sets or updates the media role for a specific device/channel in a space. ' + 'Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(MediaRoleResponseModel, 'Returns the created/updated media role assignment')
	@ApiNotFoundResponse('Space not found')
	@ApiBadRequestResponse('Invalid role data')
	@ApiUnprocessableEntityResponse('Role assignment validation failed')
	async setMediaRole(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqSetMediaRoleDto,
	): Promise<MediaRoleResponseModel> {
		this.logger.debug(`Setting media role for space with id=${id}`);

		const role = await this.spaceMediaRoleService.setRole(id, body.data);

		const response = new MediaRoleResponseModel();
		response.data = role;

		return response;
	}

	@Post(':id/media/roles/bulk')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space-media-roles-bulk',
		summary: 'Bulk set media roles for media targets',
		description:
			'Sets or updates media roles for multiple device/channels in a space in a single operation. ' +
			'Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(BulkMediaRolesResponseModel, 'Returns the bulk update result')
	@ApiNotFoundResponse('Space not found')
	@ApiBadRequestResponse('Invalid role data')
	@ApiUnprocessableEntityResponse('Role assignment validation failed')
	async bulkSetMediaRoles(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqBulkSetMediaRolesDto,
	): Promise<BulkMediaRolesResponseModel> {
		this.logger.debug(`Bulk setting media roles for space with id=${id}`);

		const result = await this.spaceMediaRoleService.bulkSetRoles(id, body.data.roles);

		const resultData = new BulkMediaRolesResultDataModel();
		resultData.success = result.success;
		resultData.totalCount = result.totalCount;
		resultData.successCount = result.successCount;
		resultData.failureCount = result.failureCount;
		resultData.results = result.results.map((item) => {
			const resultItem = new BulkMediaRoleResultItemModel();
			resultItem.deviceId = item.deviceId;
			resultItem.success = item.success;
			resultItem.role = item.role;
			resultItem.error = item.error;
			return resultItem;
		});

		const response = new BulkMediaRolesResponseModel();
		response.data = resultData;

		return response;
	}

	@Post(':id/media/roles/defaults')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'create-spaces-module-space-media-roles-defaults',
		summary: 'Apply default media roles',
		description:
			'Infers and applies default media roles for all media devices in the space. ' +
			'Roles are assigned based on device category: TV/Projector=PRIMARY, AV/STB=SECONDARY, Speaker=BACKGROUND, GameConsole=GAMING. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiSuccessResponse(BulkMediaRolesResponseModel, 'Returns the bulk update result')
	@ApiNotFoundResponse('Space not found')
	async applyDefaultMediaRoles(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<BulkMediaRolesResponseModel> {
		this.logger.debug(`Applying default media roles for space with id=${id}`);

		const defaultRoles = await this.spaceMediaRoleService.inferDefaultMediaRoles(id);
		const result = await this.spaceMediaRoleService.bulkSetRoles(id, defaultRoles);

		const resultData = new BulkMediaRolesResultDataModel();
		resultData.success = result.success;
		resultData.totalCount = result.totalCount;
		resultData.successCount = result.successCount;
		resultData.failureCount = result.failureCount;
		resultData.results = result.results.map((item) => {
			const resultItem = new BulkMediaRoleResultItemModel();
			resultItem.deviceId = item.deviceId;
			resultItem.success = item.success;
			resultItem.role = item.role;
			resultItem.error = item.error;
			return resultItem;
		});

		const response = new BulkMediaRolesResponseModel();
		response.data = resultData;

		return response;
	}

	@Delete(':id/media/roles/:deviceId')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'delete-spaces-module-space-media-role',
		summary: 'Delete media role assignment',
		description: 'Removes the media role assignment for a specific device in a space. Requires owner or admin role.',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Space ID' })
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiNoContentResponse({ description: 'Media role deleted successfully' })
	@ApiNotFoundResponse('Space not found')
	@HttpCode(204)
	async deleteMediaRole(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
	): Promise<void> {
		this.logger.debug(`Deleting media role for space=${id} device=${deviceId}`);

		await this.spaceMediaRoleService.deleteRole(id, deviceId);

		this.logger.debug(`Successfully deleted media role for device=${deviceId}`);
	}
}
