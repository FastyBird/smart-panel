import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateDeviceDto } from '../../../modules/devices/dto/create-device.dto';
import { DEVICES_MODBUS_TYPE } from '../devices-modbus.constants';

@ApiSchema({ name: 'DevicesModbusPluginCreateDevice' })
export class CreateModbusDeviceDto extends CreateDeviceDto {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_MODBUS_TYPE,
		example: DEVICES_MODBUS_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid device type string."}]' })
	readonly type: typeof DEVICES_MODBUS_TYPE;
}
