import { Expose, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsNotEmpty,
	IsNumber,
	IsString,
	IsUUID,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

@ApiSchema({ name: 'DevicesThirdPartyPluginUpdateProperty' })
export class PropertyUpdateRequestDto {
	@ApiProperty({
		description: 'Device UUID',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsUUID()
	device: string;

	@ApiProperty({
		description: 'Channel UUID',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174001',
	})
	@Expose()
	@IsUUID()
	channel: string;

	@ApiProperty({
		description: 'Property UUID',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174002',
	})
	@Expose()
	@IsUUID()
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

@ApiSchema({ name: 'DevicesThirdPartyPluginReqUpdateProperties' })
export class ReqUpdatePropertiesDto {
	@ApiProperty({
		description: 'Represents a single property update operation for a third-party device',
		type: 'array',
		items: { $ref: getSchemaPath(PropertyUpdateRequestDto) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PropertyUpdateRequestDto)
	properties: PropertyUpdateRequestDto[];
}
