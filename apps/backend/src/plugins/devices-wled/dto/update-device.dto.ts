import { Expose } from 'class-transformer';
import { IsOptional, IsString, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';
import { DEVICES_WLED_TYPE } from '../devices-wled.constants';

@ApiSchema({ name: 'DevicesWledPluginUpdateDevice' })
export class UpdateWledDeviceDto extends UpdateDeviceDto {
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
	@IsString()
	@ValidateIf((_, value) => value !== null)
	hostname?: string | null;
}
