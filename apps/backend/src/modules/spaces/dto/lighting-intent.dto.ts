import { Expose, Type } from 'class-transformer';
import { IsEnum, IsOptional, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BrightnessDelta, LightingIntentType, LightingMode } from '../spaces.constants';

@ApiSchema({ name: 'SpacesModuleLightingIntent' })
export class LightingIntentDto {
	@ApiProperty({
		description: 'Type of lighting intent to execute',
		enum: LightingIntentType,
		example: LightingIntentType.SET_MODE,
	})
	@Expose()
	@IsEnum(LightingIntentType, { message: '[{"field":"type","reason":"Type must be a valid lighting intent type."}]' })
	type: LightingIntentType;

	@ApiPropertyOptional({
		description: 'Lighting mode (required when type is SET_MODE)',
		enum: LightingMode,
		example: LightingMode.RELAX,
	})
	@Expose()
	@IsOptional()
	@ValidateIf((o: LightingIntentDto) => o.type === LightingIntentType.SET_MODE)
	@IsEnum(LightingMode, { message: '[{"field":"mode","reason":"Mode must be a valid lighting mode."}]' })
	mode?: LightingMode;

	@ApiPropertyOptional({
		description: 'Brightness delta size (required when type is BRIGHTNESS_DELTA)',
		enum: BrightnessDelta,
		example: BrightnessDelta.MEDIUM,
	})
	@Expose()
	@IsOptional()
	@ValidateIf((o: LightingIntentDto) => o.type === LightingIntentType.BRIGHTNESS_DELTA)
	@IsEnum(BrightnessDelta, { message: '[{"field":"delta","reason":"Delta must be a valid brightness delta."}]' })
	delta?: BrightnessDelta;

	@ApiPropertyOptional({
		description:
			'Direction of brightness change (true = increase, false = decrease). Required when type is BRIGHTNESS_DELTA',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@ValidateIf((o: LightingIntentDto) => o.type === LightingIntentType.BRIGHTNESS_DELTA)
	increase?: boolean;
}

@ApiSchema({ name: 'SpacesModuleReqLightingIntent' })
export class ReqLightingIntentDto {
	@ApiProperty({
		description: 'Lighting intent data',
		type: () => LightingIntentDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => LightingIntentDto)
	data: LightingIntentDto;
}
