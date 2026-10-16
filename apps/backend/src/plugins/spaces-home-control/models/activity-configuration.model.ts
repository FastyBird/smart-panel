import { Expose, Type } from 'class-transformer';
import {
	IsBoolean,
	IsDefined,
	IsEnum,
	IsIn,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ClimateMode, LightingMode, MediaActivityKey } from '../spaces-home-control.constants';

@ApiSchema({ name: 'SpacesHomeControlPluginDataActivityAction' })
export class ActivityActionModel {
	@ApiProperty({ description: 'Whether this domain participates', type: 'boolean' })
	@Expose()
	@IsBoolean()
	enabled: boolean;
}
@ApiSchema({ name: 'SpacesHomeControlPluginDataActivityLighting' })
export class ActivityLightingModel extends ActivityActionModel {
	@ApiProperty({ description: 'Lighting mode; off sends actual OFF commands', enum: LightingMode })
	@Expose()
	@IsEnum(LightingMode)
	mode: LightingMode;
	@ApiPropertyOptional({
		description: 'Brightness override for roles selected ON by the mode',
		minimum: 0,
		maximum: 100,
		type: 'integer',
	})
	@Expose()
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(100)
	brightness?: number;
}
@ApiSchema({ name: 'SpacesHomeControlPluginDataActivityClimate' })
export class ActivityClimateModel extends ActivityActionModel {
	@ApiPropertyOptional({ description: 'Explicit climate mode', enum: ClimateMode })
	@Expose()
	@IsOptional()
	@IsEnum(ClimateMode)
	mode?: ClimateMode;
	@ApiPropertyOptional({
		description: 'Operator-authored thermostat preset reference; resolved by a future trusted adapter',
		type: 'string',
		enum: ['comfort', 'eco', 'away'],
		maxLength: 100,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@IsIn(['comfort', 'eco', 'away'])
	@MaxLength(100)
	thermostat_preset?: 'comfort' | 'eco' | 'away';
	@ApiPropertyOptional({
		description: 'Explicit temperature in Celsius; target range validation requires the trusted adapter',
		type: 'number',
	})
	@Expose()
	@IsOptional()
	@IsNumber({ allowNaN: false, allowInfinity: false })
	setpoint?: number;
	@ApiPropertyOptional({
		description: 'Explicit temperature delta in Celsius; mutually exclusive with absolute setpoint',
		type: 'number',
	})
	@Expose()
	@IsOptional()
	@IsNumber({ allowNaN: false, allowInfinity: false })
	setpoint_delta?: number;
}
@ApiSchema({ name: 'SpacesHomeControlPluginDataActivityCovers' })
export class ActivityCoversModel extends ActivityActionModel {
	@ApiProperty({
		description: 'Absolute position, 0 closed, 100 open; requires compatible writable controls',
		type: 'integer',
		minimum: 0,
		maximum: 100,
	})
	@Expose()
	@IsInt()
	@Min(0)
	@Max(100)
	position: number;
}
@ApiSchema({ name: 'SpacesHomeControlPluginDataActivityMedia' })
export class ActivityMediaModel extends ActivityActionModel {
	@ApiProperty({ description: 'Existing media activity; operator-created binding required', enum: MediaActivityKey })
	@Expose()
	@IsEnum(MediaActivityKey)
	activity: MediaActivityKey;
}
@ApiSchema({ name: 'SpacesHomeControlPluginDataActivityConfiguration' })
export class ActivityConfigurationModel {
	@ApiProperty({ description: 'Lighting action', type: () => ActivityLightingModel })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => ActivityLightingModel)
	lighting: ActivityLightingModel;
	@ApiProperty({
		description: 'Climate action; disabled by default, trusted adapter unavailable in this foundation',
		type: () => ActivityClimateModel,
	})
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => ActivityClimateModel)
	climate: ActivityClimateModel;
	@ApiProperty({ description: 'Covers action', type: () => ActivityCoversModel })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => ActivityCoversModel)
	covers: ActivityCoversModel;
	@ApiProperty({ description: 'Media action', type: () => ActivityMediaModel })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => ActivityMediaModel)
	media: ActivityMediaModel;
	@ApiProperty({ description: 'Security stub; enabled actions report unsupported', type: () => ActivityActionModel })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => ActivityActionModel)
	security: ActivityActionModel;
}
