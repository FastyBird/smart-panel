import { Expose, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsBoolean,
	IsISO8601,
	IsIn,
	IsInt,
	IsNumber,
	IsOptional,
	IsUUID,
	Matches,
	Min,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, PickType, getSchemaPath } from '@nestjs/swagger';

import { ThermostatPreset } from '../services/virtual-thermostat-comfort.utils';

@ApiSchema({ name: 'DevicesVirtualPluginThermostatComfortFence' })
export class ThermostatComfortFenceDto {
	@ApiProperty({ description: 'Expected current thermostat configuration revision', minimum: 1 })
	@Expose()
	@IsInt()
	@Min(1)
	expected_revision: number;

	@ApiProperty({ description: 'Expected current dependency graph revision', minimum: 0 })
	@Expose()
	@IsInt()
	@Min(0)
	expected_graph_revision: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginThermostatComfortRange' })
export class ThermostatComfortRangeDto {
	@ApiProperty({ description: 'Explicit operator minimum setpoint in Celsius' })
	@Expose()
	@IsNumber()
	minimum: number;

	@ApiProperty({ description: 'Explicit operator maximum setpoint in Celsius' })
	@Expose()
	@IsNumber()
	maximum: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginThermostatComfortSetpoints' })
export class ThermostatComfortSetpointsDto {
	@ApiProperty({
		description: 'Heating setpoint in Celsius; null for an unsupported branch',
		type: Number,
		nullable: true,
	})
	@Expose()
	@ValidateIf((_object, value) => value !== null)
	@IsNumber()
	heating_setpoint: number | null;

	@ApiProperty({
		description: 'Cooling setpoint in Celsius; null for an unsupported branch',
		type: Number,
		nullable: true,
	})
	@Expose()
	@ValidateIf((_object, value) => value !== null)
	@IsNumber()
	cooling_setpoint: number | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginThermostatComfortPreset' })
export class ThermostatComfortPresetDto {
	@ApiProperty({
		description: 'Controller preset, distinct from HVAC mode or space activity',
		enumName: 'DevicesVirtualPluginThermostatPreset',
		enum: ['comfort', 'eco', 'away'],
	})
	@Expose()
	@IsIn(['comfort', 'eco', 'away'])
	preset: ThermostatPreset;

	@ApiProperty({ description: 'Explicit branch setpoints', type: ThermostatComfortSetpointsDto })
	@Expose()
	@ValidateNested()
	@Type(() => ThermostatComfortSetpointsDto)
	setpoints: ThermostatComfortSetpointsDto;
}

@ApiSchema({ name: 'DevicesVirtualPluginConfigureThermostatComfort' })
export class ConfigureThermostatComfortDto extends ThermostatComfortFenceDto {
	@ApiPropertyOptional({
		description:
			'Explicit operator opt-in for a future trusted automation bridge; omitted preserves the current setting and new controllers default disabled',
		type: Boolean,
	})
	@Expose()
	@IsOptional()
	@IsBoolean()
	automation_enabled?: boolean;

	@ApiProperty({
		description: 'Explicit heating setpoint range; null without a heating branch',
		type: ThermostatComfortRangeDto,
		nullable: true,
	})
	@Expose()
	@ValidateIf((_object, value) => value !== null)
	@ValidateNested()
	@Type(() => ThermostatComfortRangeDto)
	heating_range: ThermostatComfortRangeDto | null;

	@ApiProperty({
		description: 'Explicit cooling setpoint range; null without a cooling branch',
		type: ThermostatComfortRangeDto,
		nullable: true,
	})
	@Expose()
	@ValidateIf((_object, value) => value !== null)
	@ValidateNested()
	@Type(() => ThermostatComfortRangeDto)
	cooling_range: ThermostatComfortRangeDto | null;

	@ApiProperty({
		description: 'Only operator-defined presets; no default temperatures',
		type: [ThermostatComfortPresetDto],
		maxItems: 3,
	})
	@Expose()
	@IsArray()
	@ArrayMaxSize(3)
	@ValidateNested({ each: true })
	@Type(() => ThermostatComfortPresetDto)
	presets: ThermostatComfortPresetDto[];
}

@ApiSchema({ name: 'DevicesVirtualPluginSelectThermostatPreset' })
export class SelectThermostatPresetDto extends ThermostatComfortFenceDto {
	@ApiProperty({
		description: 'Baseline preset, or null for current manual baseline',
		type: String,
		allOf: [{ $ref: getSchemaPath('DevicesVirtualPluginThermostatPreset') }],
		nullable: true,
	})
	@Expose()
	@ValidateIf((_object, value) => value !== null)
	@IsIn(['comfort', 'eco', 'away'])
	preset: ThermostatPreset | null;

	@ApiProperty({
		description: 'Explicit user action clearing a previously latched OFF; requested HVAC mode remains separate',
	})
	@Expose()
	@IsBoolean()
	clear_user_off: boolean;
}

@ApiSchema({ name: 'DevicesVirtualPluginCreateThermostatOverride' })
export class CreateThermostatOverrideDto extends ThermostatComfortFenceDto {
	@ApiProperty({
		description: 'Preset to resolve at creation, mutually exclusive with explicit setpoints',
		type: String,
		allOf: [{ $ref: getSchemaPath('DevicesVirtualPluginThermostatPreset') }],
		nullable: true,
	})
	@Expose()
	@ValidateIf((_object, value) => value !== null)
	@IsIn(['comfort', 'eco', 'away'])
	preset: ThermostatPreset | null;

	@ApiProperty({
		description: 'Explicit setpoints, mutually exclusive with preset',
		type: ThermostatComfortSetpointsDto,
		nullable: true,
	})
	@Expose()
	@ValidateIf((_object, value) => value !== null)
	@ValidateNested()
	@Type(() => ThermostatComfortSetpointsDto)
	setpoints: ThermostatComfortSetpointsDto | null;

	@ApiProperty({ description: 'Absolute ISO 8601 expiry within seven days; exact expiry is terminal' })
	@Expose()
	@IsISO8601({ strict: true })
	@Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
	expires_at: string;
}

@ApiSchema({ name: 'DevicesVirtualPluginCancelThermostatOverride' })
export class CancelThermostatOverrideDto extends ThermostatComfortFenceDto {
	@ApiProperty({ description: 'Identity of the active override being cancelled', format: 'uuid' })
	@Expose()
	@IsUUID('4')
	override_id: string;
}

@ApiSchema({ name: 'DevicesVirtualPluginThermostatComfortDefinition' })
export class ThermostatComfortDefinitionDto extends PickType(ConfigureThermostatComfortDto, [
	'heating_range',
	'cooling_range',
	'presets',
	'automation_enabled',
] as const) {}
