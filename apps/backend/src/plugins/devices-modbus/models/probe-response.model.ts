import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

import { ModbusProbePointsModel, ModbusProbeReadModel, ModbusProbeWriteModel } from './probe.model';

@ApiSchema({ name: 'DevicesModbusPluginResProbeRead' })
export class ModbusProbeReadResponseModel extends BaseSuccessResponseModel<ModbusProbeReadModel> {
	@ApiProperty({ description: 'The actual data payload returned by the API', type: () => ModbusProbeReadModel })
	@Expose()
	declare data: ModbusProbeReadModel;
}

@ApiSchema({ name: 'DevicesModbusPluginResProbePoints' })
export class ModbusProbePointsResponseModel extends BaseSuccessResponseModel<ModbusProbePointsModel> {
	@ApiProperty({ description: 'The actual data payload returned by the API', type: () => ModbusProbePointsModel })
	@Expose()
	declare data: ModbusProbePointsModel;
}

@ApiSchema({ name: 'DevicesModbusPluginResProbeWrite' })
export class ModbusProbeWriteResponseModel extends BaseSuccessResponseModel<ModbusProbeWriteModel> {
	@ApiProperty({ description: 'The actual data payload returned by the API', type: () => ModbusProbeWriteModel })
	@Expose()
	declare data: ModbusProbeWriteModel;
}
