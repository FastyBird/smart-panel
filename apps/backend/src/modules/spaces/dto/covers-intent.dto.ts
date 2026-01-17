import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsDefined, IsEnum, IsInt, Max, Min, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CoversIntentType, CoversMode, CoversRole, PositionDelta } from '../spaces.constants';

@ApiSchema({ name: 'SpacesModuleCoversIntent' })
export class CoversIntentDto {
	@ApiProperty({
		description: 'Type of covers intent to execute',
		enum: CoversIntentType,
		example: CoversIntentType.SET_MODE,
	})
	@Expose()
	@IsEnum(CoversIntentType, { message: '[{"field":"type","reason":"Type must be a valid covers intent type."}]' })
	type: CoversIntentType;

	@ApiPropertyOptional({
		description: 'Covers mode (required when type is SET_MODE)',
		enum: CoversMode,
		example: CoversMode.PRIVACY,
	})
	@Expose()
	@ValidateIf((o: CoversIntentDto) => o.type === CoversIntentType.SET_MODE)
	@IsDefined({ message: '[{"field":"mode","reason":"Mode is required when type is SET_MODE."}]' })
	@IsEnum(CoversMode, { message: '[{"field":"mode","reason":"Mode must be a valid covers mode."}]' })
	mode?: CoversMode;

	@ApiPropertyOptional({
		description: 'Position 0-100 (required when type is SET_POSITION or ROLE_POSITION). 0=closed, 100=open',
		type: 'integer',
		minimum: 0,
		maximum: 100,
		example: 50,
	})
	@Expose()
	@ValidateIf(
		(o: CoversIntentDto) => o.type === CoversIntentType.SET_POSITION || o.type === CoversIntentType.ROLE_POSITION,
	)
	@IsDefined({
		message: '[{"field":"position","reason":"Position is required when type is SET_POSITION or ROLE_POSITION."}]',
	})
	@IsInt({ message: '[{"field":"position","reason":"Position must be an integer."}]' })
	@Min(0, { message: '[{"field":"position","reason":"Position must be at least 0."}]' })
	@Max(100, { message: '[{"field":"position","reason":"Position must be at most 100."}]' })
	position?: number;

	@ApiPropertyOptional({
		description: 'Position delta size (required when type is POSITION_DELTA)',
		enum: PositionDelta,
		example: PositionDelta.MEDIUM,
	})
	@Expose()
	@ValidateIf((o: CoversIntentDto) => o.type === CoversIntentType.POSITION_DELTA)
	@IsDefined({ message: '[{"field":"delta","reason":"Delta is required when type is POSITION_DELTA."}]' })
	@IsEnum(PositionDelta, { message: '[{"field":"delta","reason":"Delta must be a valid position delta."}]' })
	delta?: PositionDelta;

	@ApiPropertyOptional({
		description:
			'Direction of position change (true = open more, false = close more). Required when type is POSITION_DELTA',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@ValidateIf((o: CoversIntentDto) => o.type === CoversIntentType.POSITION_DELTA)
	@IsDefined({ message: '[{"field":"increase","reason":"Increase direction is required for position delta."}]' })
	@IsBoolean({ message: '[{"field":"increase","reason":"Increase must be a boolean."}]' })
	increase?: boolean;

	@ApiPropertyOptional({
		description: 'Target covers role (required for ROLE_POSITION intent)',
		enum: CoversRole,
		example: CoversRole.PRIMARY,
	})
	@Expose()
	@ValidateIf((o: CoversIntentDto) => o.type === CoversIntentType.ROLE_POSITION)
	@IsDefined({ message: '[{"field":"role","reason":"Role is required for ROLE_POSITION intent."}]' })
	@IsEnum(CoversRole, { message: '[{"field":"role","reason":"Role must be a valid covers role."}]' })
	role?: CoversRole;
}

@ApiSchema({ name: 'SpacesModuleReqCoversIntent' })
export class ReqCoversIntentDto {
	@ApiProperty({
		description: 'Covers intent data',
		type: () => CoversIntentDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CoversIntentDto)
	data: CoversIntentDto;
}
