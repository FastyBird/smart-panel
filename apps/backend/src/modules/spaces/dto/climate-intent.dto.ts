import { Expose, Type } from 'class-transformer';
import {
	IsBoolean,
	IsDefined,
	IsEnum,
	IsNumber,
	IsOptional,
	Max,
	Min,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import {
	ABSOLUTE_MAX_SETPOINT,
	ABSOLUTE_MIN_SETPOINT,
	ClimateIntentType,
	ClimateMode,
	SetpointDelta,
} from '../spaces.constants';

@ApiSchema({ name: 'SpacesModuleClimateIntent' })
export class ClimateIntentDto {
	@ApiProperty({
		description: 'Type of climate intent to execute',
		enum: ClimateIntentType,
		example: ClimateIntentType.SETPOINT_DELTA,
	})
	@Expose()
	@IsEnum(ClimateIntentType, { message: '[{"field":"type","reason":"Type must be a valid climate intent type."}]' })
	type: ClimateIntentType;

	@ApiPropertyOptional({
		description: 'Setpoint delta size (required when type is SETPOINT_DELTA)',
		enum: SetpointDelta,
		example: SetpointDelta.MEDIUM,
	})
	@Expose()
	@ValidateIf((o: ClimateIntentDto) => o.type === ClimateIntentType.SETPOINT_DELTA)
	@IsDefined({ message: '[{"field":"delta","reason":"Delta is required when type is SETPOINT_DELTA."}]' })
	@IsEnum(SetpointDelta, { message: '[{"field":"delta","reason":"Delta must be a valid setpoint delta."}]' })
	delta?: SetpointDelta;

	@ApiPropertyOptional({
		description:
			'Direction of setpoint change (true = increase, false = decrease). Required when type is SETPOINT_DELTA',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@ValidateIf((o: ClimateIntentDto) => o.type === ClimateIntentType.SETPOINT_DELTA)
	@IsDefined({ message: '[{"field":"increase","reason":"Increase direction is required for setpoint delta."}]' })
	@IsBoolean({ message: '[{"field":"increase","reason":"Increase must be a boolean value."}]' })
	increase?: boolean;

	@ApiPropertyOptional({
		description:
			'Target setpoint value in degrees Celsius. ' +
			'For HEAT/COOL modes: sets the single setpoint. ' +
			'For AUTO mode: optional, if provided sets both heating and cooling setpoints. ' +
			'The value will be clamped to the device-specific min/max range.',
		type: 'number',
		example: 21.5,
	})
	@Expose()
	@ValidateIf(
		(o: ClimateIntentDto) =>
			o.type === ClimateIntentType.SETPOINT_SET && o.heatingSetpoint === undefined && o.coolingSetpoint === undefined,
	)
	@IsDefined({
		message:
			'[{"field":"value","reason":"Value is required when type is SETPOINT_SET (unless heatingSetpoint/coolingSetpoint are provided for AUTO mode)."}]',
	})
	@IsNumber({}, { message: '[{"field":"value","reason":"Value must be a number."}]' })
	@Min(ABSOLUTE_MIN_SETPOINT, {
		message: `[{"field":"value","reason":"Value must be at least ${ABSOLUTE_MIN_SETPOINT} degrees."}]`,
	})
	@Max(ABSOLUTE_MAX_SETPOINT, {
		message: `[{"field":"value","reason":"Value must be at most ${ABSOLUTE_MAX_SETPOINT} degrees."}]`,
	})
	value?: number;

	@ApiPropertyOptional({
		description:
			'Heating setpoint (lower bound) for AUTO mode. ' +
			'When heating is needed, devices will heat to this temperature. ' +
			'Must be less than coolingSetpoint.',
		type: 'number',
		example: 20.0,
	})
	@Expose()
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"heatingSetpoint","reason":"Heating setpoint must be a number."}]' })
	@Min(ABSOLUTE_MIN_SETPOINT, {
		message: `[{"field":"heatingSetpoint","reason":"Heating setpoint must be at least ${ABSOLUTE_MIN_SETPOINT} degrees."}]`,
	})
	@Max(ABSOLUTE_MAX_SETPOINT, {
		message: `[{"field":"heatingSetpoint","reason":"Heating setpoint must be at most ${ABSOLUTE_MAX_SETPOINT} degrees."}]`,
	})
	heatingSetpoint?: number;

	@ApiPropertyOptional({
		description:
			'Cooling setpoint (upper bound) for AUTO mode. ' +
			'When cooling is needed, devices will cool to this temperature. ' +
			'Must be greater than heatingSetpoint.',
		type: 'number',
		example: 24.0,
	})
	@Expose()
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"coolingSetpoint","reason":"Cooling setpoint must be a number."}]' })
	@Min(ABSOLUTE_MIN_SETPOINT, {
		message: `[{"field":"coolingSetpoint","reason":"Cooling setpoint must be at least ${ABSOLUTE_MIN_SETPOINT} degrees."}]`,
	})
	@Max(ABSOLUTE_MAX_SETPOINT, {
		message: `[{"field":"coolingSetpoint","reason":"Cooling setpoint must be at most ${ABSOLUTE_MAX_SETPOINT} degrees."}]`,
	})
	coolingSetpoint?: number;

	@ApiPropertyOptional({
		description: 'Climate mode to set (required when type is SET_MODE)',
		enum: ClimateMode,
		example: ClimateMode.HEAT,
	})
	@Expose()
	@ValidateIf((o: ClimateIntentDto) => o.type === ClimateIntentType.SET_MODE)
	@IsDefined({ message: '[{"field":"mode","reason":"Mode is required when type is SET_MODE."}]' })
	@IsEnum(ClimateMode, { message: '[{"field":"mode","reason":"Mode must be a valid climate mode."}]' })
	mode?: ClimateMode;
}

@ApiSchema({ name: 'SpacesModuleReqClimateIntent' })
export class ReqClimateIntentDto {
	@ApiProperty({
		description: 'Climate intent data',
		type: () => ClimateIntentDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => ClimateIntentDto)
	data: ClimateIntentDto;
}
