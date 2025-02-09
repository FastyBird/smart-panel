import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

import type { components } from '../../../openapi';

type CreateChannelControl = components['schemas']['DevicesCreateChannelControl'];

export class CreateDeviceChannelControlDto implements CreateChannelControl {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	name: string;
}
