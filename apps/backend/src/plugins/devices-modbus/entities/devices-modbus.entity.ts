import { Expose } from 'class-transformer';
import { ChildEntity } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_MODBUS_TYPE } from '../devices-modbus.constants';

@ApiSchema({ name: 'DevicesModbusPluginDataDevice' })
@ChildEntity()
export class ModbusDeviceEntity extends DeviceEntity {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_MODBUS_TYPE,
		example: DEVICES_MODBUS_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_MODBUS_TYPE;
	}
}

@ApiSchema({ name: 'DevicesModbusPluginDataChannel' })
@ChildEntity()
export class ModbusChannelEntity extends ChannelEntity {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_MODBUS_TYPE,
		example: DEVICES_MODBUS_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_MODBUS_TYPE;
	}
}

@ApiSchema({ name: 'DevicesModbusPluginDataChannelProperty' })
@ChildEntity()
export class ModbusChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_MODBUS_TYPE,
		example: DEVICES_MODBUS_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_MODBUS_TYPE;
	}
}
