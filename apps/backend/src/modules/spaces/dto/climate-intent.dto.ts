import { Expose, Transform, Type } from 'class-transformer';
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
import { IsValidSetpointOrder } from '../validators/setpoint-order-constraint.validator';

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
	@Transform(({ value }) => (value === null ? undefined : value))
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
	@Transform(({ value }) => (value === null ? undefined : value))
	@ValidateIf((o: ClimateIntentDto) => o.type === ClimateIntentType.SETPOINT_DELTA)
	@IsDefined({ message: '[{"field":"increase","reason":"Increase direction is required for setpoint delta."}]' })
	@IsBoolean({ message: '[{"field":"increase","reason":"Increase must be a boolean value."}]' })
	increase?: boolean;

	@ApiPropertyOptional({
		description:
			'Heating setpoint for HEAT mode or lower bound for AUTO mode. ' +
			'Required when type is SETPOINT_SET and mode is HEAT or AUTO. ' +
			'When heating is needed, devices will heat to this temperature. ' +
			'Must be less than cooling_setpoint when both are provided.',
		type: 'number',
		example: 20.0,
		name: 'heating_setpoint',
	})
	@Expose({ name: 'heating_setpoint' })
	@Transform(({ value }) => (value === null ? undefined : value))
	@ValidateIf(
		(o: ClimateIntentDto) => o.type === ClimateIntentType.SETPOINT_SET && o.coolingSetpoint === undefined,
	)
	@IsDefined({
		message:
			'[{"field":"heating_setpoint","reason":"At least one of heating_setpoint or cooling_setpoint is required for SETPOINT_SET."}]',
	})
	@IsNumber({}, { message: '[{"field":"heating_setpoint","reason":"Heating setpoint must be a number."}]' })
	@Min(ABSOLUTE_MIN_SETPOINT, {
		message: `[{"field":"heating_setpoint","reason":"Heating setpoint must be at least ${ABSOLUTE_MIN_SETPOINT} degrees."}]`,
	})
	@Max(ABSOLUTE_MAX_SETPOINT, {
		message: `[{"field":"heating_setpoint","reason":"Heating setpoint must be at most ${ABSOLUTE_MAX_SETPOINT} degrees."}]`,
	})
	@IsValidSetpointOrder({
		message:
			'[{"field":"heating_setpoint","reason":"Heating setpoint must be less than cooling setpoint when both are provided."}]',
	})
	heatingSetpoint?: number;

	@ApiPropertyOptional({
		description:
			'Cooling setpoint for COOL mode or upper bound for AUTO mode. ' +
			'Required when type is SETPOINT_SET and mode is COOL or AUTO. ' +
			'When cooling is needed, devices will cool to this temperature. ' +
			'Must be greater than heating_setpoint when both are provided.',
		type: 'number',
		example: 24.0,
		name: 'cooling_setpoint',
	})
	@Expose({ name: 'cooling_setpoint' })
	@Transform(({ value }) => (value === null ? undefined : value))
	@ValidateIf(
		(o: ClimateIntentDto) => o.type === ClimateIntentType.SETPOINT_SET && o.heatingSetpoint === undefined,
	)
	@IsDefined({
		message:
			'[{"field":"cooling_setpoint","reason":"At least one of heating_setpoint or cooling_setpoint is required for SETPOINT_SET."}]',
	})
	@IsNumber({}, { message: '[{"field":"cooling_setpoint","reason":"Cooling setpoint must be a number."}]' })
	@Min(ABSOLUTE_MIN_SETPOINT, {
		message: `[{"field":"cooling_setpoint","reason":"Cooling setpoint must be at least ${ABSOLUTE_MIN_SETPOINT} degrees."}]`,
	})
	@Max(ABSOLUTE_MAX_SETPOINT, {
		message: `[{"field":"cooling_setpoint","reason":"Cooling setpoint must be at most ${ABSOLUTE_MAX_SETPOINT} degrees."}]`,
	})
	coolingSetpoint?: number;

	@ApiPropertyOptional({
		description: 'Climate mode to set (required when type is SET_MODE, optional for CLIMATE_SET)',
		enum: ClimateMode,
		example: ClimateMode.HEAT,
	})
	@Expose()
	@Transform(({ value }) => (value === null ? undefined : value))
	@ValidateIf((o: ClimateIntentDto) => o.type === ClimateIntentType.SET_MODE)
	@IsDefined({ message: '[{"field":"mode","reason":"Mode is required when type is SET_MODE."}]' })
	@ValidateIf((o: ClimateIntentDto) => o.type === ClimateIntentType.CLIMATE_SET && o.mode !== undefined)
	@IsOptional()
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
