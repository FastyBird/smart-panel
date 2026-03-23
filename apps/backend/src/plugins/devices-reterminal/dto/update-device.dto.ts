import { Expose } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';
import { DEVICES_RETERMINAL_TYPE, ReTerminalVariant } from '../devices-reterminal.constants';

@ApiSchema({ name: 'DevicesReTerminalPluginUpdateDevice' })
export class UpdateReTerminalDeviceDto extends UpdateDeviceDto {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_RETERMINAL_TYPE,
		example: DEVICES_RETERMINAL_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	readonly type: typeof DEVICES_RETERMINAL_TYPE;

	@ApiPropertyOptional({
		description: 'Hardware variant (reterminal or reterminal_dm)',
		enum: ReTerminalVariant,
		example: ReTerminalVariant.RETERMINAL,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsEnum(ReTerminalVariant)
	variant?: ReTerminalVariant | null;
}
