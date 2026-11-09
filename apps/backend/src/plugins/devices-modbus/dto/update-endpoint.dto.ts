import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema, PartialType } from '@nestjs/swagger';

import { CreateModbusEndpointDto } from './create-endpoint.dto';

@ApiSchema({ name: 'DevicesModbusPluginUpdateEndpoint' })
export class UpdateModbusEndpointDto extends PartialType(CreateModbusEndpointDto) {}

@ApiSchema({ name: 'DevicesModbusPluginReqUpdateEndpoint' })
export class ReqUpdateModbusEndpointDto {
	@ApiProperty({ description: 'Endpoint data', type: () => UpdateModbusEndpointDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateModbusEndpointDto)
	data: UpdateModbusEndpointDto;
}
