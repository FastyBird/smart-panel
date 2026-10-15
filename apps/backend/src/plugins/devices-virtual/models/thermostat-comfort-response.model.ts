import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { ThermostatPreset } from '../services/virtual-thermostat-comfort.utils';

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatComfortRange' })
export class ThermostatComfortRangeModel {
	@ApiProperty({ description: 'Explicit minimum setpoint in Celsius' })
	@Expose()
	minimum: number;

	@ApiProperty({ description: 'Explicit maximum setpoint in Celsius' })
	@Expose()
	maximum: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatComfortSetpoints' })
export class ThermostatComfortSetpointsModel {
	@ApiProperty({ description: 'Heating setpoint in Celsius', type: Number, nullable: true })
	@Expose()
	heating_setpoint: number | null;

	@ApiProperty({ description: 'Cooling setpoint in Celsius', type: Number, nullable: true })
	@Expose()
	cooling_setpoint: number | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatComfortPreset' })
export class ThermostatComfortPresetModel {
	@ApiProperty({
		description: 'Explicit preset name',
		enumName: 'DevicesVirtualPluginThermostatPreset',
		enum: ['comfort', 'eco', 'away'],
	})
	@Expose()
	preset: ThermostatPreset;

	@ApiProperty({ description: 'Configured setpoints', type: ThermostatComfortSetpointsModel })
	@Expose()
	@Type(() => ThermostatComfortSetpointsModel)
	setpoints: ThermostatComfortSetpointsModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatEffectiveComfort' })
export class ThermostatEffectiveComfortModel extends ThermostatComfortSetpointsModel {
	@ApiProperty({
		description: 'Selected comfort source; safety guards still take precedence',
		enum: ['manual', 'preset', 'automation', 'override', 'user_off'],
	})
	@Expose()
	source: 'manual' | 'preset' | 'automation' | 'override' | 'user_off';

	@ApiProperty({
		description: 'Controller preset distinct from HVAC mode',
		type: String,
		allOf: [{ $ref: getSchemaPath('DevicesVirtualPluginThermostatPreset') }],
		nullable: true,
	})
	@Expose()
	preset: ThermostatPreset | null;

	@ApiProperty({ description: 'Active override identity', type: String, nullable: true })
	@Expose()
	override_id: string | null;

	@ApiProperty({ description: 'Absolute active override expiry', type: String, nullable: true })
	@Expose()
	expires_at: string | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatComfortOverride' })
export class ThermostatComfortOverrideModel {
	@ApiProperty({ description: 'Override identity', format: 'uuid' })
	@Expose()
	id: string;

	@ApiProperty({ description: 'Authenticated command source', enum: ['user', 'panel'] })
	@Expose()
	source: 'user' | 'panel';

	@ApiProperty({ description: 'Authenticated actor identity' })
	@Expose()
	actor_id: string;

	@ApiProperty({ description: 'Creation configuration revision' })
	@Expose()
	revision: number;

	@ApiProperty({ description: 'Absolute creation time', format: 'date-time' })
	@Expose()
	created_at: string;

	@ApiProperty({ description: 'Absolute expiry', format: 'date-time' })
	@Expose()
	expires_at: string;

	@ApiProperty({
		description: 'Durable terminal lifecycle state',
		enum: ['active', 'expired', 'cancelled', 'clock_uncertain'],
	})
	@Expose()
	status: 'active' | 'expired' | 'cancelled' | 'clock_uncertain';

	@ApiProperty({ description: 'Time termination was observed', type: String, nullable: true })
	@Expose()
	terminated_at: string | null;

	@ApiProperty({
		description: 'Controller preset distinct from HVAC mode',
		type: String,
		allOf: [{ $ref: getSchemaPath('DevicesVirtualPluginThermostatPreset') }],
		nullable: true,
	})
	@Expose()
	preset: ThermostatPreset | null;

	@ApiProperty({
		description: 'Explicit requested setpoints; null when a preset was chosen',
		type: ThermostatComfortSetpointsModel,
		nullable: true,
	})
	@Expose()
	@Type(() => ThermostatComfortSetpointsModel)
	setpoints: ThermostatComfortSetpointsModel | null;

