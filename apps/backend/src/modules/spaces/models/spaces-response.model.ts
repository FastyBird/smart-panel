import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { SpaceEntity } from '../entities/space.entity';

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
