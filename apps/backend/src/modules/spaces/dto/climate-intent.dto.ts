import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsDefined, IsEnum, IsNumber, Max, Min, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ABSOLUTE_MAX_SETPOINT, ABSOLUTE_MIN_SETPOINT, ClimateIntentType, SetpointDelta } from '../spaces.constants';

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
			'Target setpoint value in degrees Celsius (required when type is SETPOINT_SET). ' +
			'The value will be clamped to the device-specific min/max range returned by the climate state endpoint.',
		type: 'number',
		example: 21.5,
	})
	@Expose()
	@ValidateIf((o: ClimateIntentDto) => o.type === ClimateIntentType.SETPOINT_SET)
	@IsDefined({ message: '[{"field":"value","reason":"Value is required when type is SETPOINT_SET."}]' })
	@IsNumber({}, { message: '[{"field":"value","reason":"Value must be a number."}]' })
	@Min(ABSOLUTE_MIN_SETPOINT, {
		message: `[{"field":"value","reason":"Value must be at least ${ABSOLUTE_MIN_SETPOINT} degrees."}]`,
	})
	@Max(ABSOLUTE_MAX_SETPOINT, {
		message: `[{"field":"value","reason":"Value must be at most ${ABSOLUTE_MAX_SETPOINT} degrees."}]`,
	})
	value?: number;
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
