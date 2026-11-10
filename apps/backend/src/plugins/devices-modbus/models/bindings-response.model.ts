import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { ModbusBindingEntity } from '../entities/modbus-binding.entity';

@ApiSchema({ name: 'DevicesModbusPluginResBindings' })
export class ModbusBindingsResponseModel extends BaseSuccessResponseModel<ModbusBindingEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(ModbusBindingEntity) },
	})
	@Expose()
	declare data: ModbusBindingEntity[];
}
