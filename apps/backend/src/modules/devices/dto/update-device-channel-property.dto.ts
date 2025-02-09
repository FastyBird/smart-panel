import { Expose } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';

import type { components } from '../../../openapi';

type UpdateChannelProperty = components['schemas']['DevicesUpdateChannelProperty'];

export class UpdateDeviceChannelPropertyDto implements UpdateChannelProperty {
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	name?: string | null;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"unit","reason":"Unit must be a valid string."}]' })
	@IsString({ message: '[{"field":"unit","reason":"Unit must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	unit?: string | null;

	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"format","reason":"Format must be an array."}]' })
	@ValidateIf((o: { format?: unknown[] }) => o.format?.every((item) => typeof item === 'string'))
	@IsString({ each: true, message: '[{"field":"format","reason":"Each format value must be a string."}]' })
	@ValidateIf((o: { format?: unknown[] }) => o.format?.every((item) => typeof item === 'number'))
	@IsNumber({}, { each: true, message: '[{"field":"format","reason":"Each format value must be a number."}]' })
	@ValidateIf((_, value) => value !== null)
	format?: string[] | number[] | null;

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

	@Expose()
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"step","reason":"Step must be a valid number."}]' })
	@ValidateIf((_, value) => value !== null)
	step?: number | null;

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
