import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { SpaceLightingRoleEntity } from '../entities/space-lighting-role.entity';
import { SpaceEntity } from '../entities/space.entity';
import {
	IntentCategory,
	LightingMode,
	LightingRole,
	QuickActionType,
	SpaceCategory,
	SuggestionType,
} from '../spaces.constants';

/**
 * Response wrapper for SpaceEntity
 */
@ApiSchema({ name: 'SpacesModuleResSpace' })
export class SpaceResponseModel extends BaseSuccessResponseModel<SpaceEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => SpaceEntity,
	})
	@Expose()
	declare data: SpaceEntity;
}

/**
 * Response wrapper for array of SpaceEntity
 */
@ApiSchema({ name: 'SpacesModuleResSpaces' })
export class SpacesResponseModel extends BaseSuccessResponseModel<SpaceEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(SpaceEntity) },
	})
	@Expose()
	declare data: SpaceEntity[];
}

/**
 * Bulk assignment request data
 */
@ApiSchema({ name: 'SpacesModuleDataBulkAssignment' })
export class BulkAssignmentDataModel {
	@ApiProperty({
		name: 'device_ids',
		description: 'Array of device IDs to assign to the space',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'],
	})
	@Expose({ name: 'device_ids' })
	deviceIds: string[];

	@ApiProperty({
		name: 'display_ids',
		description: 'Array of display IDs to assign to the space',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'],
	})
	@Expose({ name: 'display_ids' })
	displayIds: string[];
}

/**
 * Bulk assignment result data
 */
@ApiSchema({ name: 'SpacesModuleDataBulkAssignmentResult' })
export class BulkAssignmentResultDataModel {
	@ApiProperty({
		description: 'Whether the bulk assignment was successful',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiProperty({
		name: 'devices_assigned',
		description: 'Number of devices assigned',
		type: 'integer',
		example: 5,
	})
	@Expose({ name: 'devices_assigned' })
	devicesAssigned: number;

	@ApiProperty({
		name: 'displays_assigned',
		description: 'Number of displays assigned',
		type: 'integer',
		example: 1,
	})
	@Expose({ name: 'displays_assigned' })
	displaysAssigned: number;
}

/**
 * Response wrapper for bulk assignment result
 */
@ApiSchema({ name: 'SpacesModuleResBulkAssignment' })
export class BulkAssignmentResponseModel extends BaseSuccessResponseModel<BulkAssignmentResultDataModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => BulkAssignmentResultDataModel,
	})
	@Expose()
	@Type(() => BulkAssignmentResultDataModel)
	declare data: BulkAssignmentResultDataModel;
}

/**
 * Proposed space data model
 */
@ApiSchema({ name: 'SpacesModuleDataProposedSpace' })
export class ProposedSpaceDataModel {
	@ApiProperty({
		description: 'Proposed space name',
		type: 'string',
		example: 'Living Room',
	})
	@Expose()
	name: string;

	@ApiProperty({
		name: 'device_ids',
		description: 'Array of device IDs that match this space',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'],
	})
	@Expose({ name: 'device_ids' })
	deviceIds: string[];

	@ApiProperty({
		name: 'device_count',
		description: 'Number of devices matching this space',
		type: 'integer',
		example: 3,
	})
	@Expose({ name: 'device_count' })
	deviceCount: number;
}

/**
 * Response wrapper for proposed spaces
 */
@ApiSchema({ name: 'SpacesModuleResProposedSpaces' })
export class ProposedSpacesResponseModel extends BaseSuccessResponseModel<ProposedSpaceDataModel[]> {
	@ApiProperty({
		description: 'Array of proposed spaces based on device names',
		type: () => [ProposedSpaceDataModel],
	})
	@Expose()
	@Type(() => ProposedSpaceDataModel)
	declare data: ProposedSpaceDataModel[];
}

/**
 * Lighting intent result data model
 */
