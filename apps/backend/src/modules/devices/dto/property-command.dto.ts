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

import { ApiProperty } from '@nestjs/swagger';

import { ValidateChannelExists } from '../validators/channel-exists-constraint.validator';
import { ValidateChannelPropertyExists } from '../validators/channel-property-exists-constraint.validator';
import { ValidateDeviceExists } from '../validators/device-exists-constraint.validator';

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
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PropertyCommandValueDto)
	properties: PropertyCommandValueDto[];
}
