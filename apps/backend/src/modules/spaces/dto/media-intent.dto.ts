import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsDefined, IsEnum, IsInt, IsString, Max, Min, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { MediaIntentType, MediaMode, MediaRole, VolumeDelta } from '../spaces.constants';

// Helper to check if intent type is role-specific (requires role parameter)
const isRoleIntent = (type: MediaIntentType): boolean =>
	[MediaIntentType.ROLE_POWER, MediaIntentType.ROLE_VOLUME].includes(type);

const isInputIntent = (type: MediaIntentType): boolean => type === MediaIntentType.INPUT_SET;

@ApiSchema({ name: 'SpacesModuleMediaIntent' })
export class MediaIntentDto {
	@ApiProperty({
		description: 'Type of media intent to execute',
		enum: MediaIntentType,
		example: MediaIntentType.SET_MODE,
	})
	@Expose()
	@IsEnum(MediaIntentType, { message: '[{"field":"type","reason":"Type must be a valid media intent type."}]' })
	type: MediaIntentType;

	@ApiPropertyOptional({
		description: 'Media mode (required when type is SET_MODE)',
		enum: MediaMode,
		example: MediaMode.FOCUSED,
	})
	@Expose()
	@ValidateIf((o: MediaIntentDto) => o.type === MediaIntentType.SET_MODE)
	@IsDefined({ message: '[{"field":"mode","reason":"Mode is required when type is SET_MODE."}]' })
	@IsEnum(MediaMode, { message: '[{"field":"mode","reason":"Mode must be a valid media mode."}]' })
	mode?: MediaMode;

	@ApiPropertyOptional({
		description: 'Volume level 0-100 (required when type is VOLUME_SET or ROLE_VOLUME)',
		type: 'integer',
		minimum: 0,
		maximum: 100,
		example: 50,
	})
	@Expose()
	@ValidateIf((o: MediaIntentDto) => o.type === MediaIntentType.VOLUME_SET || o.type === MediaIntentType.ROLE_VOLUME)
	@IsDefined({
		message: '[{"field":"volume","reason":"Volume is required when type is VOLUME_SET or ROLE_VOLUME."}]',
	})
	@IsInt({ message: '[{"field":"volume","reason":"Volume must be an integer."}]' })
	@Min(0, { message: '[{"field":"volume","reason":"Volume must be at least 0."}]' })
	@Max(100, { message: '[{"field":"volume","reason":"Volume must be at most 100."}]' })
	volume?: number;

	@ApiPropertyOptional({
		description: 'Volume delta size (required when type is VOLUME_DELTA)',
		enum: VolumeDelta,
		example: VolumeDelta.MEDIUM,
	})
	@Expose()
	@ValidateIf((o: MediaIntentDto) => o.type === MediaIntentType.VOLUME_DELTA)
	@IsDefined({ message: '[{"field":"delta","reason":"Delta is required when type is VOLUME_DELTA."}]' })
	@IsEnum(VolumeDelta, { message: '[{"field":"delta","reason":"Delta must be a valid volume delta."}]' })
	delta?: VolumeDelta;

	@ApiPropertyOptional({
		description: 'Direction of volume change (true = increase, false = decrease). Required when type is VOLUME_DELTA',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@ValidateIf((o: MediaIntentDto) => o.type === MediaIntentType.VOLUME_DELTA)
	@IsDefined({ message: '[{"field":"increase","reason":"Increase direction is required for volume delta."}]' })
	@IsBoolean({ message: '[{"field":"increase","reason":"Increase must be a boolean."}]' })
	increase?: boolean;

	// Role-specific intent parameters

	@ApiPropertyOptional({
		description: 'Target media role (required for ROLE_POWER and ROLE_VOLUME intents)',
		enum: MediaRole,
		example: MediaRole.PRIMARY,
	})
	@Expose()
	@ValidateIf((o: MediaIntentDto) => isRoleIntent(o.type))
	@IsDefined({ message: '[{"field":"role","reason":"Role is required for role-specific intents."}]' })
	@IsEnum(MediaRole, { message: '[{"field":"role","reason":"Role must be a valid media role."}]' })
	role?: MediaRole;

	@ApiPropertyOptional({
		description: 'Power state (required for ROLE_POWER intent)',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@ValidateIf((o: MediaIntentDto) => o.type === MediaIntentType.ROLE_POWER)
	@IsDefined({ message: '[{"field":"on","reason":"On is required when type is ROLE_POWER."}]' })
	@IsBoolean({ message: '[{"field":"on","reason":"On must be a boolean."}]' })
	on?: boolean;

	@ApiPropertyOptional({
		description: 'Input/source identifier (required for INPUT_SET intent)',
		type: 'string',
		example: 'hdmi1',
	})
	@Expose()
	@ValidateIf((o: MediaIntentDto) => isInputIntent(o.type))
	@IsDefined({ message: '[{"field":"source","reason":"Source is required when type is INPUT_SET."}]' })
	@IsString({ message: '[{"field":"source","reason":"Source must be a string."}]' })
	source?: string;
}

@ApiSchema({ name: 'SpacesModuleReqMediaIntent' })
export class ReqMediaIntentDto {
	@ApiProperty({
		description: 'Media intent data',
		type: () => MediaIntentDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => MediaIntentDto)
	data: MediaIntentDto;
}
