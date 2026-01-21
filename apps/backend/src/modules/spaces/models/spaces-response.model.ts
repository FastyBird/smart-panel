import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { ChannelCategory, DeviceCategory } from '../../devices/devices.constants';
import { SpaceClimateRoleEntity } from '../entities/space-climate-role.entity';
import { SpaceCoversRoleEntity } from '../entities/space-covers-role.entity';
import { SpaceLightingRoleEntity } from '../entities/space-lighting-role.entity';
import { SpaceSensorRoleEntity } from '../entities/space-sensor-role.entity';
import { SpaceEntity } from '../entities/space.entity';
import {
	ClimateMode,
	ClimateRole,
	CoversMode,
	CoversRole,
	IntentCategory,
	LightingMode,
	LightingRole,
	QuickActionType,
	SensorRole,
	SpaceCategory,
	SpaceType,
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
		description: 'Proposed space type',
		enum: SpaceType,
		example: SpaceType.ROOM,
	})
	@Expose()
	type: SpaceType;

	@ApiPropertyOptional({
		description: 'Proposed space category (based on detected room/zone type)',
		enum: SpaceCategory,
		nullable: true,
		example: SpaceCategory.LIVING_ROOM,
	})
	@Expose()
	category: SpaceCategory | null;

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
		name: 'mode',
		description: 'Current climate mode detected from device states',
		enum: ['heat', 'cool', 'auto', 'off'],
		example: 'heat',
	})
	@Expose({ name: 'mode' })
	mode: string;

	@ApiProperty({
		name: 'current_temperature',
		description: 'Current temperature reading in degrees Celsius (averaged from all primary devices)',
		type: 'number',
		nullable: true,
		example: 22.5,
	})
	@Expose({ name: 'current_temperature' })
	currentTemperature: number | null;

	@ApiProperty({
		name: 'current_humidity',
		description: 'Current humidity reading in percent (averaged from all devices with humidity)',
		type: 'number',
		nullable: true,
		example: 45,
	})
	@Expose({ name: 'current_humidity' })
	currentHumidity: number | null;

	@ApiProperty({
		name: 'heating_setpoint',
		description: 'Heating setpoint - target temperature for heating (used in HEAT and AUTO modes)',
		type: 'number',
		nullable: true,
		example: 20.0,
	})
	@Expose({ name: 'heating_setpoint' })
	heatingSetpoint: number | null;

	@ApiProperty({
		name: 'cooling_setpoint',
		description: 'Cooling setpoint - target temperature for cooling (used in COOL and AUTO modes)',
		type: 'number',
		nullable: true,
		example: 24.0,
	})
	@Expose({ name: 'cooling_setpoint' })
	coolingSetpoint: number | null;

	@ApiProperty({
		name: 'min_setpoint',
		description: 'Minimum allowed setpoint temperature (intersection of all device limits)',
		type: 'number',
		example: 15,
	})
	@Expose({ name: 'min_setpoint' })
	minSetpoint: number;

	@ApiProperty({
		name: 'max_setpoint',
		description: 'Maximum allowed setpoint temperature (intersection of all device limits)',
		type: 'number',
		example: 30,
	})
	@Expose({ name: 'max_setpoint' })
	maxSetpoint: number;

	@ApiProperty({
		name: 'supports_heating',
		description: 'Whether any device in the space supports heating',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'supports_heating' })
	supportsHeating: boolean;

	@ApiProperty({
		name: 'supports_cooling',
		description: 'Whether any device in the space supports cooling',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'supports_cooling' })
	supportsCooling: boolean;

	@ApiProperty({
		name: 'is_heating',
		description: 'Whether any heater device is currently active (ON)',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'is_heating' })
	isHeating: boolean;

	@ApiProperty({
		name: 'is_cooling',
		description: 'Whether any cooler device is currently active (ON)',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'is_cooling' })
	isCooling: boolean;

	@ApiProperty({
		name: 'is_mixed',
		description: 'Whether devices have different setpoint values (out of sync)',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'is_mixed' })
	isMixed: boolean;

	@ApiProperty({
		name: 'devices_count',
		description: 'Number of primary climate devices in the space',
		type: 'integer',
		example: 2,
	})
	@Expose({ name: 'devices_count' })
	devicesCount: number;

	@ApiPropertyOptional({
		name: 'last_applied_mode',
		description: 'The last climate mode that was explicitly applied via intent (from storage)',
		enum: ClimateMode,
		nullable: true,
	})
	@Expose({ name: 'last_applied_mode' })
	lastAppliedMode: ClimateMode | null;

	@ApiPropertyOptional({
		name: 'last_applied_at',
		description: 'When the last mode was applied',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'last_applied_at' })
	lastAppliedAt: Date | null;
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
		example: 2,
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
		name: 'mode',
		description: 'The climate mode after the intent was executed',
		enum: ['heat', 'cool', 'auto', 'off'],
		example: 'heat',
	})
	@Expose({ name: 'mode' })
	mode: string;

	@ApiProperty({
		name: 'heating_setpoint',
		description: 'The new heating setpoint (used in HEAT and AUTO modes)',
		type: 'number',
		nullable: true,
		example: 20.0,
	})
	@Expose({ name: 'heating_setpoint' })
	heatingSetpoint: number | null;

	@ApiProperty({
		name: 'cooling_setpoint',
		description: 'The new cooling setpoint (used in COOL and AUTO modes)',
		type: 'number',
		nullable: true,
		example: 24.0,
	})
	@Expose({ name: 'cooling_setpoint' })
	coolingSetpoint: number | null;
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
 * Individual result for a lighting role operation
 */
@ApiSchema({ name: 'SpacesModuleDataBulkLightingRoleItem' })
export class BulkLightingRoleResultItemModel {
	@ApiProperty({
		name: 'device_id',
		description: 'ID of the device',
		type: 'string',
		format: 'uuid',
		example: 'a2b19ca3-521e-4d7b-b3fe-bcb7a8d5b9e7',
	})
	@Expose({ name: 'device_id' })
	deviceId: string;

	@ApiProperty({
		name: 'channel_id',
		description: 'ID of the channel',
		type: 'string',
		format: 'uuid',
		example: 'c3d29eb4-632f-5e8c-c4af-ded8b9e6c0f8',
	})
	@Expose({ name: 'channel_id' })
	channelId: string;

