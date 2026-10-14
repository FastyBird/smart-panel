import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { VirtualDeviceEntity } from '../entities/devices-virtual.entity';

import { VirtualThermostatConfigurationModel } from './thermostat-response.model';

@ApiSchema({ name: 'DevicesVirtualPluginDataCreatedThermostat' })
export class VirtualCreatedThermostatModel {
	@ApiProperty({ description: 'Atomically created thermostat device', type: VirtualDeviceEntity })
	@Expose()
	@Type(() => VirtualDeviceEntity)
	device: VirtualDeviceEntity;

	@ApiProperty({
		description: 'Committed or proposed thermostat configuration',
		type: VirtualThermostatConfigurationModel,
	})
	@Expose()
	@Type(() => VirtualThermostatConfigurationModel)
	configuration: VirtualThermostatConfigurationModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginResCreatedThermostat' })
export class VirtualCreatedThermostatResponseModel extends BaseSuccessResponseModel<VirtualCreatedThermostatModel> {
	@ApiProperty({
		description: 'Created thermostat and configuration',
		allOf: [{ $ref: getSchemaPath(VirtualCreatedThermostatModel) }],
	})
	@Expose()
	@Type(() => VirtualCreatedThermostatModel)
	declare data: VirtualCreatedThermostatModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatPropertyBinding' })
export class VirtualThermostatPropertyBindingModel {
	@ApiProperty({ description: 'Bound property UUID', format: 'uuid' })
	@Expose()
	property: string;

	@ApiProperty({ description: 'Owning channel UUID', format: 'uuid' })
	@Expose()
	channel: string;

	@ApiProperty({ description: 'Owning device UUID', format: 'uuid' })
	@Expose()
	device: string;
}

@ApiSchema({ name: 'DevicesVirtualPluginResThermostatPropertyBinding' })
export class VirtualThermostatPropertyBindingResponseModel extends BaseSuccessResponseModel<VirtualThermostatPropertyBindingModel> {
	@ApiProperty({ type: VirtualThermostatPropertyBindingModel })
	@Expose()
	@Type(() => VirtualThermostatPropertyBindingModel)
	declare data: VirtualThermostatPropertyBindingModel;
}