@ApiSchema({ name: 'SpacesModuleDataLightingIntentResult' })
export class LightingIntentResultDataModel {
	@ApiProperty({
		description: 'Whether the intent was successfully executed',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiProperty({
		name: 'affected_devices',
		description: 'Number of devices affected by the intent',
		type: 'integer',
		example: 3,
	})
	@Expose({ name: 'affected_devices' })
	affectedDevices: number;

	@ApiProperty({
		name: 'failed_devices',
		description: 'Number of devices that failed to respond',
		type: 'integer',
		example: 0,
	})
	@Expose({ name: 'failed_devices' })
	failedDevices: number;
}

/**
 * Response wrapper for lighting intent result
 */
@ApiSchema({ name: 'SpacesModuleResLightingIntent' })
export class LightingIntentResponseModel extends BaseSuccessResponseModel<LightingIntentResultDataModel> {
	@ApiProperty({
		description: 'The result of the lighting intent execution',
		type: () => LightingIntentResultDataModel,
	})
	@Expose()
	@Type(() => LightingIntentResultDataModel)
	declare data: LightingIntentResultDataModel;
}

/**
 * Climate state data model
 */
@ApiSchema({ name: 'SpacesModuleDataClimateState' })
export class ClimateStateDataModel {
	@ApiProperty({
		name: 'has_climate',
		description: 'Whether the space has climate-capable devices',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'has_climate' })
	hasClimate: boolean;

	@ApiProperty({
		name: 'current_temperature',
		description: 'Current temperature reading in degrees Celsius',
		type: 'number',
		nullable: true,
		example: 22.5,
	})
	@Expose({ name: 'current_temperature' })
	currentTemperature: number | null;

	@ApiProperty({
		name: 'target_temperature',
		description: 'Current target/setpoint temperature in degrees Celsius',
		type: 'number',
		nullable: true,
		example: 21.0,
	})
	@Expose({ name: 'target_temperature' })
	targetTemperature: number | null;

	@ApiProperty({
		name: 'min_setpoint',
		description: 'Minimum allowed setpoint temperature',
		type: 'number',
		example: 5,
	})
	@Expose({ name: 'min_setpoint' })
	minSetpoint: number;

	@ApiProperty({
		name: 'max_setpoint',
		description: 'Maximum allowed setpoint temperature',
		type: 'number',
		example: 35,
	})
	@Expose({ name: 'max_setpoint' })
	maxSetpoint: number;

	@ApiProperty({
		name: 'can_set_setpoint',
		description: 'Whether the space has a thermostat that can adjust setpoint',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'can_set_setpoint' })
	canSetSetpoint: boolean;

	@ApiProperty({
		name: 'primary_thermostat_id',
		description: 'ID of the primary thermostat device',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'primary_thermostat_id' })
	primaryThermostatId: string | null;

	@ApiProperty({
		name: 'primary_sensor_id',
		description: 'ID of the primary temperature sensor device',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'a2b19ca3-521e-4d7b-b3fe-bcb7a8d5b9e7',
	})
	@Expose({ name: 'primary_sensor_id' })
	primarySensorId: string | null;
}

/**
 * Response wrapper for climate state
 */
@ApiSchema({ name: 'SpacesModuleResClimateState' })
export class ClimateStateResponseModel extends BaseSuccessResponseModel<ClimateStateDataModel> {
	@ApiProperty({
		description: 'The climate state data for the space',
		type: () => ClimateStateDataModel,
	})
	@Expose()
	@Type(() => ClimateStateDataModel)
	declare data: ClimateStateDataModel;
}

/**
 * Climate intent result data model
 */
@ApiSchema({ name: 'SpacesModuleDataClimateIntentResult' })
export class ClimateIntentResultDataModel {
	@ApiProperty({
		description: 'Whether the intent was successfully executed',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiProperty({
		name: 'affected_devices',
		description: 'Number of devices affected by the intent',
		type: 'integer',
		example: 1,
	})
	@Expose({ name: 'affected_devices' })
	affectedDevices: number;

	@ApiProperty({
		name: 'failed_devices',
		description: 'Number of devices that failed to respond',
		type: 'integer',
		example: 0,
	})
	@Expose({ name: 'failed_devices' })
	failedDevices: number;

	@ApiProperty({
		name: 'new_setpoint',
		description: 'The new setpoint value after the intent was executed',
		type: 'number',
		nullable: true,
		example: 21.5,
	})
	@Expose({ name: 'new_setpoint' })
	newSetpoint: number | null;
}

/**
 * Response wrapper for climate intent result
 */
@ApiSchema({ name: 'SpacesModuleResClimateIntent' })
export class ClimateIntentResponseModel extends BaseSuccessResponseModel<ClimateIntentResultDataModel> {
	@ApiProperty({
		description: 'The result of the climate intent execution',
		type: () => ClimateIntentResultDataModel,
	})
	@Expose()
	@Type(() => ClimateIntentResultDataModel)
	declare data: ClimateIntentResultDataModel;
}

// ================================
// Lighting Role Response Models
// ================================

/**
 * Light target data model (a light device/channel in a space)
 */
@ApiSchema({ name: 'SpacesModuleDataLightTarget' })
export class LightTargetDataModel {
	@ApiProperty({
		name: 'device_id',
		description: 'ID of the lighting device',
		type: 'string',
		format: 'uuid',
		example: 'a2b19ca3-521e-4d7b-b3fe-bcb7a8d5b9e7',
	})
	@Expose({ name: 'device_id' })
	deviceId: string;

	@ApiProperty({
		name: 'device_name',
		description: 'Name of the lighting device',
		type: 'string',
		example: 'Living Room Ceiling Light',
	})
	@Expose({ name: 'device_name' })
	deviceName: string;

	@ApiProperty({
		name: 'channel_id',
		description: 'ID of the light channel',
		type: 'string',
		format: 'uuid',
		example: 'c3d29eb4-632f-5e8c-c4af-ded8b9e6c0f8',
	})
	@Expose({ name: 'channel_id' })
	channelId: string;

	@ApiProperty({
		name: 'channel_name',
		description: 'Name of the light channel',
		type: 'string',
		example: 'Light',
	})
	@Expose({ name: 'channel_name' })
	channelName: string;

	@ApiPropertyOptional({
		description: 'The lighting role assigned to this target (null if not assigned)',
		enum: LightingRole,
		nullable: true,
		example: LightingRole.MAIN,
	})
	@Expose()
	role: LightingRole | null;

	@ApiProperty({
		description: 'Priority for selecting defaults within the same role',
		type: 'integer',
		example: 0,
	})
	@Expose()
	priority: number;

	@ApiProperty({
		name: 'has_brightness',
		description: 'Whether this light supports brightness control',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'has_brightness' })
	hasBrightness: boolean;

	@ApiProperty({
		name: 'has_color_temp',
		description: 'Whether this light supports color temperature control',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'has_color_temp' })
	hasColorTemp: boolean;

	@ApiProperty({
		name: 'has_color',
		description: 'Whether this light supports color (RGB) control',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'has_color' })
	hasColor: boolean;
}

/**
 * Response wrapper for light targets in a space
 */
@ApiSchema({ name: 'SpacesModuleResLightTargets' })
export class LightTargetsResponseModel extends BaseSuccessResponseModel<LightTargetDataModel[]> {
	@ApiProperty({
		description: 'Array of light targets in the space with their role assignments',
		type: () => [LightTargetDataModel],
	})
	@Expose()
	@Type(() => LightTargetDataModel)
	declare data: LightTargetDataModel[];
}

/**
 * Response wrapper for a single lighting role entity
 */
@ApiSchema({ name: 'SpacesModuleResLightingRole' })
export class LightingRoleResponseModel extends BaseSuccessResponseModel<SpaceLightingRoleEntity> {
	@ApiProperty({
		description: 'The lighting role assignment',
		type: () => SpaceLightingRoleEntity,
	})
	@Expose()
	@Type(() => SpaceLightingRoleEntity)
	declare data: SpaceLightingRoleEntity;
}

/**
 * Response wrapper for array of lighting role entities
 */
@ApiSchema({ name: 'SpacesModuleResLightingRoles' })
export class LightingRolesResponseModel extends BaseSuccessResponseModel<SpaceLightingRoleEntity[]> {
	@ApiProperty({
		description: 'Array of lighting role assignments',
		type: 'array',
		items: { $ref: getSchemaPath(SpaceLightingRoleEntity) },
	})
	@Expose()
	@Type(() => SpaceLightingRoleEntity)
	declare data: SpaceLightingRoleEntity[];
}

/**
 * Bulk lighting role update result data model
 */
@ApiSchema({ name: 'SpacesModuleDataBulkLightingRolesResult' })
export class BulkLightingRolesResultDataModel {
	@ApiProperty({
		description: 'Whether the bulk update was successful',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiProperty({
		name: 'roles_updated',
		description: 'Number of roles created or updated',
		type: 'integer',
		example: 3,
	})
	@Expose({ name: 'roles_updated' })
	rolesUpdated: number;
}

/**
 * Response wrapper for bulk lighting role update result
 */
@ApiSchema({ name: 'SpacesModuleResBulkLightingRoles' })
export class BulkLightingRolesResponseModel extends BaseSuccessResponseModel<BulkLightingRolesResultDataModel> {
	@ApiProperty({
		description: 'The result of the bulk lighting role update',
		type: () => BulkLightingRolesResultDataModel,
	})
	@Expose()
	@Type(() => BulkLightingRolesResultDataModel)
	declare data: BulkLightingRolesResultDataModel;
}

// ================================
// Suggestion Response Models
// ================================

/**
 * Space suggestion data model
 */
@ApiSchema({ name: 'SpacesModuleDataSuggestion' })
export class SuggestionDataModel {
	@ApiProperty({
		description: 'Type of the suggestion',
		enum: SuggestionType,
		example: SuggestionType.LIGHTING_RELAX,
	})
	@Expose()
	type: SuggestionType;

	@ApiProperty({
		description: 'Short title for the suggestion',
		type: 'string',
		example: 'Relax lighting',
	})
	@Expose()
	title: string;

	@ApiPropertyOptional({
		description: 'Optional reason/explanation for the suggestion',
		type: 'string',
		nullable: true,
		example: 'Evening time - switch to a calmer lighting mode',
	})
	@Expose()
	reason: string | null;

	@ApiProperty({
		name: 'lighting_mode',
		description: 'The lighting mode this suggestion would apply',
		enum: LightingMode,
		nullable: true,
		example: LightingMode.RELAX,
	})
	@Expose({ name: 'lighting_mode' })
	lightingMode: LightingMode | null;
}

/**
 * Response wrapper for space suggestion (nullable data)
 */
@ApiSchema({ name: 'SpacesModuleResSuggestion' })
export class SuggestionResponseModel extends BaseSuccessResponseModel<SuggestionDataModel | null> {
	@ApiProperty({
		description: 'The suggestion data (null if no suggestion available)',
		type: () => SuggestionDataModel,
		nullable: true,
	})
	@Expose()
	@Type(() => SuggestionDataModel)
	declare data: SuggestionDataModel | null;
}

/**
 * Suggestion feedback result data model
 */
@ApiSchema({ name: 'SpacesModuleDataSuggestionFeedbackResult' })
export class SuggestionFeedbackResultDataModel {
	@ApiProperty({
		description: 'Whether the feedback was recorded successfully',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiPropertyOptional({
		name: 'intent_executed',
		description: 'Whether the intent was executed (only for applied feedback)',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'intent_executed' })
	intentExecuted?: boolean;
}

/**
 * Response wrapper for suggestion feedback result
 */
@ApiSchema({ name: 'SpacesModuleResSuggestionFeedback' })
export class SuggestionFeedbackResponseModel extends BaseSuccessResponseModel<SuggestionFeedbackResultDataModel> {
	@ApiProperty({
		description: 'The result of the suggestion feedback',
		type: () => SuggestionFeedbackResultDataModel,
	})
	@Expose()
	@Type(() => SuggestionFeedbackResultDataModel)
	declare data: SuggestionFeedbackResultDataModel;
}

// ================================
// Category Template Response Models
// ================================

/**
 * Space category template data model
 */
@ApiSchema({ name: 'SpacesModuleDataCategoryTemplate' })
export class CategoryTemplateDataModel {
	@ApiProperty({
		description: 'Category identifier',
		enum: SpaceCategory,
		example: SpaceCategory.LIVING_ROOM,
	})
	@Expose()
	category: SpaceCategory;

	@ApiProperty({
		description: 'Suggested icon for the category',
		type: 'string',
		example: 'mdi:sofa',
	})
	@Expose()
	icon: string;

	@ApiProperty({
		description: 'Default description for the category',
		type: 'string',
		example: 'Main living and entertainment area',
	})
	@Expose()
	description: string;
}

/**
 * Response wrapper for category templates
 */
@ApiSchema({ name: 'SpacesModuleResCategoryTemplates' })
export class CategoryTemplatesResponseModel extends BaseSuccessResponseModel<CategoryTemplateDataModel[]> {
	@ApiProperty({
		description: 'Array of category templates with default values',
		type: 'array',
		items: { $ref: getSchemaPath(CategoryTemplateDataModel) },
	})
	@Expose()
	@Type(() => CategoryTemplateDataModel)
	declare data: CategoryTemplateDataModel[];
}

// ================================
// Intent Catalog Response Models
// ================================

/**
 * Intent enum value metadata data model
 */
@ApiSchema({ name: 'SpacesModuleDataIntentEnumValue' })
export class IntentEnumValueDataModel {
	@ApiProperty({
		description: 'The enum value identifier',
		type: 'string',
		example: 'work',
	})
	@Expose()
	value: string;

	@ApiProperty({
		description: 'Human-readable label for the value',
		type: 'string',
		example: 'Work',
	})
	@Expose()
	label: string;

	@ApiPropertyOptional({
		description: 'Description of what this value does',
		type: 'string',
		example: 'Bright lighting for focus and productivity',
	})
	@Expose()
	description?: string;

	@ApiPropertyOptional({
		description: 'Icon identifier for this value',
		type: 'string',
		example: 'mdi:briefcase',
	})
	@Expose()
	icon?: string;
}

/**
 * Intent parameter metadata data model
 */
@ApiSchema({ name: 'SpacesModuleDataIntentParam' })
export class IntentParamDataModel {
	@ApiProperty({
		description: 'Parameter name',
		type: 'string',
		example: 'mode',
	})
	@Expose()
	name: string;

	@ApiProperty({
		description: 'Parameter type',
		enum: ['enum', 'boolean', 'number'],
		example: 'enum',
	})
	@Expose()
	type: string;

	@ApiProperty({
		description: 'Whether the parameter is required',
		type: 'boolean',
		example: true,
	})
	@Expose()
	required: boolean;

	@ApiProperty({
		description: 'Description of the parameter',
		type: 'string',
		example: 'The lighting mode to apply',
	})
	@Expose()
	description: string;

	@ApiPropertyOptional({
		name: 'enum_values',
		description: 'Available values for enum type parameters',
		type: () => [IntentEnumValueDataModel],
	})
	@Expose({ name: 'enum_values' })
	@Type(() => IntentEnumValueDataModel)
	enumValues?: IntentEnumValueDataModel[];

	@ApiPropertyOptional({
		name: 'min_value',
		description: 'Minimum value for number type parameters',
		type: 'number',
		example: -10,
	})
	@Expose({ name: 'min_value' })
	minValue?: number;

	@ApiPropertyOptional({
		name: 'max_value',
		description: 'Maximum value for number type parameters',
		type: 'number',
		example: 50,
	})
	@Expose({ name: 'max_value' })
	maxValue?: number;
}

/**
 * Intent type metadata data model
 */
@ApiSchema({ name: 'SpacesModuleDataIntentType' })
export class IntentTypeDataModel {
	@ApiProperty({
		description: 'Intent type identifier',
		type: 'string',
		example: 'set_mode',
	})
	@Expose()
	type: string;

	@ApiProperty({
		description: 'Human-readable label for the intent',
		type: 'string',
		example: 'Set Mode',
	})
	@Expose()
	label: string;

	@ApiProperty({
		description: 'Description of what the intent does',
		type: 'string',
		example: 'Set a lighting mode (work/relax/night) with role-based brightness levels',
	})
	@Expose()
	description: string;

	@ApiProperty({
		description: 'Icon identifier for the intent',
		type: 'string',
		example: 'mdi:lightbulb-group',
	})
	@Expose()
	icon: string;

	@ApiProperty({
		description: 'Parameters for this intent',
		type: () => [IntentParamDataModel],
	})
	@Expose()
	@Type(() => IntentParamDataModel)
	params: IntentParamDataModel[];
}

/**
 * Intent category metadata data model
 */
@ApiSchema({ name: 'SpacesModuleDataIntentCategory' })
export class IntentCategoryDataModel {
	@ApiProperty({
		description: 'Category identifier',
		enum: IntentCategory,
		example: IntentCategory.LIGHTING,
	})
	@Expose()
	category: IntentCategory;

	@ApiProperty({
		description: 'Human-readable label for the category',
		type: 'string',
		example: 'Lighting',
	})
	@Expose()
	label: string;

	@ApiProperty({
		description: 'Description of the category',
		type: 'string',
		example: 'Control lights in the space with modes and brightness adjustments',
	})
	@Expose()
	description: string;

	@ApiProperty({
		description: 'Icon identifier for the category',
		type: 'string',
		example: 'mdi:lightbulb-group',
	})
	@Expose()
	icon: string;

	@ApiProperty({
		description: 'Available intents in this category',
		type: () => [IntentTypeDataModel],
	})
	@Expose()
	@Type(() => IntentTypeDataModel)
	intents: IntentTypeDataModel[];
}

/**
 * Quick action metadata data model
 */
@ApiSchema({ name: 'SpacesModuleDataQuickAction' })
export class QuickActionDataModel {
	@ApiProperty({
		description: 'Quick action type identifier',
		enum: QuickActionType,
		example: QuickActionType.LIGHTING_WORK,
	})
	@Expose()
	type: QuickActionType;

	@ApiProperty({
		description: 'Human-readable label for the action',
		type: 'string',
		example: 'Work Mode',
	})
	@Expose()
	label: string;

	@ApiProperty({
		description: 'Description of the action',
		type: 'string',
		example: 'Bright lighting for focus',
	})
	@Expose()
	description: string;

	@ApiProperty({
		description: 'Icon identifier for the action',
		type: 'string',
		example: 'mdi:briefcase',
	})
	@Expose()
	icon: string;

	@ApiProperty({
		description: 'The intent category this action belongs to',
		enum: IntentCategory,
		example: IntentCategory.LIGHTING,
	})
	@Expose()
	category: IntentCategory;
}

/**
 * Lighting role metadata data model
 */
@ApiSchema({ name: 'SpacesModuleDataLightingRoleMeta' })
export class LightingRoleMetaDataModel {
	@ApiProperty({
		description: 'Role identifier',
		enum: LightingRole,
		example: LightingRole.MAIN,
	})
	@Expose()
	value: LightingRole;

	@ApiProperty({
		description: 'Human-readable label for the role',
		type: 'string',
		example: 'Main',
	})
	@Expose()
	label: string;

	@ApiProperty({
		description: 'Description of the role',
		type: 'string',
		example: 'Primary/ceiling lights',
	})
	@Expose()
	description: string;

	@ApiPropertyOptional({
		description: 'Icon identifier for the role',
		type: 'string',
		example: 'mdi:ceiling-light',
	})
	@Expose()
	icon?: string;
}

/**
 * Complete intent catalog data model
 */
@ApiSchema({ name: 'SpacesModuleDataIntentCatalog' })
export class IntentCatalogDataModel {
	@ApiProperty({
		description: 'Available intent categories with their intents',
		type: () => [IntentCategoryDataModel],
	})
	@Expose()
	@Type(() => IntentCategoryDataModel)
	categories: IntentCategoryDataModel[];

	@ApiProperty({
		name: 'quick_actions',
		description: 'Available quick actions',
		type: () => [QuickActionDataModel],
	})
	@Expose({ name: 'quick_actions' })
	@Type(() => QuickActionDataModel)
	quickActions: QuickActionDataModel[];

	@ApiProperty({
		name: 'lighting_roles',
		description: 'Available lighting roles',
		type: () => [LightingRoleMetaDataModel],
	})
	@Expose({ name: 'lighting_roles' })
	@Type(() => LightingRoleMetaDataModel)
	lightingRoles: LightingRoleMetaDataModel[];
}

/**
 * Response wrapper for intent catalog
 */
@ApiSchema({ name: 'SpacesModuleResIntentCatalog' })
export class IntentCatalogResponseModel extends BaseSuccessResponseModel<IntentCatalogDataModel> {
	@ApiProperty({
		description: 'The intent catalog with all available intents, quick actions, and roles',
		type: () => IntentCatalogDataModel,
	})
	@Expose()
	@Type(() => IntentCatalogDataModel)
	declare data: IntentCatalogDataModel;
}

// ================================
// Context Snapshot Response Models
// ================================

/**
 * State of a single light device at a point in time
 */
@ApiSchema({ name: 'SpacesModuleDataLightStateSnapshot' })
export class LightStateSnapshotDataModel {
	@ApiProperty({
		name: 'device_id',
		description: 'ID of the lighting device',
		type: 'string',
		format: 'uuid',
		example: 'a2b19ca3-521e-4d7b-b3fe-bcb7a8d5b9e7',
	})
	@Expose({ name: 'device_id' })
	deviceId: string;

	@ApiProperty({
		name: 'device_name',
		description: 'Name of the lighting device',
		type: 'string',
		example: 'Living Room Ceiling Light',
	})
	@Expose({ name: 'device_name' })
	deviceName: string;

	@ApiProperty({
		name: 'channel_id',
		description: 'ID of the light channel',
		type: 'string',
		format: 'uuid',
		example: 'c3d29eb4-632f-5e8c-c4af-ded8b9e6c0f8',
	})
	@Expose({ name: 'channel_id' })
	channelId: string;

	@ApiProperty({
		name: 'channel_name',
		description: 'Name of the light channel',
		type: 'string',
		example: 'Light',
	})
	@Expose({ name: 'channel_name' })
	channelName: string;

	@ApiPropertyOptional({
		description: 'The lighting role assigned to this light (null if not assigned)',
		enum: LightingRole,
		nullable: true,
		example: LightingRole.MAIN,
	})
	@Expose()
	role: LightingRole | null;

	@ApiProperty({
		name: 'is_on',
		description: 'Whether the light is currently on',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'is_on' })
	isOn: boolean;

	@ApiPropertyOptional({
		description: 'Current brightness level (0-100), null if not supported',
		type: 'number',
		nullable: true,
		example: 75,
	})
	@Expose()
	brightness: number | null;

	@ApiPropertyOptional({
		name: 'color_temperature',
		description: 'Current color temperature in Kelvin, null if not supported',
		type: 'number',
		nullable: true,
		example: 4000,
	})
	@Expose({ name: 'color_temperature' })
	colorTemperature: number | null;

	@ApiPropertyOptional({
		description: 'Current color value (hex or RGB string), null if not supported',
		type: 'string',
		nullable: true,
		example: '#ff6b35',
	})
	@Expose()
	color: string | null;
}

/**
 * Summary of lighting state in the space
 */
@ApiSchema({ name: 'SpacesModuleDataLightingSummary' })
export class LightingSummaryDataModel {
	@ApiProperty({
		name: 'total_lights',
		description: 'Total number of lights in the space',
		type: 'integer',
		example: 5,
	})
	@Expose({ name: 'total_lights' })
	totalLights: number;

	@ApiProperty({
		name: 'lights_on',
		description: 'Number of lights currently on',
		type: 'integer',
		example: 3,
	})
	@Expose({ name: 'lights_on' })
	lightsOn: number;

	@ApiPropertyOptional({
		name: 'average_brightness',
		description: 'Average brightness of lights that are on (0-100), null if no lights are on with brightness',
		type: 'number',
		nullable: true,
		example: 65,
	})
	@Expose({ name: 'average_brightness' })
	averageBrightness: number | null;
}

/**
 * Complete lighting context snapshot
 */
@ApiSchema({ name: 'SpacesModuleDataLightingContext' })
export class LightingContextDataModel {
	@ApiProperty({
		description: 'Summary of lighting state',
		type: () => LightingSummaryDataModel,
	})
	@Expose()
	@Type(() => LightingSummaryDataModel)
	summary: LightingSummaryDataModel;

	@ApiProperty({
		description: 'State of each individual light',
		type: () => [LightStateSnapshotDataModel],
	})
	@Expose()
	@Type(() => LightStateSnapshotDataModel)
	lights: LightStateSnapshotDataModel[];
}

/**
 * Complete space context snapshot data model
 */
@ApiSchema({ name: 'SpacesModuleDataContextSnapshot' })
export class ContextSnapshotDataModel {
	@ApiProperty({
		name: 'space_id',
		description: 'ID of the space',
		type: 'string',
		format: 'uuid',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'space_id' })
	spaceId: string;

	@ApiProperty({
		name: 'space_name',
		description: 'Name of the space',
		type: 'string',
		example: 'Living Room',
	})
	@Expose({ name: 'space_name' })
	spaceName: string;

	@ApiProperty({
		name: 'captured_at',
		description: 'Timestamp when the snapshot was captured',
		type: 'string',
		format: 'date-time',
		example: '2025-01-25T12:00:00Z',
	})
	@Expose({ name: 'captured_at' })
	capturedAt: Date;

	@ApiProperty({
		description: 'Lighting context snapshot',
		type: () => LightingContextDataModel,
	})
	@Expose()
	@Type(() => LightingContextDataModel)
	lighting: LightingContextDataModel;

	@ApiProperty({
		description: 'Climate state snapshot',
		type: () => ClimateStateDataModel,
	})
	@Expose()
	@Type(() => ClimateStateDataModel)
	climate: ClimateStateDataModel;
}

/**
 * Response wrapper for context snapshot
 */
@ApiSchema({ name: 'SpacesModuleResContextSnapshot' })
export class ContextSnapshotResponseModel extends BaseSuccessResponseModel<ContextSnapshotDataModel> {
	@ApiProperty({
		description: 'The complete context snapshot for the space',
		type: () => ContextSnapshotDataModel,
	})
	@Expose()
	@Type(() => ContextSnapshotDataModel)
	declare data: ContextSnapshotDataModel;
}
