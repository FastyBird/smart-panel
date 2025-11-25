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

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ValidateChannelExists } from '../validators/channel-exists-constraint.validator';
import { ValidateChannelPropertyExists } from '../validators/channel-property-exists-constraint.validator';
import { ValidateDeviceExists } from '../validators/device-exists-constraint.validator';

@ApiSchema({ name: 'DevicesModulePropertyCommandValue' })
export class PropertyCommandValueDto {
	@ApiProperty({
		description: 'Device ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device: string;

	@ApiProperty({
		description: 'Channel ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsUUID('4', { message: '[{"field":"channel","reason":"Channel must be a valid UUID (version 4)."}]' })
	@ValidateChannelExists({ message: '[{"field":"channel","reason":"The specified channel does not exist."}]' })
	channel: string;

	@ApiProperty({
		description: 'Property ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsUUID('4', { message: '[{"field":"property","reason":"Property must be a valid UUID (version 4)."}]' })
	@ValidateChannelPropertyExists({
		message: '[{"field":"property","reason":"The specified property does not exist."}]',
	})
	property: string;

	@ApiProperty({
		description: 'Property value',
		type: 'string',
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

@ApiSchema({ name: 'DevicesModulePropertyCommand' })
export class PropertyCommandDto {
	@ApiProperty({
		description: 'Array of property commands',
		type: [PropertyCommandValueDto],
		isArray: true,
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PropertyCommandValueDto)
	properties: PropertyCommandValueDto[];
}
