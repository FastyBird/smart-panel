import { Expose, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsIn,
	IsNotEmpty,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { INTENT_ORIGINS, IntentOrigin } from '../../intents/intents.constants';
import { ValidateChannelExists } from '../validators/channel-exists-constraint.validator';
import { ValidateChannelPropertyExists } from '../validators/channel-property-exists-constraint.validator';
import { ValidateDeviceExists } from '../validators/device-exists-constraint.validator';

export class PropertyCommandContextDto {
	@ApiPropertyOptional({
		description: 'Origin of the command (where it was initiated from)',
		enum: INTENT_ORIGINS,
		example: 'admin',
	})
	@Expose()
	@IsOptional()
	@IsIn(INTENT_ORIGINS, {
		message: '[{"field":"origin","reason":"Origin must be a valid intent origin value."}]',
	})
	origin?: IntentOrigin;

	@ApiPropertyOptional({
		description: 'Display ID that initiated the command',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'display_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"display_id","reason":"Display ID must be a valid UUID (version 4)."}]' })
	display_id?: string;

	@ApiPropertyOptional({
		description: 'Space ID (room or zone) context',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'space_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"space_id","reason":"Space ID must be a valid UUID (version 4)."}]' })
	space_id?: string;

	@ApiPropertyOptional({
		description: 'Domain hint (e.g. lighting role key: "main", "ambient", ...)',
		type: 'string',
		example: 'main',
	})
	@Expose({ name: 'role_key' })
	@IsOptional()
	@IsString({ message: '[{"field":"role_key","reason":"Role key must be a string."}]' })
	role_key?: string;

	@ApiPropertyOptional({
		description: 'Additional context data for future use',
		type: 'object',
		additionalProperties: true,
	})
	@Expose()
	@IsOptional()
	@IsObject({ message: '[{"field":"extra","reason":"Extra must be an object."}]' })
	extra?: Record<string, unknown>;
}

export class PropertyCommandValueDto {
	@Expose()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device: string;

	@Expose()
	@IsUUID('4', { message: '[{"field":"channel","reason":"Channel must be a valid UUID (version 4)."}]' })
	@ValidateChannelExists({ message: '[{"field":"channel","reason":"The specified channel does not exist."}]' })
	channel: string;

	@Expose()
	@IsUUID('4', { message: '[{"field":"property","reason":"Property must be a valid UUID (version 4)."}]' })
	@ValidateChannelPropertyExists({
		message: '[{"field":"property","reason":"The specified property does not exist."}]',
	})
	property: string;

	@ApiProperty({
		description: 'Property value (string, boolean, or number)',
		oneOf: [{ type: 'string' }, { type: 'boolean' }, { type: 'number' }],
		example: 'on',
	})
	@Expose()
	@ValidateIf((o: { value: unknown }) => typeof o.value === 'string')
	@IsString()
	@IsNotEmpty({ message: '[{"field":"value","reason":"String value cannot be empty."}]' })
	@ValidateIf((o: { value: unknown }) => typeof o.value === 'boolean')
	@IsBoolean({ message: '[{"field":"value","reason":"Value must be a boolean."}]' })
	@ValidateIf((o: { value: unknown }) => typeof o.value === 'number')
	@IsNumber({}, { message: '[{"field":"value","reason":"Value must be a number."}]' })
	value: string | boolean | number;
}

export class PropertyCommandDto {
	@ApiProperty({
		description: 'Request ID for tracking command responses',
		type: 'string',
		format: 'uuid',
		example: 'b686bca7-2b5a-42b5-8fb2-94427764d087',
	})
	@Expose()
	@IsUUID('4', { message: '[{"field":"request_id","reason":"Request ID must be a valid UUID (version 4)."}]' })
	request_id: string;

	@ApiPropertyOptional({
		description: 'Context information about the command origin and scope',
		type: PropertyCommandContextDto,
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => PropertyCommandContextDto)
	context?: PropertyCommandContextDto;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PropertyCommandValueDto)
	properties: PropertyCommandValueDto[];
}
