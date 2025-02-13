import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

type ReqUpdateDevice = components['schemas']['DevicesReqUpdateDevice'];
type UpdateDeviceBase = components['schemas']['DevicesUpdateDeviceBase'];
type UpdateThirdPartyDevice = components['schemas']['DevicesUpdateThirdPartyDevice'];

export abstract class UpdateDeviceDto implements UpdateDeviceBase {
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	name?: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@IsString({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	description?: string;
}

export class UpdateThirdPartyDeviceDto extends UpdateDeviceDto implements UpdateThirdPartyDevice {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	type: 'third-party';

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"service_address","reason":"Service address must be a valid string."}]' })
	@IsString({ message: '[{"field":"service_address","reason":"Service address must be a valid string."}]' })
	service_address?: string;
}

export class ReqUpdateDeviceDto implements ReqUpdateDevice {
	@Expose()
	@ValidateNested()
	@Type(() => UpdateThirdPartyDeviceDto)
	data: UpdateThirdPartyDeviceDto;
}