	@ApiProperty({
		description: 'Immutable override setpoints resolved at creation',
		type: ThermostatComfortSetpointsModel,
	})
	@Expose()
	@Type(() => ThermostatComfortSetpointsModel)
	resolved_setpoints: ThermostatComfortSetpointsModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatAutomationBaseline' })
export class ThermostatAutomationBaselineModel {
	@ApiProperty({
		description: 'Preset selected by the trusted bridge',
		type: String,
		allOf: [{ $ref: getSchemaPath('DevicesVirtualPluginThermostatPreset') }],
		nullable: true,
	})
	@Expose()
	preset: ThermostatPreset | null;

	@ApiProperty({
		description: 'Explicit bridge setpoints, mutually exclusive with preset',
		type: ThermostatComfortSetpointsModel,
		nullable: true,
	})
	@Expose()
	@Type(() => ThermostatComfortSetpointsModel)
	setpoints: ThermostatComfortSetpointsModel | null;

	@ApiProperty({ description: 'Trusted bridge actor identity' })
	@Expose()
	actor_id: string;

	@ApiProperty({ description: 'Baseline configuration revision' })
	@Expose()
	revision: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatComfortConfiguration' })
export class ThermostatComfortConfigurationModel {
	@ApiProperty({
		description: 'Current trusted automation baseline; no public writer',
		type: ThermostatAutomationBaselineModel,
		nullable: true,
	})
	@Expose()
	@Type(() => ThermostatAutomationBaselineModel)
	automation_baseline?: ThermostatAutomationBaselineModel | null;

	@ApiProperty({ description: 'Operator branch range in Celsius', type: ThermostatComfortRangeModel, nullable: true })
	@Expose()
	@Type(() => ThermostatComfortRangeModel)
	heating_range: ThermostatComfortRangeModel | null;

	@ApiProperty({ description: 'Operator branch range in Celsius', type: ThermostatComfortRangeModel, nullable: true })
	@Expose()
	@Type(() => ThermostatComfortRangeModel)
	cooling_range: ThermostatComfortRangeModel | null;

	@ApiProperty({ description: 'Explicitly configured presets', type: [ThermostatComfortPresetModel] })
	@Expose()
	@Type(() => ThermostatComfortPresetModel)
	presets: ThermostatComfortPresetModel[];

	@ApiProperty({
		description: 'Selected baseline preset',
		type: String,
		allOf: [{ $ref: getSchemaPath('DevicesVirtualPluginThermostatPreset') }],
		nullable: true,
	})
	@Expose()
	selected_preset: ThermostatPreset | null;

	@ApiProperty({ description: 'Explicit user OFF latch' })
	@Expose()
	user_off: boolean;

	@ApiProperty({ description: 'Explicit operator opt-in for the trusted bridge; disabled by default', type: Boolean })
	@Expose()
	automation_enabled: boolean;

	@ApiProperty({
		description: 'Latest override and retained terminal outcome',
		type: ThermostatComfortOverrideModel,
		nullable: true,
	})
	@Expose()
	@Type(() => ThermostatComfortOverrideModel)
	temporary_override: ThermostatComfortOverrideModel | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatComfort' })
export class ThermostatComfortModel {
	@ApiProperty({ description: 'Controller identity' })
	@Expose()
	controller: string;

	@ApiProperty({ description: 'Current configuration revision' })
	@Expose()
	revision: number;

	@ApiProperty({ description: 'Current dependency graph revision' })
	@Expose()
	graph_revision: number;

	@ApiProperty({
		description: 'Null preserves existing manual behavior',
		type: ThermostatComfortConfigurationModel,
		nullable: true,
	})
	@Expose()
	@Type(() => ThermostatComfortConfigurationModel)
	configuration: ThermostatComfortConfigurationModel | null;

	@ApiProperty({
		description: 'Effective comfort intent; never physical activity',
		type: ThermostatEffectiveComfortModel,
	})
	@Expose()
	@Type(() => ThermostatEffectiveComfortModel)
	effective: ThermostatEffectiveComfortModel;

	@ApiProperty({
		description: 'Recover bounded remaining absolute lifetime; observable clock uncertainty inhibits output',
		enum: ['bounded_absolute_recovery_with_uncertainty_inhibit'],
	})
	@Expose()
	clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit';
}

@ApiSchema({ name: 'DevicesVirtualPluginResThermostatComfort' })
export class ThermostatComfortResponseModel extends BaseSuccessResponseModel<ThermostatComfortModel> {
	@ApiProperty({ description: 'Thermostat comfort configuration and effective intent', type: ThermostatComfortModel })
	@Expose()
	@Type(() => ThermostatComfortModel)
	data: ThermostatComfortModel;
}
