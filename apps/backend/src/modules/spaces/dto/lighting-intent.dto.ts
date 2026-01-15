import { Expose, Type } from 'class-transformer';
import {
	IsBoolean,
	IsDefined,
	IsEnum,
	IsInt,
	IsString,
	Matches,
	Max,
	Min,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BrightnessDelta, LightingIntentType, LightingMode, LightingRole } from '../spaces.constants';

// Helper to check if intent type is role-specific (requires role parameter)
const isRoleIntent = (type: LightingIntentType): boolean =>
	[
		LightingIntentType.ROLE_ON,
		LightingIntentType.ROLE_OFF,
		LightingIntentType.ROLE_BRIGHTNESS,
		LightingIntentType.ROLE_COLOR,
		LightingIntentType.ROLE_COLOR_TEMP,
		LightingIntentType.ROLE_WHITE,
		LightingIntentType.ROLE_SET,
	].includes(type);

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

	// TODO: Custom YAML-defined modes are supported by IntentSpecLoaderService but currently
	// cannot be used via API because validation restricts to LightingMode enum values.
	// To support custom modes: change to string type with custom validator that checks
	// against intentSpecLoaderService.getAllLightingModeOrchestrations().keys()
	@ApiPropertyOptional({
		description: 'Lighting mode (required when type is SET_MODE). Currently limited to built-in modes.',
		enum: LightingMode,
		example: LightingMode.RELAX,
	})
	@Expose()
	@ValidateIf((o: LightingIntentDto) => o.type === LightingIntentType.SET_MODE)
	@IsDefined({ message: '[{"field":"mode","reason":"Mode is required when type is SET_MODE."}]' })
	@IsEnum(LightingMode, { message: '[{"field":"mode","reason":"Mode must be a valid lighting mode."}]' })
	mode?: LightingMode;

	@ApiPropertyOptional({
		description: 'Brightness delta size (required when type is BRIGHTNESS_DELTA)',
		enum: BrightnessDelta,
		example: BrightnessDelta.MEDIUM,
	})
	@Expose()
	@ValidateIf((o: LightingIntentDto) => o.type === LightingIntentType.BRIGHTNESS_DELTA)
	@IsDefined({ message: '[{"field":"delta","reason":"Delta is required when type is BRIGHTNESS_DELTA."}]' })
	@IsEnum(BrightnessDelta, { message: '[{"field":"delta","reason":"Delta must be a valid brightness delta."}]' })
	delta?: BrightnessDelta;

	@ApiPropertyOptional({
		description:
			'Direction of brightness change (true = increase, false = decrease). Required when type is BRIGHTNESS_DELTA',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@ValidateIf((o: LightingIntentDto) => o.type === LightingIntentType.BRIGHTNESS_DELTA)
	@IsDefined({ message: '[{"field":"increase","reason":"Increase direction is required for brightness delta."}]' })
	increase?: boolean;

	// Role-specific intent parameters

	@ApiPropertyOptional({
		description: 'Target lighting role (required for all role-specific intents)',
		enum: LightingRole,
		example: LightingRole.MAIN,
	})
	@Expose()
	@ValidateIf((o: LightingIntentDto) => isRoleIntent(o.type))
	@IsDefined({ message: '[{"field":"role","reason":"Role is required for role-specific intents."}]' })
	@IsEnum(LightingRole, { message: '[{"field":"role","reason":"Role must be a valid lighting role."}]' })
	role?: LightingRole;

	@ApiPropertyOptional({
		description: 'On/off state (optional for ROLE_SET, use true to turn on, false to turn off)',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@ValidateIf((o: LightingIntentDto) => o.type === LightingIntentType.ROLE_SET && o.on !== undefined)
	@IsBoolean({ message: '[{"field":"on","reason":"On must be a boolean."}]' })
	on?: boolean;

	@ApiPropertyOptional({
		description: 'Brightness level 0-100 (required when type is ROLE_BRIGHTNESS, optional for ROLE_SET)',
		type: 'integer',
		minimum: 0,
		maximum: 100,
		example: 75,
	})
	@Expose()
	@ValidateIf((o: LightingIntentDto) => o.type === LightingIntentType.ROLE_BRIGHTNESS)
	@IsDefined({ message: '[{"field":"brightness","reason":"Brightness is required when type is ROLE_BRIGHTNESS."}]' })
	@ValidateIf(
		(o: LightingIntentDto) =>
			o.type === LightingIntentType.ROLE_BRIGHTNESS ||
			(o.type === LightingIntentType.ROLE_SET && o.brightness !== undefined),
	)
	@IsInt({ message: '[{"field":"brightness","reason":"Brightness must be an integer."}]' })
	@Min(0, { message: '[{"field":"brightness","reason":"Brightness must be at least 0."}]' })
	@Max(100, { message: '[{"field":"brightness","reason":"Brightness must be at most 100."}]' })
	brightness?: number;

	@ApiPropertyOptional({
		description: 'Color as hex string e.g. "#ff6b35" (required when type is ROLE_COLOR, optional for ROLE_SET)',
		type: 'string',
		example: '#ff6b35',
	})
	@Expose()
	@ValidateIf((o: LightingIntentDto) => o.type === LightingIntentType.ROLE_COLOR)
	@IsDefined({ message: '[{"field":"color","reason":"Color is required when type is ROLE_COLOR."}]' })
	@ValidateIf(
		(o: LightingIntentDto) =>
			o.type === LightingIntentType.ROLE_COLOR || (o.type === LightingIntentType.ROLE_SET && o.color !== undefined),
	)
	@IsString({ message: '[{"field":"color","reason":"Color must be a string."}]' })
	@Matches(/^#[0-9a-fA-F]{6}$/, {
		message: '[{"field":"color","reason":"Color must be a valid hex color (e.g. #ff6b35)."}]',
	})
	color?: string;

	@ApiPropertyOptional({
		name: 'color_temperature',
		description:
			'Color temperature in Kelvin e.g. 2700-6500 (required when type is ROLE_COLOR_TEMP, optional for ROLE_SET)',
		type: 'integer',
		minimum: 1000,
		maximum: 10000,
		example: 4000,
	})
	@Expose({ name: 'color_temperature' })
	@ValidateIf((o: LightingIntentDto) => o.type === LightingIntentType.ROLE_COLOR_TEMP)
	@IsDefined({
		message: '[{"field":"color_temperature","reason":"Color temperature is required when type is ROLE_COLOR_TEMP."}]',
	})
	@ValidateIf(
		(o: LightingIntentDto) =>
			o.type === LightingIntentType.ROLE_COLOR_TEMP ||
			(o.type === LightingIntentType.ROLE_SET && o.colorTemperature !== undefined),
	)
	@IsInt({ message: '[{"field":"color_temperature","reason":"Color temperature must be an integer."}]' })
	@Min(1000, { message: '[{"field":"color_temperature","reason":"Color temperature must be at least 1000K."}]' })
	@Max(10000, { message: '[{"field":"color_temperature","reason":"Color temperature must be at most 10000K."}]' })
	colorTemperature?: number;

	@ApiPropertyOptional({
		description: 'White level 0-100 (required when type is ROLE_WHITE, optional for ROLE_SET)',
		type: 'integer',
		minimum: 0,
		maximum: 100,
		example: 80,
	})
	@Expose()
	@ValidateIf((o: LightingIntentDto) => o.type === LightingIntentType.ROLE_WHITE)
	@IsDefined({ message: '[{"field":"white","reason":"White is required when type is ROLE_WHITE."}]' })
	@ValidateIf(
		(o: LightingIntentDto) =>
			o.type === LightingIntentType.ROLE_WHITE || (o.type === LightingIntentType.ROLE_SET && o.white !== undefined),
	)
	@IsInt({ message: '[{"field":"white","reason":"White must be an integer."}]' })
	@Min(0, { message: '[{"field":"white","reason":"White must be at least 0."}]' })
	@Max(100, { message: '[{"field":"white","reason":"White must be at most 100."}]' })
	white?: number;
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
