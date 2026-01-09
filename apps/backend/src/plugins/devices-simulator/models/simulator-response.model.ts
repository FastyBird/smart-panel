import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

/**
 * Response wrapper for generated simulator device
 */
@ApiSchema({ name: 'DevicesSimulatorPluginResGeneratedDevice' })
export class GeneratedDeviceResponseModel extends BaseSuccessResponseModel<DeviceEntity> {
	@ApiProperty({
		description: 'The generated device data',
		type: () => DeviceEntity,
	})
	@Expose()
	declare data: DeviceEntity;
}

/**
 * Available device category model
 */
@ApiSchema({ name: 'DevicesSimulatorPluginDeviceCategory' })
export class DeviceCategoryModel {
	@ApiProperty({
		description: 'Category identifier',
		type: 'string',
		example: 'lighting',
	})
	@Expose()
	category: string;

	@ApiProperty({
		description: 'Human-readable category name',
		type: 'string',
		example: 'Lighting',
	})
	@Expose()
	name: string;

	@ApiProperty({
		description: 'Category description',
		type: 'string',
		example: 'Lighting devices like bulbs, strips, etc.',
	})
	@Expose()
	description: string;
}

/**
 * Response wrapper for available device categories
 */
@ApiSchema({ name: 'DevicesSimulatorPluginResDeviceCategories' })
export class DeviceCategoriesResponseModel extends BaseSuccessResponseModel<DeviceCategoryModel[]> {
	@ApiProperty({
		description: 'List of available device categories',
		type: 'array',
		items: { type: 'object' },
	})
	@Expose()
	declare data: DeviceCategoryModel[];
}

/**
 * Simulated value result model
 */
@ApiSchema({ name: 'DevicesSimulatorPluginSimulatedValueResult' })
export class SimulatedValueResultModel {
	@ApiProperty({
		description: 'Property ID that was updated',
		name: 'property_id',
		type: 'string',
		format: 'uuid',
	})
	@Expose()
	property_id: string;

	@ApiProperty({
		description: 'New value that was set',
		type: 'string',
	})
	@Expose()
	value: string | number | boolean;

	@ApiProperty({
		description: 'Whether the update was successful',
		type: 'boolean',
	})
	@Expose()
	success: boolean;
}

/**
 * Response wrapper for simulated value
 */
@ApiSchema({ name: 'DevicesSimulatorPluginResSimulatedValue' })
export class SimulatedValueResponseModel extends BaseSuccessResponseModel<SimulatedValueResultModel> {
	@ApiProperty({
		description: 'Simulation result',
		type: () => SimulatedValueResultModel,
	})
	@Expose()
	declare data: SimulatedValueResultModel;
}

/**
 * Connection state simulation result
 */
@ApiSchema({ name: 'DevicesSimulatorPluginConnectionStateResult' })
export class ConnectionStateResultModel {
	@ApiProperty({
		description: 'Device ID',
		name: 'device_id',
		type: 'string',
		format: 'uuid',
	})
	@Expose()
	device_id: string;

	@ApiProperty({
		description: 'Connection state that was set',
		type: 'string',
	})
	@Expose()
	state: string;

	@ApiProperty({
		description: 'Whether the state change was successful',
		type: 'boolean',
	})
	@Expose()
	success: boolean;
}

/**
 * Response wrapper for connection state simulation
 */
@ApiSchema({ name: 'DevicesSimulatorPluginResConnectionState' })
export class ConnectionStateResponseModel extends BaseSuccessResponseModel<ConnectionStateResultModel> {
	@ApiProperty({
		description: 'Connection state simulation result',
		type: () => ConnectionStateResultModel,
	})
	@Expose()
	declare data: ConnectionStateResultModel;
}
