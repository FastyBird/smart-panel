import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

/**
 * Response wrapper for generated simulator device
 */
@ApiSchema({ name: 'SimulatorPluginResGeneratedDevice' })
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
@ApiSchema({ name: 'SimulatorPluginDataDeviceCategory' })
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
@ApiSchema({ name: 'SimulatorPluginResDeviceCategories' })
export class DeviceCategoriesResponseModel extends BaseSuccessResponseModel<DeviceCategoryModel[]> {
	@ApiProperty({
		description: 'List of available device categories',
		type: 'array',
		items: { type: 'object' },
	})
	@Expose()
	@Type(() => DeviceCategoryModel)
	declare data: DeviceCategoryModel[];
}

/**
 * Simulated value result model
 */
@ApiSchema({ name: 'SimulatorPluginDataSimulatedValueResult' })
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
@ApiSchema({ name: 'SimulatorPluginResSimulatedValue' })
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
@ApiSchema({ name: 'SimulatorPluginDataConnectionStateResult' })
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
@ApiSchema({ name: 'SimulatorPluginResConnectionState' })
export class ConnectionStateResponseModel extends BaseSuccessResponseModel<ConnectionStateResultModel> {
	@ApiProperty({
		description: 'Connection state simulation result',
		type: () => ConnectionStateResultModel,
	})
	@Expose()
	declare data: ConnectionStateResultModel;
}

/**
 * Simulated occurrence result model
 */
@ApiSchema({ name: 'SimulatorPluginDataSimulatedOccurrenceResult' })
export class SimulatedOccurrenceResultModel {
	@ApiProperty({
		description: 'Generated occurrence ID (or null if dropped by deduplication / disabled device)',
		name: 'occurrence_id',
		type: 'string',
		format: 'uuid',
		nullable: true,
	})
	@Expose()
	occurrence_id: string | null;

	@ApiProperty({
		description: 'Channel ID',
		name: 'channel_id',
		type: 'string',
		format: 'uuid',
	})
	@Expose()
	channel_id: string;

	@ApiProperty({
		description: 'Property ID',
		name: 'property_id',
		type: 'string',
		format: 'uuid',
	})
	@Expose()
	property_id: string;

	@ApiProperty({
		description: 'Normalized input event',
		type: 'string',
	})
	@Expose()
	event: string;

	@ApiProperty({
		description: 'ISO timestamp of occurrence emission',
		type: 'string',
	})
	@Expose()
	timestamp: string;

	@ApiProperty({
		description: 'Whether the occurrence was dropped by deduplication',
		type: 'boolean',
	})
	@Expose()
	dropped: boolean;

	@ApiProperty({
		description: 'Whether the simulation was successful',
		type: 'boolean',
	})
	@Expose()
	success: boolean;
}

/**
 * Response wrapper for simulated occurrence
 */
@ApiSchema({ name: 'SimulatorPluginResSimulatedOccurrence' })
export class SimulatedOccurrenceResponseModel extends BaseSuccessResponseModel<SimulatedOccurrenceResultModel> {
	@ApiProperty({
		description: 'Occurrence simulation result',
		type: () => SimulatedOccurrenceResultModel,
	})
	@Expose()
	declare data: SimulatedOccurrenceResultModel;
}
