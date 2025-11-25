import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DevicesShellyV1PluginShellyV1Probe' })
export class ShellyV1ProbeDto {
	@ApiProperty({
		description: 'Shelly device host (IP address or hostname)',
		example: '192.168.1.100',
	})
	@Expose()
	@IsString({
		message: '[{"field":"host","reason":"Host attribute must be a valid IP address or hostname."}]',
	})
	host: string;

	@ApiPropertyOptional({
		description: 'Shelly device authentication password',
		example: 'admin123',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"password","reason":"Password attribute must be a valid string."}]' })
	password?: string | null = null;
}
