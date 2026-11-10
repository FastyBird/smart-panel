import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { ModbusEndpointEntity } from '../entities/modbus-endpoint.entity';

@ApiSchema({ name: 'DevicesModbusPluginResEndpoint' })
export class ModbusEndpointResponseModel extends BaseSuccessResponseModel<ModbusEndpointEntity> {
	@ApiProperty({ description: 'The actual data payload returned by the API', type: () => ModbusEndpointEntity })
	@Expose()
	declare data: ModbusEndpointEntity;
}

@ApiSchema({ name: 'DevicesModbusPluginResEndpoints' })
export class ModbusEndpointsResponseModel extends BaseSuccessResponseModel<ModbusEndpointEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(ModbusEndpointEntity) },
	})
	@Expose()
	declare data: ModbusEndpointEntity[];
}
