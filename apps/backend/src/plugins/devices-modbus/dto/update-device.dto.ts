import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateDeviceDto } from '../../../modules/devices/dto/update-device.dto';
import { DEVICES_MODBUS_TYPE } from '../devices-modbus.constants';

@ApiSchema({ name: 'DevicesModbusPluginUpdateDevice' })
export class UpdateModbusDeviceDto extends UpdateDeviceDto {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_MODBUS_TYPE,
		example: DEVICES_MODBUS_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	type: typeof DEVICES_MODBUS_TYPE;
}
