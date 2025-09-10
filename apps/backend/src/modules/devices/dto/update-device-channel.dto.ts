import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

type ReqUpdateDeviceChannel = components['schemas']['DevicesModuleReqUpdateChannel'];
type UpdateChannel = components['schemas']['DevicesModuleUpdateChannel'];

export class UpdateDeviceChannelDto implements UpdateChannel {
	@Expose()
	@IsNotEmpty({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported channel type."}]',
	})
	@IsString({
		message: '[{"field":"type","reason":"Type must be a valid string representing a supported channel type."}]',
	})
	type: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({
		message:
			'[{"field":"identifier","reason":"Identifier must be a valid string representing channel unique identifier."}]',
	})
	@IsString({
		message:
			'[{"field":"identifier","reason":"Identifier must be a valid string representing channel unique identifier."}]',
	})
	@ValidateIf((_, value) => value !== null)
	identifier?: string | null;

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

	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled attribute must be a valid true or false."}]' })
	enabled?: boolean;
}

export class ReqUpdateDeviceChannelDto implements ReqUpdateDeviceChannel {
	@Expose()
	@ValidateNested()
	@Type(() => UpdateDeviceChannelDto)
	data: UpdateDeviceChannelDto;
}
