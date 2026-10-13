import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { VirtualDeviceEntity } from '../entities/devices-virtual.entity';

import { VirtualAggregateConfigurationModel } from './producer-response.model';
import { VirtualTransformConfigurationModel } from './transform-response.model';

@ApiSchema({ name: 'DevicesVirtualPluginDataCreatedAggregate' })
export class VirtualCreatedAggregateModel {
	@ApiProperty({ description: 'Atomically created device', type: VirtualDeviceEntity })
	@Expose()
	@Type(() => VirtualDeviceEntity)
	device: VirtualDeviceEntity;

	@ApiProperty({ description: 'Committed configuration', type: VirtualAggregateConfigurationModel })
	@Expose()
	@Type(() => VirtualAggregateConfigurationModel)
	configuration: VirtualAggregateConfigurationModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataCreatedTransform' })
export class VirtualCreatedTransformModel {
	@ApiProperty({ description: 'Atomically created device', type: VirtualDeviceEntity })
	@Expose()
	@Type(() => VirtualDeviceEntity)
	device: VirtualDeviceEntity;

	@ApiProperty({ description: 'Committed configuration', type: VirtualTransformConfigurationModel })
	@Expose()
	@Type(() => VirtualTransformConfigurationModel)
	configuration: VirtualTransformConfigurationModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginResCreatedAggregate' })
export class VirtualCreatedAggregateResponseModel extends BaseSuccessResponseModel<VirtualCreatedAggregateModel> {
	@ApiProperty({
		description: 'Created aggregate',
		type: 'object',
		additionalProperties: false,
		allOf: [{ $ref: getSchemaPath(VirtualCreatedAggregateModel) }],
	})
	@Expose()
	@Type(() => VirtualCreatedAggregateModel)
	declare data: VirtualCreatedAggregateModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginResCreatedTransform' })
export class VirtualCreatedTransformResponseModel extends BaseSuccessResponseModel<VirtualCreatedTransformModel> {
	@ApiProperty({
		description: 'Created transform',
		type: 'object',
		additionalProperties: false,
		allOf: [{ $ref: getSchemaPath(VirtualCreatedTransformModel) }],
	})
	@Expose()
	@Type(() => VirtualCreatedTransformModel)
	declare data: VirtualCreatedTransformModel;
}
