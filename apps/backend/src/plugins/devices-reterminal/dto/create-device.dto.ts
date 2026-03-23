import { Expose } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreateDeviceDto } from '../../../modules/devices/dto/create-device.dto';
import { DEVICES_RETERMINAL_TYPE, ReTerminalVariant } from '../devices-reterminal.constants';

@ApiSchema({ name: 'DevicesReTerminalPluginCreateDevice' })
export class CreateReTerminalDeviceDto extends CreateDeviceDto {
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
	@IsEnum(ReTerminalVariant, {
		message: '[{"field":"variant","reason":"Variant must be a valid reTerminal hardware variant."}]',
	})
	variant?: ReTerminalVariant | null;
}
