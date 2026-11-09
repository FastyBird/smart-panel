import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { DEVICES_MODBUS_PLUGIN_NAME } from '../devices-modbus.constants';

@ApiSchema({ name: 'DevicesModbusPluginDataConfig' })
export class ModbusConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_MODBUS_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = DEVICES_MODBUS_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
