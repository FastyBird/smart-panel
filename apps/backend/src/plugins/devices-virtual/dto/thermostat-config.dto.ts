import { Expose, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsIn,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { ThermostatActuatorRole, ThermostatSetting, ThermostatSourceRole } from '../entities/virtual-thermostat.entity';
import { VirtualThermostatMode } from '../services/virtual-thermostat-policy.utils';

import { ThermostatComfortDefinitionDto } from './thermostat-comfort.dto';

@ApiSchema({ name: 'DevicesVirtualPluginThermostatFloorGuard' })
export class VirtualThermostatFloorGuardDto {
	@ApiProperty({ description: 'Floor temperature heating release threshold in Celsius' })
	@Expose()
	@IsNumber()
	limit: number;

	@ApiProperty({ description: 'Strict recovery below limit minus this positive hysteresis' })
	@Expose()
	@IsNumber()
	@Min(Number.EPSILON)
	recoveryHysteresis: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginThermostatPolicy' })
export class VirtualThermostatPolicyDto {
	@ApiProperty({
		description: 'Heating comfort setpoint in Celsius; null means no heating branch',
		type: Number,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsNumber()
	heatingSetpoint: number | null;

	@ApiProperty({
		description: 'Cooling comfort setpoint in Celsius; null means no cooling branch',
		type: Number,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsNumber()
	coolingSetpoint: number | null;

	@ApiProperty({ description: 'Nonnegative lower threshold tolerance' })
	@Expose()
	@IsNumber()
	@Min(0)
	coldTolerance: number;

	@ApiProperty({ description: 'Nonnegative upper threshold tolerance' })
	@Expose()
	@IsNumber()
	@Min(0)
	hotTolerance: number;

	@ApiProperty({ description: 'Positive neutral heat/cool margin' })
	@Expose()
	@IsNumber()
	@Min(Number.EPSILON)
	neutralMargin: number;

	@ApiProperty({
		description: 'Minimum branch OFF interval; never delays protective release',
		minimum: 0,
		maximum: 86400000,
	})
	@Expose()
	@IsInt()
	@Min(0)
	@Max(86400000)
	minimumOffMs: number;

	@ApiProperty({
		description: 'Opposed output changeover interval; never delays release',
		minimum: 0,
		maximum: 86400000,
	})
	@Expose()
	@IsInt()
	@Min(0)
	@Max(86400000)
	changeoverMs: number;

	@ApiPropertyOptional({
		description: 'Optional independent heating-only floor protection',
		allOf: [{ $ref: getSchemaPath(VirtualThermostatFloorGuardDto) }],
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => VirtualThermostatFloorGuardDto)
	floor: VirtualThermostatFloorGuardDto | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginWindowTrendPolicy' })
export class VirtualWindowTrendPolicyDto {
	@ApiProperty({ description: 'Bounded slope sampling window', minimum: 1, maximum: 86400000 })
	@Expose()
	@IsInt()
	@Min(1)
	@Max(86400000)
	sampleWindowMs: number;

	@ApiProperty({ description: 'Minimum qualified samples for inference', minimum: 3, maximum: 2048 })
	@Expose()
	@IsInt()
	@Min(3)
	@Max(2048)
	minimumSamples: number;

	@ApiProperty({ description: 'Minimum sample time span', minimum: 1, maximum: 86400000 })
	@Expose()
	@IsInt()
	@Min(1)
	@Max(86400000)
	minimumSpanMs: number;

	@ApiProperty({ description: 'Maximum original sample age', minimum: 1, maximum: 86400000 })
	@Expose()
	@IsInt()
	@Min(1)
	@Max(86400000)
	maximumSampleAgeMs: number;

	@ApiProperty({ description: 'Positive trend magnitude; direction follows heating or cooling' })
	@Expose()
	@IsNumber()
	@Min(Number.EPSILON)
	slopeThresholdCPerMinute: number;

	@ApiProperty({ description: 'Sustained trend confirmation', minimum: 0, maximum: 86400000 })
	@Expose()
	@IsInt()
	@Min(0)
	@Max(86400000)
	confirmationMs: number;

	@ApiProperty({ description: 'Stable trend recovery interval', minimum: 0, maximum: 86400000 })
	@Expose()
	@IsInt()
	@Min(0)
	@Max(86400000)
	recoveryMs: number;

	@ApiProperty({
		description: 'Maximum heuristic pause; expiry only reevaluates normal safety gates',
		minimum: 1,
		maximum: 86400000,
	})
	@Expose()
	@IsInt()
	@Min(1)
	@Max(86400000)
	maximumPauseMs: number;

	@ApiProperty({ description: 'Cooldown before another heuristic pause', minimum: 0, maximum: 86400000 })
	@Expose()
	@IsInt()
	@Min(0)
	@Max(86400000)
	cooldownMs: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginThermostatSource' })
export class VirtualThermostatSourceDto {
	@ApiPropertyOptional({ description: 'Existing stable binding UUID' })
	@Expose()
	@IsOptional()
	@IsUUID('4')
	id?: string;
	@ApiProperty({ enum: ['ambient', 'floor', 'contact'], description: 'Independent measurement role' })
	@Expose()
	@IsIn(['ambient', 'floor', 'contact'])
	role: ThermostatSourceRole;
	@ApiProperty({
		name: 'source_property',
		description: 'Physical or qualified ambient aggregate property; null only retains an existing missing binding',
		nullable: true,
	})
	@Expose({ name: 'source_property' })
	@IsOptional()
	@IsUUID('4')
	sourcePropertyId: string | null;
	@ApiProperty({
		name: 'maximum_age_seconds',
		description: 'Maximum original measurement age',
		minimum: 1,
		maximum: 86400,
	})
	@Expose({ name: 'maximum_age_seconds' })
	@IsInt()
	@Min(1)
	@Max(86400)
	maximumAgeSeconds: number;
	@ApiPropertyOptional({
		name: 'open_value',
		description: 'Explicit contact open mapping',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		nullable: true,
	})
	@Expose({ name: 'open_value' })
	@IsOptional()
	openValue?: string | number | boolean;
	@ApiPropertyOptional({
		name: 'closed_value',
		description: 'Explicit contact closed mapping',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		nullable: true,
	})
	@Expose({ name: 'closed_value' })
	@IsOptional()
	closedValue?: string | number | boolean;
}

@ApiSchema({ name: 'DevicesVirtualPluginThermostatMemberProtection' })
export class ThermostatMemberProtectionDto {
	@ApiProperty({ name: 'schema_version', enum: [1], description: 'Explicit member protection contract version' })
	@Expose({ name: 'schema_version' })
	@IsIn([1])
	schemaVersion: 1;
	@ApiProperty({
		enum: ['local_floor'],
		description: 'Device-local floor protection; no unprotected strategy is supported',
	})
	@Expose()
	@IsIn(['local_floor'])
	kind: 'local_floor';
	@ApiProperty({
		name: 'source_property',
		nullable: true,
		type: String,
		description: 'Qualified local Celsius property; null only retains an already missing binding',
	})
	@Expose({ name: 'source_property' })
	@IsOptional()
	@IsUUID('4')
	sourcePropertyId: string | null;
	@ApiProperty({
		name: 'maximum_age_seconds',
		minimum: 1,
		maximum: 86400,
		description: 'Maximum original physical sample age',
	})
	@Expose({ name: 'maximum_age_seconds' })
	@IsInt()
	@Min(1)
	@Max(86400)
	maximumAgeSeconds: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginThermostatActuator' })
export class VirtualThermostatActuatorDto {
	@ApiPropertyOptional({
		type: ThermostatMemberProtectionDto,
		description: 'Mandatory for every parallel heating member; omission preserves only an existing legacy singleton',
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ThermostatMemberProtectionDto)
	protection?: ThermostatMemberProtectionDto;

	@ApiProperty({
		enum: ['heating', 'cooling'],
		description: 'Physical branch controlled exclusively by this controller',
	})
	@Expose()
	@IsIn(['heating', 'cooling'])
	role: ThermostatActuatorRole;
	@ApiProperty({ name: 'source_property', description: 'Canonical readable and writable physical boolean switch' })
	@Expose({ name: 'source_property' })
	@IsUUID('4')
	sourcePropertyId: string;
	@ApiProperty({
		name: 'lease_seconds',
		description: 'Requested actuator-local maximum ON lease; qualification supplies permitted bounds',
		minimum: 0,
	})
	@Expose({ name: 'lease_seconds' })
	@IsNumber()
	@Min(Number.EPSILON)
	leaseSeconds: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginThermostatSetting' })
export class VirtualThermostatSettingDto {
	@ApiProperty({ name: 'property', description: 'Owned local property UUID' })
	@Expose({ name: 'property' })
	@IsUUID('4')
	propertyId: string;
	@ApiProperty({
		enum: ['heating_setpoint', 'cooling_setpoint', 'heating_enabled', 'cooling_enabled', 'locked'],
		description: 'Registered writable setting role',
	})
	@Expose()
	@IsIn(['heating_setpoint', 'cooling_setpoint', 'heating_enabled', 'cooling_enabled', 'locked'])
	setting: ThermostatSetting;
}

@ApiSchema({ name: 'DevicesVirtualPluginConfigureThermostat' })
export class ConfigureVirtualThermostatDto {
	@ApiPropertyOptional({
		name: 'display_floor_claim',
		nullable: true,
		type: String,
		description: 'Presentation-only member claim UUID; does not remove any protective input',
	})
	@Expose({ name: 'display_floor_claim' })
	@IsOptional()
	@IsUUID('4')
	displayFloorClaimId?: string | null;

	@ApiPropertyOptional({
		name: 'control_strategy',
		enum: ['guarded_branches'],
		description: 'Legacy configurations default to guarded branches; native-unit adapters are not implemented',
	})
	@Expose({ name: 'control_strategy' })
	@IsOptional()
	@IsIn(['guarded_branches'])
	controlStrategy?: 'guarded_branches';

	@ApiPropertyOptional({
		description:
			'Explicit comfort replacement for atomic branch/range reconfiguration; omitted preserves installed comfort configuration',
		type: ThermostatComfortDefinitionDto,
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ThermostatComfortDefinitionDto)
	comfort?: ThermostatComfortDefinitionDto;

	@ApiProperty({ name: 'schema_version', enum: [1], description: 'Typed configuration version' })
	@Expose({ name: 'schema_version' })
	@IsIn([1])
	schemaVersion: 1;
	@ApiProperty({ name: 'expected_revision', description: 'Configuration CAS fence; zero on creation', minimum: 0 })
	@Expose({ name: 'expected_revision' })
	@IsInt()
	@Min(0)
	expectedRevision: number;
	@ApiPropertyOptional({ name: 'expected_graph_revision', description: 'Shared structure revision fence', minimum: 0 })
	@Expose({ name: 'expected_graph_revision' })
	@IsOptional()
	@IsInt()
	@Min(0)
	expectedGraphRevision?: number;
	@ApiProperty({
		name: 'requested_mode',
		enum: ['off', 'heat', 'cool', 'auto'],
		description: 'Persisted requested mode; activation requires qualification and runtime reconciliation',
	})
	@Expose({ name: 'requested_mode' })
	@IsIn(['off', 'heat', 'cool', 'auto'])
	requestedMode: VirtualThermostatMode;
	@ApiProperty({
		description: 'Validated comfort and independent floor guard configuration',
		type: VirtualThermostatPolicyDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => VirtualThermostatPolicyDto)
	policy: VirtualThermostatPolicyDto;
	@ApiPropertyOptional({
		description: 'Optional independent ambient-trend policy; physical contacts are optional',
		allOf: [{ $ref: getSchemaPath(VirtualWindowTrendPolicyDto) }],
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => VirtualWindowTrendPolicyDto)
	heuristic?: VirtualWindowTrendPolicyDto | null;
	@ApiProperty({
		name: 'contact_opening_ms',
		description: 'Explicit contact opening debounce',
		minimum: 0,
		maximum: 86400000,
	})
	@Expose({ name: 'contact_opening_ms' })
	@IsInt()
	@Min(0)
	@Max(86400000)
	contactOpeningMs: number;
	@ApiProperty({
		name: 'contact_closing_ms',
		description: 'Explicit contact closing debounce',
		minimum: 0,
		maximum: 86400000,
	})
	@Expose({ name: 'contact_closing_ms' })
	@IsInt()
	@Min(0)
	@Max(86400000)
	contactClosingMs: number;
	@ApiProperty({ description: 'Role-aware sensor dependencies', type: [VirtualThermostatSourceDto], maxItems: 18 })
	@Expose()
	@IsArray()
	@ArrayMaxSize(18)
	@ValidateNested({ each: true })
	@Type(() => VirtualThermostatSourceDto)
	sources: VirtualThermostatSourceDto[];
	@ApiProperty({
		description: 'Mandatory physical members grouped by heating/cooling role; legacy singleton arrays retain identity',
		type: [VirtualThermostatActuatorDto],
		maxItems: 8,
	})
	@Expose()
	@IsArray()
	@ArrayMaxSize(8)
	@ValidateNested({ each: true })
	@Type(() => VirtualThermostatActuatorDto)
	actuators: VirtualThermostatActuatorDto[];
	@ApiProperty({
		description: 'Only these endpoints accept local commands',
		type: [VirtualThermostatSettingDto],
		maxItems: 5,
	})
	@Expose()
	@IsArray()
	@ArrayMaxSize(5)
	@ValidateNested({ each: true })
	@Type(() => VirtualThermostatSettingDto)
	settings: VirtualThermostatSettingDto[];
}

@ApiSchema({ name: 'DevicesVirtualPluginReleaseThermostat' })
export class RequestVirtualThermostatReleaseDto {
	@ApiProperty({ name: 'expected_revision', description: 'Current configuration CAS revision', minimum: 1 })
	@Expose({ name: 'expected_revision' })
	@IsInt()
	@Min(1)
	expectedRevision: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginRestoreThermostatActuator' })
export class RestoreVirtualThermostatActuatorDto {
	@ApiProperty({ name: 'expected_revision', description: 'Current thermostat configuration revision' })
	@Expose({ name: 'expected_revision' })
	@IsInt()
	@Min(1)
	expectedRevision: number;

	@ApiProperty({ name: 'expected_claim_revision', description: 'Current retained claim revision' })
	@Expose({ name: 'expected_claim_revision' })
	@IsInt()
	@Min(1)
	expectedClaimRevision: number;

	@ApiProperty({ name: 'physical_identity', description: 'Exact canonical identity printed by the retained claim' })
	@Expose({ name: 'physical_identity' })
	@IsString()
	@Length(1, 256)
	physicalIdentity: string;

	@ApiProperty({ name: 'source_property', description: 'Newly discovered property UUID of that same physical switch' })
	@Expose({ name: 'source_property' })
	@IsUUID('4')
	sourcePropertyId: string;

	@ApiProperty({ description: 'Operator reason retained in the audit log' })
	@Expose()
	@IsString()
	@Length(10, 1000)
	reason: string;

	@ApiProperty({
		name: 'disconnection_acknowledged',
		type: Boolean,
		example: true,
		description:
			'Must be true: operator acknowledges that the old endpoint was disconnected; this is not OFF or drainage proof',
	})
	@Expose({ name: 'disconnection_acknowledged' })
	@IsIn([true])
	disconnectionAcknowledged: true;
}
