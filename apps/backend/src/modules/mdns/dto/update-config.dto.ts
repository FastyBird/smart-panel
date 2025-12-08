import { Expose } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { MDNS_MODULE_NAME } from '../mdns.constants';

@ApiSchema({ name: 'ConfigModuleUpdateMdns' })
export class UpdateMdnsConfigDto extends UpdateModuleConfigDto {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'mdns',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = MDNS_MODULE_NAME;

	@ApiPropertyOptional({
		description: 'Enable or disable mDNS service advertisement.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean value."}]' })
	enabled?: boolean;

	@ApiPropertyOptional({
		name: 'service_name',
		description: 'mDNS service name to advertise.',
		type: 'string',
		example: 'FastyBird Smart Panel',
	})
	@Expose({ name: 'service_name' })
	@IsOptional()
	@IsString({ message: '[{"field":"service_name","reason":"Service name must be a valid string."}]' })
	service_name?: string;

	@ApiPropertyOptional({
		name: 'service_type',
		description: 'mDNS service type identifier.',
		type: 'string',
		example: 'fastybird-panel',
	})
	@Expose({ name: 'service_type' })
	@IsOptional()
	@IsString({ message: '[{"field":"service_type","reason":"Service type must be a valid string."}]' })
	service_type?: string;
}
