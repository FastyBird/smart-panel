import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { ModbusDeviceEntity } from '../entities/devices-modbus.entity';

@ApiSchema({ name: 'DevicesModbusPluginResDevice' })
export class ModbusDeviceResponseModel extends BaseSuccessResponseModel<ModbusDeviceEntity> {
	@ApiProperty({ description: 'The actual data payload returned by the API', type: () => ModbusDeviceEntity })
	@Expose()
	declare data: ModbusDeviceEntity;
}
