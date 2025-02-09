import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

import type { components } from '../../../openapi';

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
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"service_address","reason":"Service address must be a valid string."}]' })
	@IsString({ message: '[{"field":"service_address","reason":"Service address must be a valid string."}]' })
	service_address?: string;
}
