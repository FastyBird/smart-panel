import { Expose } from 'class-transformer';
import { IsOptional, IsString, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreateDeviceDto } from '../../../modules/devices/dto/create-device.dto';
import { DEVICES_WLED_TYPE } from '../devices-wled.constants';

@ApiSchema({ name: 'DevicesWledPluginCreateDevice' })
export class CreateWledDeviceDto extends CreateDeviceDto {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_WLED_TYPE,
		example: DEVICES_WLED_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	readonly type: typeof DEVICES_WLED_TYPE;

	@ApiPropertyOptional({
		description: 'Device hostname or IP address',
		example: '192.168.1.100',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({
		message: '[{"field":"hostname","reason":"Hostname attribute must be a valid IP address or network hostname."}]',
	})
	@ValidateIf((_, value) => value !== null)
	hostname?: string | null;
}
