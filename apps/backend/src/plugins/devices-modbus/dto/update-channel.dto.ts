import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateChannelDto } from '../../../modules/devices/dto/update-channel.dto';
import { DEVICES_MODBUS_TYPE } from '../devices-modbus.constants';

@ApiSchema({ name: 'DevicesModbusPluginUpdateChannel' })
export class UpdateModbusChannelDto extends UpdateChannelDto {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_MODBUS_TYPE,
		example: DEVICES_MODBUS_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	type: typeof DEVICES_MODBUS_TYPE;
}
