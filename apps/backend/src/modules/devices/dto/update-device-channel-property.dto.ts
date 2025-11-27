import { Expose, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DevicesModuleUpdateDeviceChannelProperty' })
export class UpdateDeviceChannelPropertyDto {
	@ApiProperty({ description: 'Property type', type: 'string', example: 'dynamic' })
	@Expose()
	@IsNotEmpty({
		message:
			'[{"field":"type","reason":"Type must be a valid string representing a supported channel property type."}]',
	})
	@IsString({
		message:
			'[{"field":"type","reason":"Type must be a valid string representing a supported channel property type."}]',
	})
	type: string;

	@ApiPropertyOptional({
		description: 'Property identifier',
		type: 'string',
		nullable: true,
		example: 'temperature',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({
		message:
			'[{"field":"identifier","reason":"Identifier must be a valid string representing channel property unique identifier."}]',
	})
	@IsString({
		message:
			'[{"field":"identifier","reason":"Identifier must be a valid string representing channel property unique identifier."}]',
	})
	@ValidateIf((_, value) => value !== null)
	identifier?: string | null;

	@ApiPropertyOptional({
		description: 'Property name',
		type: 'string',
		nullable: true,
		example: 'Temperature',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	name?: string | null;

	@ApiPropertyOptional({
		description: 'Property unit',
		type: 'string',
		nullable: true,
		example: '°C',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"unit","reason":"Unit must be a valid string."}]' })
	@IsString({ message: '[{"field":"unit","reason":"Unit must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	unit?: string | null;

	@ApiPropertyOptional({
		description: 'Property format',
		type: 'array',
		nullable: true,
		example: [0, 100],
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"format","reason":"Format must be an array."}]' })
	@ValidateIf((o: { format?: unknown[] }) => o.format?.every((item) => typeof item === 'string'))
	@IsString({ each: true, message: '[{"field":"format","reason":"Each format value must be a string."}]' })
	@ValidateIf((o: { format?: unknown[] }) => o.format?.every((item) => typeof item === 'number'))
	@IsNumber({}, { each: true, message: '[{"field":"format","reason":"Each format value must be a number."}]' })
	@ValidateIf((_, value) => value !== null)
	format?: string[] | number[] | null;

	@ApiPropertyOptional({
		description: 'Property invalid value',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@ValidateIf((o: { invalid: unknown }) => typeof o.invalid === 'string')
	@IsString({ message: '[{"field":"invalid","reason":"Invalid must be a string."}]' })
	@ValidateIf((o: { invalid: unknown }) => typeof o.invalid === 'number')
	@IsNumber({}, { message: '[{"field":"invalid","reason":"Invalid must be a number."}]' })
	@ValidateIf((o: { invalid: unknown }) => typeof o.invalid === 'boolean')
	@IsBoolean({ message: '[{"field":"invalid","reason":"Invalid must be a boolean."}]' })
	@ValidateIf((_, value) => value !== null)
	invalid?: string | number | boolean | null;

	@ApiPropertyOptional({
		description: 'Property step value',
		type: 'number',
		nullable: true,
		example: 0.1,
	})
	@Expose()
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"step","reason":"Step must be a valid number."}]' })
	@ValidateIf((_, value) => value !== null)
	step?: number | null;

	@ApiPropertyOptional({
		description: 'Property value',
		nullable: true,
		example: 22.5,
	})
	@Expose()
	@IsOptional()
	@ValidateIf((o: { value: unknown }) => typeof o.value === 'string')
	@IsString({ message: '[{"field":"value","reason":"Value must be a string."}]' })
	@ValidateIf((o: { value: unknown }) => typeof o.value === 'number')
	@IsNumber({}, { message: '[{"field":"value","reason":"Value must be a number."}]' })
	@ValidateIf((o: { value: unknown }) => typeof o.value === 'boolean')
	@IsBoolean({ message: '[{"field":"value","reason":"Value must be a boolean."}]' })
	@ValidateIf((_, value) => value !== null)
	value?: string | number | boolean | null;
}

@ApiSchema({ name: 'DevicesModuleReqUpdateDeviceChannelProperty' })
export class ReqUpdateDeviceChannelPropertyDto {
	@ApiProperty({ description: 'Channel property data', type: () => UpdateDeviceChannelPropertyDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateDeviceChannelPropertyDto)
	data: UpdateDeviceChannelPropertyDto;
}
