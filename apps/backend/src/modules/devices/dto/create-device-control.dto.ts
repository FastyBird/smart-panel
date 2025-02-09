import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

import type { components } from '../../../openapi';

type CreateDeviceControl = components['schemas']['DevicesCreateDeviceControl'];

export class CreateDeviceControlDto implements CreateDeviceControl {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	readonly id?: string;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	readonly name: string;
}
