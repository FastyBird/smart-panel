import { Expose, Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DevicesShellyV1PluginGetInfo' })
export class DevicesShellyV1PluginGetInfo {
	@ApiProperty({
		description: 'Device hostname or IP address',
		example: '192.168.1.100',
	})
	@Expose()
	@IsString({
		message: '[{"field":"hostname","reason":"Hostname attribute must be a valid IP address or network hostname."}]',
	})
	hostname: string;

	@ApiPropertyOptional({
		description: 'Device password',
		example: 'admin123',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"password","reason":"Password attribute must be a valid string."}]' })
	password?: string | null = null;
}

@ApiSchema({ name: 'DevicesShellyV1PluginReqGetInfo' })
export class DevicesShellyV1PluginReqGetInfo {
	@ApiProperty({
		description: 'Device info request data',
		type: () => DevicesShellyV1PluginGetInfo,
	})
	@Expose()
	@ValidateNested()
	@Type(() => DevicesShellyV1PluginGetInfo)
	data: DevicesShellyV1PluginGetInfo;
}
