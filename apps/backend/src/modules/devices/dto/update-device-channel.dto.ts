import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

type ReqUpdateDeviceChannel = components['schemas']['DevicesModuleReqUpdateChannel'];
type UpdateChannel = components['schemas']['DevicesModuleUpdateChannel'];

export class UpdateDeviceChannelDto implements UpdateChannel {
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	name?: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@IsString({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	description?: string | null;
}

export class ReqUpdateDeviceChannelDto implements ReqUpdateDeviceChannel {
	@Expose()
	@ValidateNested()
	@Type(() => UpdateDeviceChannelDto)
	data: UpdateDeviceChannelDto;
}