	@ApiProperty({
		description: 'Whether this role was set successfully',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiPropertyOptional({
		description: 'The role that was set (null if failed)',
		enum: LightingRole,
		nullable: true,
		example: LightingRole.MAIN,
	})
	@Expose()
	role: LightingRole | null;

	@ApiPropertyOptional({
		description: 'Error message if the operation failed',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose()
	error: string | null;
}

/**
 * Bulk lighting role update result data model
 */
@ApiSchema({ name: 'SpacesModuleDataBulkLightingRolesResult' })
export class BulkLightingRolesResultDataModel {
	@ApiProperty({
		description: 'Whether all operations were successful',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiProperty({
		name: 'total_count',
		description: 'Total number of roles in the request',
		type: 'integer',
		example: 3,
	})
	@Expose({ name: 'total_count' })
	totalCount: number;

	@ApiProperty({
		name: 'success_count',
		description: 'Number of roles successfully created or updated',
		type: 'integer',
		example: 3,
	})
	@Expose({ name: 'success_count' })
	successCount: number;

	@ApiProperty({
		name: 'failure_count',
		description: 'Number of roles that failed to update',
		type: 'integer',
		example: 0,
	})
	@Expose({ name: 'failure_count' })
	failureCount: number;

	@ApiProperty({
		description: 'Detailed results for each role operation',
		type: () => [BulkLightingRoleResultItemModel],
	})
	@Expose()
	@Type(() => BulkLightingRoleResultItemModel)
	results: BulkLightingRoleResultItemModel[];
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
// Climate Role Response Models
// ================================

/**
 * Climate target data model (a climate device/channel in a space)
 */
@ApiSchema({ name: 'SpacesModuleDataClimateTarget' })
export class ClimateTargetDataModel {
	@ApiProperty({
		name: 'device_id',
		description: 'ID of the climate device',
		type: 'string',
		format: 'uuid',
		example: 'a2b19ca3-521e-4d7b-b3fe-bcb7a8d5b9e7',
	})
	@Expose({ name: 'device_id' })
	deviceId: string;

	@ApiProperty({
		name: 'device_name',
		description: 'Name of the climate device',
		type: 'string',
		example: 'Living Room Thermostat',
	})
	@Expose({ name: 'device_name' })
	deviceName: string;

	@ApiProperty({
		name: 'device_category',
		description: 'Category of the climate device',
		enum: DeviceCategory,
		example: DeviceCategory.THERMOSTAT,
	})
	@Expose({ name: 'device_category' })
	deviceCategory: DeviceCategory;

	@ApiPropertyOptional({
		name: 'channel_id',
		description: 'ID of the channel (for sensor roles)',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'c3d29ea4-632f-5e8c-c4af-dce8b9e6c0f8',
	})
	@Expose({ name: 'channel_id' })
	channelId: string | null;

	@ApiPropertyOptional({
		name: 'channel_name',
		description: 'Name of the channel (for sensor roles)',
		type: 'string',
		nullable: true,
		example: 'Temperature Sensor',
	})
	@Expose({ name: 'channel_name' })
	channelName: string | null;

	@ApiPropertyOptional({
		name: 'channel_category',
		description: 'Category of the channel (for sensor roles) - indicates sensor type',
		enum: ChannelCategory,
		nullable: true,
		example: ChannelCategory.TEMPERATURE,
	})
	@Expose({ name: 'channel_category' })
	channelCategory: ChannelCategory | null;

	@ApiPropertyOptional({
		description: 'The climate role assigned to this target (null if not assigned)',
		enum: ClimateRole,
		nullable: true,
		example: ClimateRole.AUTO,
	})
	@Expose()
	role: ClimateRole | null;

	@ApiProperty({
		description: 'Priority for selecting defaults within the same role',
		type: 'integer',
		example: 0,
	})
	@Expose()
	priority: number;

	@ApiProperty({
		name: 'has_temperature',
		description: 'Whether this target is a temperature sensor channel',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'has_temperature' })
	hasTemperature: boolean;

	@ApiProperty({
		name: 'has_humidity',
		description: 'Whether this target is a humidity sensor channel',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'has_humidity' })
	hasHumidity: boolean;

	@ApiProperty({
		name: 'has_air_quality',
		description: 'Whether this target is an air quality sensor channel',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'has_air_quality' })
	hasAirQuality: boolean;

	@ApiProperty({
		name: 'has_air_particulate',
		description: 'Whether this target is an air particulate (PM2.5/PM10) sensor channel',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'has_air_particulate' })
	hasAirParticulate: boolean;

	@ApiProperty({
		name: 'has_carbon_dioxide',
		description: 'Whether this target is a carbon dioxide (CO2) sensor channel',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'has_carbon_dioxide' })
	hasCarbonDioxide: boolean;

	@ApiProperty({
		name: 'has_volatile_organic_compounds',
		description: 'Whether this target is a volatile organic compounds (VOC) sensor channel',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'has_volatile_organic_compounds' })
	hasVolatileOrganicCompounds: boolean;

	@ApiProperty({
		name: 'has_pressure',
		description: 'Whether this target is an atmospheric pressure sensor channel',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'has_pressure' })
	hasPressure: boolean;

	@ApiProperty({
		name: 'has_mode',
		description: 'Whether this device supports HVAC mode control',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'has_mode' })
	hasMode: boolean;
}

/**
 * Response wrapper for climate targets in a space
 */
@ApiSchema({ name: 'SpacesModuleResClimateTargets' })
export class ClimateTargetsResponseModel extends BaseSuccessResponseModel<ClimateTargetDataModel[]> {
	@ApiProperty({
		description: 'Array of climate targets in the space with their role assignments',
		type: () => [ClimateTargetDataModel],
	})
	@Expose()
	@Type(() => ClimateTargetDataModel)
	declare data: ClimateTargetDataModel[];
}

/**
 * Response wrapper for a single climate role assignment
 * Note: data can be null when the role assignment was removed
 */
@ApiSchema({ name: 'SpacesModuleResClimateRole' })
export class ClimateRoleResponseModel extends BaseSuccessResponseModel<SpaceClimateRoleEntity | null> {
	@ApiProperty({
		description: 'The climate role assignment, or null if the role was removed',
		type: () => SpaceClimateRoleEntity,
		nullable: true,
		required: false,
	})
	@Expose()
	@Type(() => SpaceClimateRoleEntity)
	declare data: SpaceClimateRoleEntity | null;
}

/**
 * Response wrapper for multiple climate role assignments
 */
@ApiSchema({ name: 'SpacesModuleResClimateRoles' })
export class ClimateRolesResponseModel extends BaseSuccessResponseModel<SpaceClimateRoleEntity[]> {
	@ApiProperty({
		description: 'Array of climate role assignments',
		type: 'array',
		items: { $ref: getSchemaPath(SpaceClimateRoleEntity) },
	})
	@Expose()
	@Type(() => SpaceClimateRoleEntity)
	declare data: SpaceClimateRoleEntity[];
}

/**
 * Bulk climate role update result item
 */
@ApiSchema({ name: 'SpacesModuleDataBulkClimateRoleItem' })
export class BulkClimateRoleResultItemModel {
	@ApiProperty({
		name: 'device_id',
		description: 'ID of the climate device',
		type: 'string',
		format: 'uuid',
		example: 'a2b19ca3-521e-4d7b-b3fe-bcb7a8d5b9e7',
	})
	@Expose({ name: 'device_id' })
	deviceId: string;

	@ApiPropertyOptional({
		name: 'channel_id',
		description: 'ID of the channel (for sensor roles)',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'channel_id' })
	channelId: string | null;

	@ApiProperty({
		description: 'Whether the role was set successfully',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiPropertyOptional({
		description: 'The role that was set (null if failed)',
		enum: ClimateRole,
		nullable: true,
		example: ClimateRole.AUTO,
	})
	@Expose()
	role: ClimateRole | null;

	@ApiPropertyOptional({
		description: 'Error message if the role assignment failed',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose()
	error: string | null;
}

/**
 * Bulk climate role update result data
 */
@ApiSchema({ name: 'SpacesModuleDataBulkClimateRolesResult' })
export class BulkClimateRolesResultDataModel {
	@ApiProperty({
		description: 'Whether all role assignments succeeded',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiProperty({
		name: 'total_count',
		description: 'Total number of role assignments attempted',
		type: 'integer',
		example: 3,
	})
	@Expose({ name: 'total_count' })
	totalCount: number;

	@ApiProperty({
		name: 'success_count',
		description: 'Number of successful role assignments',
		type: 'integer',
		example: 3,
	})
	@Expose({ name: 'success_count' })
	successCount: number;

	@ApiProperty({
		name: 'failure_count',
		description: 'Number of failed role assignments',
		type: 'integer',
		example: 0,
	})
	@Expose({ name: 'failure_count' })
	failureCount: number;

	@ApiProperty({
		description: 'Detailed results for each role assignment',
		type: () => [BulkClimateRoleResultItemModel],
	})
	@Expose()
	@Type(() => BulkClimateRoleResultItemModel)
	results: BulkClimateRoleResultItemModel[];
}

/**
 * Response wrapper for bulk climate role update result
 */
@ApiSchema({ name: 'SpacesModuleResBulkClimateRoles' })
export class BulkClimateRolesResponseModel extends BaseSuccessResponseModel<BulkClimateRolesResultDataModel> {
	@ApiProperty({
		description: 'The result of the bulk climate role update',
		type: () => BulkClimateRolesResultDataModel,
	})
	@Expose()
	@Type(() => BulkClimateRolesResultDataModel)
	declare data: BulkClimateRolesResultDataModel;
}

// ================================
// Covers State & Intent Response Models
// ================================

/**
 * Covers state data model (aggregated covers state for a space)
 */
@ApiSchema({ name: 'SpacesModuleDataCoversState' })
export class CoversStateDataModel {
	@ApiProperty({
		name: 'has_covers',
		description: 'Whether the space has any controllable covers',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'has_covers' })
	hasCovers: boolean;

	@ApiPropertyOptional({
		name: 'average_position',
		description: 'Average position of all covers (0-100, null if no covers)',
		type: 'integer',
		nullable: true,
		example: 75,
	})
	@Expose({ name: 'average_position' })
	averagePosition: number | null;

	@ApiProperty({
		name: 'any_open',
		description: 'Whether any covers are open (position > 0)',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'any_open' })
	anyOpen: boolean;

	@ApiProperty({
		name: 'all_closed',
		description: 'Whether all covers are closed (position = 0)',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'all_closed' })
	allClosed: boolean;

	@ApiProperty({
		name: 'devices_count',
		description: 'Total number of cover devices in the space',
		type: 'integer',
		example: 2,
	})
	@Expose({ name: 'devices_count' })
	devicesCount: number;

	@ApiProperty({
		name: 'covers_by_role',
		description: 'Count of covers grouped by role',
		type: 'object',
		additionalProperties: { type: 'integer' },
		example: { primary: 1, blackout: 1 },
	})
	@Expose({ name: 'covers_by_role' })
	coversByRole: Record<string, number>;

	@ApiPropertyOptional({
		name: 'last_applied_mode',
		description: 'The last covers mode that was explicitly applied via intent (from storage)',
		enum: CoversMode,
		nullable: true,
	})
	@Expose({ name: 'last_applied_mode' })
	lastAppliedMode: CoversMode | null;

	@ApiPropertyOptional({
		name: 'last_applied_at',
		description: 'When the last mode was applied',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'last_applied_at' })
	lastAppliedAt: Date | null;
}

/**
 * Response wrapper for covers state
 */
@ApiSchema({ name: 'SpacesModuleResCoversState' })
export class CoversStateResponseModel extends BaseSuccessResponseModel<CoversStateDataModel> {
	@ApiProperty({
		description: 'The covers state data',
		type: () => CoversStateDataModel,
	})
	@Expose()
	@Type(() => CoversStateDataModel)
	declare data: CoversStateDataModel;
}

/**
 * Covers intent execution result data model
 */
@ApiSchema({ name: 'SpacesModuleDataCoversIntentResult' })
export class CoversIntentResultDataModel {
	@ApiProperty({
		description: 'Whether the intent was executed successfully',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiProperty({
		name: 'affected_devices',
		description: 'Number of devices that were successfully affected',
		type: 'integer',
		example: 2,
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

	@ApiPropertyOptional({
		name: 'new_position',
		description: 'The new average position after the intent (null if not applicable)',
		type: 'integer',
		nullable: true,
		example: 50,
	})
	@Expose({ name: 'new_position' })
	newPosition: number | null;
}

/**
 * Response wrapper for covers intent execution result
 */
@ApiSchema({ name: 'SpacesModuleResCoversIntent' })
export class CoversIntentResponseModel extends BaseSuccessResponseModel<CoversIntentResultDataModel> {
	@ApiProperty({
		description: 'The result of the covers intent execution',
		type: () => CoversIntentResultDataModel,
	})
	@Expose()
	@Type(() => CoversIntentResultDataModel)
	declare data: CoversIntentResultDataModel;
}

// ================================
// Covers Role Response Models
// ================================

/**
 * Covers target data model (a cover device/channel in a space)
 */
@ApiSchema({ name: 'SpacesModuleDataCoversTarget' })
export class CoversTargetDataModel {
	@ApiProperty({
		name: 'device_id',
		description: 'ID of the window covering device',
		type: 'string',
		format: 'uuid',
		example: 'a2b19ca3-521e-4d7b-b3fe-bcb7a8d5b9e7',
	})
	@Expose({ name: 'device_id' })
	deviceId: string;

	@ApiProperty({
		name: 'device_name',
		description: 'Name of the device',
		type: 'string',
		example: 'Living Room Blinds',
	})
	@Expose({ name: 'device_name' })
	deviceName: string;

	@ApiProperty({
		name: 'channel_id',
		description: 'ID of the window covering channel',
		type: 'string',
		format: 'uuid',
		example: 'c3d29eb4-632f-5e8c-c4af-ded8b9e6c0f8',
	})
	@Expose({ name: 'channel_id' })
	channelId: string;

	@ApiProperty({
		name: 'channel_name',
		description: 'Name of the channel',
		type: 'string',
		example: 'Window Covering',
	})
	@Expose({ name: 'channel_name' })
	channelName: string;

	@ApiPropertyOptional({
		description: 'The assigned covers role (null if not assigned)',
		enum: CoversRole,
		nullable: true,
		example: CoversRole.PRIMARY,
	})
	@Expose()
	role: CoversRole | null;

	@ApiProperty({
		description: 'Priority for role ordering (lower = higher priority)',
		type: 'integer',
		example: 0,
	})
	@Expose()
	priority: number;

	@ApiProperty({
		name: 'has_position',
		description: 'Whether the cover supports position control',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'has_position' })
	hasPosition: boolean;

	@ApiProperty({
		name: 'has_command',
		description: 'Whether the cover supports open/close/stop commands',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'has_command' })
	hasCommand: boolean;

	@ApiProperty({
		name: 'has_tilt',
		description: 'Whether the cover supports tilt control',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'has_tilt' })
	hasTilt: boolean;

	@ApiPropertyOptional({
		name: 'cover_type',
		description: 'Type of cover (curtain, blind, roller, etc.)',
		type: 'string',
		nullable: true,
		example: 'blind',
	})
	@Expose({ name: 'cover_type' })
	coverType: string | null;
}

/**
 * Response wrapper for covers targets in a space
 */
@ApiSchema({ name: 'SpacesModuleResCoversTargets' })
export class CoversTargetsResponseModel extends BaseSuccessResponseModel<CoversTargetDataModel[]> {
	@ApiProperty({
		description: 'Array of covers targets in the space with their role assignments',
		type: () => [CoversTargetDataModel],
	})
	@Expose()
	@Type(() => CoversTargetDataModel)
	declare data: CoversTargetDataModel[];
}

/**
 * Response wrapper for a single covers role entity
 */
@ApiSchema({ name: 'SpacesModuleResCoversRole' })
export class CoversRoleResponseModel extends BaseSuccessResponseModel<SpaceCoversRoleEntity> {
	@ApiProperty({
		description: 'The covers role assignment',
		type: () => SpaceCoversRoleEntity,
	})
	@Expose()
	@Type(() => SpaceCoversRoleEntity)
	declare data: SpaceCoversRoleEntity;
}

/**
 * Bulk covers role update result item
 */
@ApiSchema({ name: 'SpacesModuleDataBulkCoversRoleResultItem' })
export class BulkCoversRoleResultItemModel {
	@ApiProperty({
		name: 'device_id',
		description: 'ID of the window covering device',
		type: 'string',
		format: 'uuid',
		example: 'a2b19ca3-521e-4d7b-b3fe-bcb7a8d5b9e7',
	})
	@Expose({ name: 'device_id' })
	deviceId: string;

	@ApiProperty({
		name: 'channel_id',
		description: 'ID of the window covering channel',
		type: 'string',
		format: 'uuid',
		example: 'c3d29eb4-632f-5e8c-c4af-ded8b9e6c0f8',
	})
	@Expose({ name: 'channel_id' })
	channelId: string;

	@ApiProperty({
		description: 'Whether the role was set successfully',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiPropertyOptional({
		description: 'The role that was set (null if failed)',
		enum: CoversRole,
		nullable: true,
		example: CoversRole.PRIMARY,
	})
	@Expose()
	role: CoversRole | null;

	@ApiPropertyOptional({
		description: 'Error message if the role assignment failed',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose()
	error: string | null;
}

/**
 * Bulk covers role update result data
 */
@ApiSchema({ name: 'SpacesModuleDataBulkCoversRolesResult' })
export class BulkCoversRolesResultDataModel {
	@ApiProperty({
		description: 'Whether all role assignments succeeded',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiProperty({
		name: 'total_count',
		description: 'Total number of role assignments attempted',
		type: 'integer',
		example: 2,
	})
	@Expose({ name: 'total_count' })
	totalCount: number;

	@ApiProperty({
		name: 'success_count',
		description: 'Number of successful role assignments',
		type: 'integer',
		example: 2,
	})
	@Expose({ name: 'success_count' })
	successCount: number;

	@ApiProperty({
		name: 'failure_count',
		description: 'Number of failed role assignments',
		type: 'integer',
		example: 0,
	})
	@Expose({ name: 'failure_count' })
	failureCount: number;

	@ApiProperty({
		description: 'Detailed results for each role assignment',
		type: () => [BulkCoversRoleResultItemModel],
	})
	@Expose()
	@Type(() => BulkCoversRoleResultItemModel)
	results: BulkCoversRoleResultItemModel[];
}

/**
 * Response wrapper for bulk covers role update result
 */
@ApiSchema({ name: 'SpacesModuleResBulkCoversRoles' })
export class BulkCoversRolesResponseModel extends BaseSuccessResponseModel<BulkCoversRolesResultDataModel> {
	@ApiProperty({
		description: 'The result of the bulk covers role update',
		type: () => BulkCoversRolesResultDataModel,
	})
	@Expose()
	@Type(() => BulkCoversRolesResultDataModel)
	declare data: BulkCoversRolesResultDataModel;
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

// ================================
// Undo History Response Models
// ================================

/**
 * Undo state data model - indicates whether undo is available
 */
@ApiSchema({ name: 'SpacesModuleDataUndoState' })
export class UndoStateDataModel {
	@ApiProperty({
		name: 'can_undo',
		description: 'Whether an undo action is available for this space',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'can_undo' })
	canUndo: boolean;

	@ApiPropertyOptional({
		name: 'action_description',
		description: 'Description of the action that can be undone (null if no undo available)',
		type: 'string',
		nullable: true,
		example: 'Set lighting mode to Work',
	})
	@Expose({ name: 'action_description' })
	actionDescription: string | null;

	@ApiPropertyOptional({
		name: 'intent_category',
		description: 'Category of the intent that can be undone (lighting, climate, or covers)',
		type: 'string',
		enum: ['lighting', 'climate', 'covers'],
		nullable: true,
		example: 'lighting',
	})
	@Expose({ name: 'intent_category' })
	intentCategory: 'lighting' | 'climate' | 'covers' | null;

	@ApiPropertyOptional({
		name: 'captured_at',
		description: 'When the undo snapshot was captured',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2025-01-25T12:00:00Z',
	})
	@Expose({ name: 'captured_at' })
	capturedAt: Date | null;

	@ApiPropertyOptional({
		name: 'expires_in_seconds',
		description: 'Seconds until this undo entry expires (null if no undo available)',
		type: 'integer',
		nullable: true,
		example: 240,
	})
	@Expose({ name: 'expires_in_seconds' })
	expiresInSeconds: number | null;
}

/**
 * Response wrapper for undo state
 */
@ApiSchema({ name: 'SpacesModuleResUndoState' })
export class UndoStateResponseModel extends BaseSuccessResponseModel<UndoStateDataModel> {
	@ApiProperty({
		description: 'The undo state for the space',
		type: () => UndoStateDataModel,
	})
	@Expose()
	@Type(() => UndoStateDataModel)
	declare data: UndoStateDataModel;
}

/**
 * Undo result data model - result of an undo operation
 */
@ApiSchema({ name: 'SpacesModuleDataUndoResult' })
export class UndoResultDataModel {
	@ApiProperty({
		description: 'Whether the undo operation was successful',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiProperty({
		name: 'restored_devices',
		description: 'Number of devices that were restored to their previous state',
		type: 'integer',
		example: 3,
	})
	@Expose({ name: 'restored_devices' })
	restoredDevices: number;

	@ApiProperty({
		name: 'failed_devices',
		description: 'Number of devices that failed to restore',
		type: 'integer',
		example: 0,
	})
	@Expose({ name: 'failed_devices' })
	failedDevices: number;

	@ApiProperty({
		description: 'Human-readable message about the undo result',
		type: 'string',
		example: 'Restored 3 device(s)',
	})
	@Expose()
	message: string;
}

/**
 * Response wrapper for undo result
 */
@ApiSchema({ name: 'SpacesModuleResUndoResult' })
export class UndoResultResponseModel extends BaseSuccessResponseModel<UndoResultDataModel> {
	@ApiProperty({
		description: 'The result of the undo operation',
		type: () => UndoResultDataModel,
	})
	@Expose()
	@Type(() => UndoResultDataModel)
	declare data: UndoResultDataModel;
}

// ================================
// Lighting State Models
// ================================

/**
 * Last intent values for a role - what was last set via mode/intent
 */
@ApiSchema({ name: 'SpacesModuleDataRoleLastIntent' })
export class RoleLastIntentDataModel {
	@ApiPropertyOptional({
		description: 'Last brightness value set via intent (0-100), null if role was set to OFF or no intent',
		type: 'number',
		nullable: true,
		example: 100,
	})
	@Expose()
	brightness: number | null;
}

/**
 * Aggregated state for a single lighting role.
 * Current values are shown only when uniform across all devices in the role.
 * When devices have different values, current value is null and the corresponding isMixed flag is true.
 */
@ApiSchema({ name: 'SpacesModuleDataRoleAggregatedState' })
export class RoleAggregatedStateDataModel {
	@ApiProperty({
		description: 'The lighting role',
		enum: LightingRole,
		example: LightingRole.MAIN,
	})
	@Expose()
	role: LightingRole;

	@ApiProperty({
		name: 'is_on',
		description: 'Whether any light in this role is on',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'is_on' })
	isOn: boolean;

	@ApiProperty({
		name: 'is_on_mixed',
		description: 'Whether lights in this role have different on/off states',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'is_on_mixed' })
	isOnMixed: boolean;

	@ApiPropertyOptional({
		description: 'Uniform brightness of lights in this role (0-100), null if devices have different values (mixed)',
		type: 'number',
		nullable: true,
		example: 85,
	})
	@Expose()
	brightness: number | null;

	@ApiPropertyOptional({
		name: 'color_temperature',
		description: 'Uniform color temperature in Kelvin, null if devices have different values (mixed)',
		type: 'number',
		nullable: true,
		example: 4000,
	})
	@Expose({ name: 'color_temperature' })
	colorTemperature: number | null;

	@ApiPropertyOptional({
		description: 'Uniform color as hex string (e.g. "#ff6b35"), null if devices have different values (mixed)',
		type: 'string',
		nullable: true,
		example: '#ffffff',
	})
	@Expose()
	color: string | null;

	@ApiPropertyOptional({
		description: 'Uniform white level (0-100), null if devices have different values (mixed)',
		type: 'number',
		nullable: true,
		example: null,
	})
	@Expose()
	white: number | null;

	@ApiProperty({
		name: 'is_brightness_mixed',
		description: 'Whether lights in this role have different brightness values',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'is_brightness_mixed' })
	isBrightnessMixed: boolean;

	@ApiProperty({
		name: 'is_color_temperature_mixed',
		description: 'Whether lights in this role have different color temperature values',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'is_color_temperature_mixed' })
	isColorTemperatureMixed: boolean;

	@ApiProperty({
		name: 'is_color_mixed',
		description: 'Whether lights in this role have different color values',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'is_color_mixed' })
	isColorMixed: boolean;

	@ApiProperty({
		name: 'is_white_mixed',
		description: 'Whether lights in this role have different white level values',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'is_white_mixed' })
	isWhiteMixed: boolean;

	@ApiPropertyOptional({
		name: 'last_intent',
		description: 'Last values set via mode/intent for this role, null if no mode was applied',
		type: () => RoleLastIntentDataModel,
		nullable: true,
	})
	@Expose({ name: 'last_intent' })
	@Type(() => RoleLastIntentDataModel)
	lastIntent: RoleLastIntentDataModel | null;

	@ApiProperty({
		name: 'devices_count',
		description: 'Total number of lights assigned to this role',
		type: 'integer',
		example: 2,
	})
	@Expose({ name: 'devices_count' })
	devicesCount: number;

	@ApiProperty({
		name: 'devices_on',
		description: 'Number of lights currently on in this role',
		type: 'integer',
		example: 2,
	})
	@Expose({ name: 'devices_on' })
	devicesOn: number;
}

/**
 * Aggregated state for lights without role ("other" lights).
 * Current values are shown only when uniform across all devices.
 * When devices have different values, current value is null and the corresponding isMixed flag is true.
 */
@ApiSchema({ name: 'SpacesModuleDataOtherLightsState' })
export class OtherLightsStateDataModel {
	@ApiProperty({
		name: 'is_on',
		description: 'Whether any light without role is on',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'is_on' })
	isOn: boolean;

	@ApiProperty({
		name: 'is_on_mixed',
		description: 'Whether lights without role have different on/off states',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'is_on_mixed' })
	isOnMixed: boolean;

	@ApiPropertyOptional({
		description: 'Uniform brightness of lights without role (0-100), null if devices have different values (mixed)',
		type: 'number',
		nullable: true,
		example: null,
	})
	@Expose()
	brightness: number | null;

	@ApiPropertyOptional({
		name: 'color_temperature',
		description: 'Uniform color temperature in Kelvin, null if devices have different values (mixed)',
		type: 'number',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'color_temperature' })
	colorTemperature: number | null;

	@ApiPropertyOptional({
		description: 'Uniform color as hex string (e.g. "#ff6b35"), null if devices have different values (mixed)',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose()
	color: string | null;

	@ApiPropertyOptional({
		description: 'Uniform white level (0-100), null if devices have different values (mixed)',
		type: 'number',
		nullable: true,
		example: null,
	})
	@Expose()
	white: number | null;

	@ApiProperty({
		name: 'is_brightness_mixed',
		description: 'Whether lights without role have different brightness values',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'is_brightness_mixed' })
	isBrightnessMixed: boolean;

	@ApiProperty({
		name: 'is_color_temperature_mixed',
		description: 'Whether lights without role have different color temperature values',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'is_color_temperature_mixed' })
	isColorTemperatureMixed: boolean;

	@ApiProperty({
		name: 'is_color_mixed',
		description: 'Whether lights without role have different color values',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'is_color_mixed' })
	isColorMixed: boolean;

	@ApiProperty({
		name: 'is_white_mixed',
		description: 'Whether lights without role have different white level values',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'is_white_mixed' })
	isWhiteMixed: boolean;

	@ApiProperty({
		name: 'devices_count',
		description: 'Total number of lights without role',
		type: 'integer',
		example: 3,
	})
	@Expose({ name: 'devices_count' })
	devicesCount: number;

	@ApiProperty({
		name: 'devices_on',
		description: 'Number of lights without role currently on',
		type: 'integer',
		example: 0,
	})
	@Expose({ name: 'devices_on' })
	devicesOn: number;
}

/**
 * Per-role state map
 */
@ApiSchema({ name: 'SpacesModuleDataRolesStateMap' })
export class RolesStateMapDataModel {
	@ApiPropertyOptional({
		description: 'State of MAIN role lights',
		type: () => RoleAggregatedStateDataModel,
		nullable: true,
	})
	@Expose()
	@Type(() => RoleAggregatedStateDataModel)
	main?: RoleAggregatedStateDataModel;

	@ApiPropertyOptional({
		description: 'State of TASK role lights',
		type: () => RoleAggregatedStateDataModel,
		nullable: true,
	})
	@Expose()
	@Type(() => RoleAggregatedStateDataModel)
	task?: RoleAggregatedStateDataModel;

	@ApiPropertyOptional({
		description: 'State of AMBIENT role lights',
		type: () => RoleAggregatedStateDataModel,
		nullable: true,
	})
	@Expose()
	@Type(() => RoleAggregatedStateDataModel)
	ambient?: RoleAggregatedStateDataModel;

	@ApiPropertyOptional({
		description: 'State of ACCENT role lights',
		type: () => RoleAggregatedStateDataModel,
		nullable: true,
	})
	@Expose()
	@Type(() => RoleAggregatedStateDataModel)
	accent?: RoleAggregatedStateDataModel;

	@ApiPropertyOptional({
		description: 'State of NIGHT role lights',
		type: () => RoleAggregatedStateDataModel,
		nullable: true,
	})
	@Expose()
	@Type(() => RoleAggregatedStateDataModel)
	night?: RoleAggregatedStateDataModel;

	@ApiPropertyOptional({
		description: 'State of OTHER role lights',
		type: () => RoleAggregatedStateDataModel,
		nullable: true,
	})
	@Expose()
	@Type(() => RoleAggregatedStateDataModel)
	other?: RoleAggregatedStateDataModel;
}

/**
 * Complete lighting state for a space
 */
@ApiSchema({ name: 'SpacesModuleDataLightingState' })
export class LightingStateDataModel {
	@ApiPropertyOptional({
		name: 'detected_mode',
		description: 'The lighting mode detected from current device states, null if no mode matches',
		enum: LightingMode,
		nullable: true,
		example: LightingMode.WORK,
	})
	@Expose({ name: 'detected_mode' })
	detectedMode: LightingMode | null;

	@ApiProperty({
		name: 'mode_confidence',
		description: 'Confidence level of mode detection: exact (100% match), approximate (70-99% match), none (no match)',
		enum: ['exact', 'approximate', 'none'],
		example: 'exact',
	})
	@Expose({ name: 'mode_confidence' })
	modeConfidence: 'exact' | 'approximate' | 'none';

	@ApiPropertyOptional({
		name: 'mode_match_percentage',
		description: 'Percentage of role rules that match the detected mode (0-100), null if no mode detected',
		type: 'number',
		nullable: true,
		example: 100,
	})
	@Expose({ name: 'mode_match_percentage' })
	modeMatchPercentage: number | null;

	@ApiPropertyOptional({
		name: 'last_applied_mode',
		description: 'The last lighting mode that was explicitly applied via intent (from storage)',
		enum: LightingMode,
		nullable: true,
	})
	@Expose({ name: 'last_applied_mode' })
	lastAppliedMode: LightingMode | null;

	@ApiPropertyOptional({
		name: 'last_applied_at',
		description: 'When the last mode was applied',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'last_applied_at' })
	lastAppliedAt: Date | null;

	@ApiProperty({
		name: 'total_lights',
		description: 'Total number of controllable lights in the space',
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
		description: 'Average brightness of all ON lights (0-100), null if no lights are on or no brightness data',
		type: 'number',
		nullable: true,
		example: 85,
	})
	@Expose({ name: 'average_brightness' })
	averageBrightness: number | null;

	@ApiProperty({
		description: 'Aggregated state per lighting role',
		type: () => RolesStateMapDataModel,
	})
	@Expose()
	@Type(() => RolesStateMapDataModel)
	roles: RolesStateMapDataModel;

	@ApiProperty({
		description: 'Aggregated state for lights without role assignment',
		type: () => OtherLightsStateDataModel,
	})
	@Expose()
	@Type(() => OtherLightsStateDataModel)
	other: OtherLightsStateDataModel;
}

/**
 * Response wrapper for lighting state
 */
@ApiSchema({ name: 'SpacesModuleResLightingState' })
export class LightingStateResponseModel extends BaseSuccessResponseModel<LightingStateDataModel> {
	@ApiProperty({
		description: 'The aggregated lighting state for the space',
		type: () => LightingStateDataModel,
	})
	@Expose()
	@Type(() => LightingStateDataModel)
	declare data: LightingStateDataModel;
}

// ================================
// Sensor State & Role Response Models
// ================================

/**
 * Individual sensor reading data model
 */
@ApiSchema({ name: 'SpacesModuleDataSensorReading' })
export class SensorReadingDataModel {
	@ApiProperty({
		name: 'device_id',
		description: 'ID of the sensor device',
		type: 'string',
		format: 'uuid',
		example: 'a2b19ca3-521e-4d7b-b3fe-bcb7a8d5b9e7',
	})
	@Expose({ name: 'device_id' })
	deviceId: string;

	@ApiProperty({
		name: 'device_name',
		description: 'Name of the sensor device',
		type: 'string',
		example: 'Living Room Sensor',
	})
	@Expose({ name: 'device_name' })
	deviceName: string;

	@ApiProperty({
		name: 'channel_id',
		description: 'ID of the sensor channel',
		type: 'string',
		format: 'uuid',
		example: 'c3d29eb4-632f-5e8c-c4af-ded8b9e6c0f8',
	})
	@Expose({ name: 'channel_id' })
	channelId: string;

	@ApiProperty({
		name: 'channel_name',
		description: 'Name of the sensor channel',
		type: 'string',
		example: 'Temperature',
	})
	@Expose({ name: 'channel_name' })
	channelName: string;

	@ApiProperty({
		name: 'channel_category',
		description: 'Category of the sensor channel',
		enum: ChannelCategory,
		example: 'temperature',
	})
	@Expose({ name: 'channel_category' })
	channelCategory: ChannelCategory;

	@ApiPropertyOptional({
		description: 'Current sensor value (type depends on sensor)',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		nullable: true,
		example: 22.5,
	})
	@Expose()
	value: number | boolean | string | null;

	@ApiPropertyOptional({
		description: 'Unit of the sensor value',
		type: 'string',
		nullable: true,
		example: '°C',
	})
	@Expose()
	unit: string | null;

	@ApiPropertyOptional({
		description: 'The sensor role for this channel',
		enum: SensorRole,
		nullable: true,
		example: SensorRole.ENVIRONMENT,
	})
	@Expose()
	role: SensorRole | null;
}

/**
 * Aggregated sensor readings by role
 */
@ApiSchema({ name: 'SpacesModuleDataSensorRoleReadings' })
export class SensorRoleReadingsDataModel {
	@ApiProperty({
		description: 'The sensor role',
		enum: SensorRole,
		example: SensorRole.ENVIRONMENT,
	})
	@Expose()
	role: SensorRole;

	@ApiProperty({
		name: 'sensors_count',
		description: 'Number of sensors with this role',
		type: 'integer',
		example: 3,
	})
	@Expose({ name: 'sensors_count' })
	sensorsCount: number;

	@ApiProperty({
		description: 'Sensor readings for this role',
		type: () => [SensorReadingDataModel],
	})
	@Expose()
	@Type(() => SensorReadingDataModel)
	readings: SensorReadingDataModel[];
}

/**
 * Environment summary data (aggregated environmental readings)
 */
@ApiSchema({ name: 'SpacesModuleDataEnvironmentSummary' })
export class EnvironmentSummaryDataModel {
	@ApiPropertyOptional({
		name: 'average_temperature',
		description: 'Average temperature from all environment sensors (°C)',
		type: 'number',
		nullable: true,
		example: 22.5,
	})
	@Expose({ name: 'average_temperature' })
	averageTemperature: number | null;

	@ApiPropertyOptional({
		name: 'average_humidity',
		description: 'Average humidity from all environment sensors (%)',
		type: 'number',
		nullable: true,
		example: 45,
	})
	@Expose({ name: 'average_humidity' })
	averageHumidity: number | null;

	@ApiPropertyOptional({
		name: 'average_pressure',
		description: 'Average atmospheric pressure (hPa)',
		type: 'number',
		nullable: true,
		example: 1013.25,
	})
	@Expose({ name: 'average_pressure' })
	averagePressure: number | null;

	@ApiPropertyOptional({
		name: 'average_illuminance',
		description: 'Average light level (lux)',
		type: 'number',
		nullable: true,
		example: 500,
	})
	@Expose({ name: 'average_illuminance' })
	averageIlluminance: number | null;
}

/**
 * Safety alert info
 */
@ApiSchema({ name: 'SpacesModuleDataSafetyAlert' })
export class SafetyAlertDataModel {
	@ApiProperty({
		name: 'channel_category',
		description: 'Type of safety sensor that triggered the alert',
		enum: ChannelCategory,
		example: 'smoke',
	})
	@Expose({ name: 'channel_category' })
	channelCategory: ChannelCategory;

	@ApiProperty({
		name: 'device_id',
		description: 'ID of the device with the alert',
		type: 'string',
		format: 'uuid',
		example: 'a2b19ca3-521e-4d7b-b3fe-bcb7a8d5b9e7',
	})
	@Expose({ name: 'device_id' })
	deviceId: string;

	@ApiProperty({
		name: 'device_name',
		description: 'Name of the device with the alert',
		type: 'string',
		example: 'Kitchen Smoke Detector',
	})
	@Expose({ name: 'device_name' })
	deviceName: string;

	@ApiProperty({
		name: 'channel_id',
		description: 'ID of the sensor channel',
		type: 'string',
		format: 'uuid',
		example: 'c3d29eb4-632f-5e8c-c4af-ded8b9e6c0f8',
	})
	@Expose({ name: 'channel_id' })
	channelId: string;

	@ApiProperty({
		description: 'Whether the sensor is currently triggered',
		type: 'boolean',
		example: true,
	})
	@Expose()
	triggered: boolean;
}

/**
 * Sensor state data model (aggregated sensor state for a space)
 */
@ApiSchema({ name: 'SpacesModuleDataSensorState' })
export class SensorStateDataModel {
	@ApiProperty({
		name: 'has_sensors',
		description: 'Whether the space has any sensor devices',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'has_sensors' })
	hasSensors: boolean;

	@ApiProperty({
		name: 'total_sensors',
		description: 'Total number of sensor channels in the space',
		type: 'integer',
		example: 5,
	})
	@Expose({ name: 'total_sensors' })
	totalSensors: number;

	@ApiProperty({
		name: 'sensors_by_role',
		description: 'Count of sensors grouped by role',
		type: 'object',
		additionalProperties: { type: 'integer' },
		example: { environment: 3, safety: 1, security: 1 },
	})
	@Expose({ name: 'sensors_by_role' })
	sensorsByRole: Record<string, number>;

	@ApiPropertyOptional({
		description: 'Aggregated environmental readings summary',
		type: () => EnvironmentSummaryDataModel,
		nullable: true,
	})
	@Expose()
	@Type(() => EnvironmentSummaryDataModel)
	environment: EnvironmentSummaryDataModel | null;

	@ApiProperty({
		name: 'safety_alerts',
		description: 'List of active safety alerts',
		type: () => [SafetyAlertDataModel],
	})
	@Expose({ name: 'safety_alerts' })
	@Type(() => SafetyAlertDataModel)
	safetyAlerts: SafetyAlertDataModel[];

	@ApiProperty({
		name: 'has_safety_alert',
		description: 'Whether any safety sensor is currently triggered',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'has_safety_alert' })
	hasSafetyAlert: boolean;

	@ApiProperty({
		name: 'motion_detected',
		description: 'Whether any motion sensor is currently detecting motion',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'motion_detected' })
	motionDetected: boolean;

	@ApiProperty({
		name: 'occupancy_detected',
		description: 'Whether any occupancy sensor is currently detecting presence',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'occupancy_detected' })
	occupancyDetected: boolean;

	@ApiProperty({
		description: 'Sensor readings grouped by role',
		type: () => [SensorRoleReadingsDataModel],
	})
	@Expose()
	@Type(() => SensorRoleReadingsDataModel)
	readings: SensorRoleReadingsDataModel[];
}

/**
 * Response wrapper for sensor state
 */
@ApiSchema({ name: 'SpacesModuleResSensorState' })
export class SensorStateResponseModel extends BaseSuccessResponseModel<SensorStateDataModel> {
	@ApiProperty({
		description: 'The sensor state data',
		type: () => SensorStateDataModel,
	})
	@Expose()
	@Type(() => SensorStateDataModel)
	declare data: SensorStateDataModel;
}

// ================================
// Sensor Target Response Models
// ================================

/**
 * Sensor target data model (a sensor device/channel in a space)
 */
@ApiSchema({ name: 'SpacesModuleDataSensorTarget' })
export class SensorTargetDataModel {
	@ApiProperty({
		name: 'device_id',
		description: 'ID of the sensor device',
		type: 'string',
		format: 'uuid',
		example: 'a2b19ca3-521e-4d7b-b3fe-bcb7a8d5b9e7',
	})
	@Expose({ name: 'device_id' })
	deviceId: string;

	@ApiProperty({
		name: 'device_name',
		description: 'Name of the device',
		type: 'string',
		example: 'Living Room Sensor',
	})
	@Expose({ name: 'device_name' })
	deviceName: string;

	@ApiProperty({
		name: 'device_category',
		description: 'Category of the device',
		enum: DeviceCategory,
		example: 'sensor',
	})
	@Expose({ name: 'device_category' })
	deviceCategory: DeviceCategory;

	@ApiProperty({
		name: 'channel_id',
		description: 'ID of the sensor channel',
		type: 'string',
		format: 'uuid',
		example: 'c3d29eb4-632f-5e8c-c4af-ded8b9e6c0f8',
	})
	@Expose({ name: 'channel_id' })
	channelId: string;

	@ApiProperty({
		name: 'channel_name',
		description: 'Name of the channel',
		type: 'string',
		example: 'Temperature',
	})
	@Expose({ name: 'channel_name' })
	channelName: string;

	@ApiProperty({
		name: 'channel_category',
		description: 'Category of the sensor channel',
		enum: ChannelCategory,
		example: 'temperature',
	})
	@Expose({ name: 'channel_category' })
	channelCategory: ChannelCategory;

	@ApiPropertyOptional({
		description: 'The assigned sensor role (null if not assigned)',
		enum: SensorRole,
		nullable: true,
		example: SensorRole.ENVIRONMENT,
	})
	@Expose()
	role: SensorRole | null;

	@ApiProperty({
		description: 'Priority for role ordering (lower = higher priority)',
		type: 'integer',
		example: 0,
	})
	@Expose()
	priority: number;
}

/**
 * Response wrapper for sensor targets in a space
 */
@ApiSchema({ name: 'SpacesModuleResSensorTargets' })
export class SensorTargetsResponseModel extends BaseSuccessResponseModel<SensorTargetDataModel[]> {
	@ApiProperty({
		description: 'Array of sensor targets in the space with their role assignments',
		type: () => [SensorTargetDataModel],
	})
	@Expose()
	@Type(() => SensorTargetDataModel)
	declare data: SensorTargetDataModel[];
}

/**
 * Response wrapper for a single sensor role entity
 */
@ApiSchema({ name: 'SpacesModuleResSensorRole' })
export class SensorRoleResponseModel extends BaseSuccessResponseModel<SpaceSensorRoleEntity | null> {
	@ApiProperty({
		description: 'The sensor role assignment, or null if the role was removed',
		type: () => SpaceSensorRoleEntity,
		nullable: true,
		required: false,
	})
	@Expose()
	@Type(() => SpaceSensorRoleEntity)
	declare data: SpaceSensorRoleEntity | null;
}

/**
 * Bulk sensor role update result item
 */
@ApiSchema({ name: 'SpacesModuleDataBulkSensorRoleResultItem' })
export class BulkSensorRoleResultItemModel {
	@ApiProperty({
		name: 'device_id',
		description: 'ID of the sensor device',
		type: 'string',
		format: 'uuid',
		example: 'a2b19ca3-521e-4d7b-b3fe-bcb7a8d5b9e7',
	})
	@Expose({ name: 'device_id' })
	deviceId: string;

	@ApiProperty({
		name: 'channel_id',
		description: 'ID of the sensor channel',
		type: 'string',
		format: 'uuid',
		example: 'c3d29eb4-632f-5e8c-c4af-ded8b9e6c0f8',
	})
	@Expose({ name: 'channel_id' })
	channelId: string;

	@ApiProperty({
		description: 'Whether the role was set successfully',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiPropertyOptional({
		description: 'The role that was set (null if failed)',
		enum: SensorRole,
		nullable: true,
		example: SensorRole.ENVIRONMENT,
	})
	@Expose()
	role: SensorRole | null;

	@ApiPropertyOptional({
		description: 'Error message if the role assignment failed',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose()
	error: string | null;
}

/**
 * Bulk sensor role update result data
 */
@ApiSchema({ name: 'SpacesModuleDataBulkSensorRolesResult' })
export class BulkSensorRolesResultDataModel {
	@ApiProperty({
		description: 'Whether all role assignments succeeded',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiProperty({
		name: 'total_count',
		description: 'Total number of role assignments attempted',
		type: 'integer',
		example: 3,
	})
	@Expose({ name: 'total_count' })
	totalCount: number;

	@ApiProperty({
		name: 'success_count',
		description: 'Number of successful role assignments',
		type: 'integer',
		example: 3,
	})
	@Expose({ name: 'success_count' })
	successCount: number;

	@ApiProperty({
		name: 'failure_count',
		description: 'Number of failed role assignments',
		type: 'integer',
		example: 0,
	})
	@Expose({ name: 'failure_count' })
	failureCount: number;

	@ApiProperty({
		description: 'Detailed results for each role assignment',
		type: () => [BulkSensorRoleResultItemModel],
	})
	@Expose()
	@Type(() => BulkSensorRoleResultItemModel)
	results: BulkSensorRoleResultItemModel[];
}

/**
 * Response wrapper for bulk sensor role update result
 */
@ApiSchema({ name: 'SpacesModuleResBulkSensorRoles' })
export class BulkSensorRolesResponseModel extends BaseSuccessResponseModel<BulkSensorRolesResultDataModel> {
	@ApiProperty({
		description: 'The result of the bulk sensor role update',
		type: () => BulkSensorRolesResultDataModel,
	})
	@Expose()
	@Type(() => BulkSensorRolesResultDataModel)
	declare data: BulkSensorRolesResultDataModel;
}
