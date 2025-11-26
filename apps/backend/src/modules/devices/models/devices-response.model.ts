import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../common/dto/response.dto';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../entities/devices.entity';

import { PropertyTimeseriesModel } from './devices.model';

/**
 * Response wrapper for DeviceEntity
 */
@ApiSchema({ name: 'DevicesModuleResDevice' })
export class DeviceResponseModel extends BaseSuccessResponseModel<DeviceEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => DeviceEntity,
	})
	@Expose()
	@Type(() => DeviceEntity)
	data: DeviceEntity;
}

/**
 * Response wrapper for array of DeviceEntity
 */
@ApiSchema({ name: 'DevicesModuleResDevices' })
export class DevicesResponseModel extends BaseSuccessResponseModel<DeviceEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(DeviceEntity) },
	})
	@Expose()
	@Type(() => DeviceEntity)
	data: DeviceEntity[];
}

/**
 * Response wrapper for ChannelEntity
 */
@ApiSchema({ name: 'DevicesModuleResChannel' })
export class ChannelResponseModel extends BaseSuccessResponseModel<ChannelEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => ChannelEntity,
	})
	@Expose()
	@Type(() => ChannelEntity)
	data: ChannelEntity;
}

/**
 * Response wrapper for array of ChannelEntity
 */
@ApiSchema({ name: 'DevicesModuleResChannels' })
export class ChannelsResponseModel extends BaseSuccessResponseModel<ChannelEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(ChannelEntity) },
	})
	@Expose()
	@Type(() => ChannelEntity)
	data: ChannelEntity[];
}

/**
 * Response wrapper for DeviceEntity with channel (nested)
 */
@ApiSchema({ name: 'DevicesModuleResDeviceChannel' })
export class DeviceChannelResponseModel extends BaseSuccessResponseModel<ChannelEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => ChannelEntity,
	})
	@Expose()
	@Type(() => ChannelEntity)
	data: ChannelEntity;
}

/**
 * Response wrapper for array of ChannelEntity (device channels)
 */
@ApiSchema({ name: 'DevicesModuleResDeviceChannels' })
export class DeviceChannelsResponseModel extends BaseSuccessResponseModel<ChannelEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(ChannelEntity) },
	})
	@Expose()
	@Type(() => ChannelEntity)
	data: ChannelEntity[];
}

/**
 * Response wrapper for ChannelPropertyEntity
 */
@ApiSchema({ name: 'DevicesModuleResChannelProperty' })
export class ChannelPropertyResponseModel extends BaseSuccessResponseModel<ChannelPropertyEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => ChannelPropertyEntity,
	})
	@Expose()
	@Type(() => ChannelPropertyEntity)
	data: ChannelPropertyEntity;
}

/**
 * Response wrapper for array of ChannelPropertyEntity
 */
@ApiSchema({ name: 'DevicesModuleResChannelProperties' })
export class ChannelPropertiesResponseModel extends BaseSuccessResponseModel<ChannelPropertyEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(ChannelPropertyEntity) },
	})
	@Expose()
	@Type(() => ChannelPropertyEntity)
	data: ChannelPropertyEntity[];
}

/**
 * Response wrapper for DeviceControlEntity
 */
@ApiSchema({ name: 'DevicesModuleResDeviceControl' })
export class DeviceControlResponseModel extends BaseSuccessResponseModel<DeviceControlEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => DeviceControlEntity,
	})
	@Expose()
	@Type(() => DeviceControlEntity)
	data: DeviceControlEntity;
}

/**
 * Response wrapper for array of DeviceControlEntity
 */
@ApiSchema({ name: 'DevicesModuleResDeviceControls' })
export class DeviceControlsResponseModel extends BaseSuccessResponseModel<DeviceControlEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(DeviceControlEntity) },
	})
	@Expose()
	@Type(() => DeviceControlEntity)
	data: DeviceControlEntity[];
}

/**
 * Response wrapper for ChannelControlEntity
 */
@ApiSchema({ name: 'DevicesModuleResChannelControl' })
export class ChannelControlResponseModel extends BaseSuccessResponseModel<ChannelControlEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => ChannelControlEntity,
	})
	@Expose()
	@Type(() => ChannelControlEntity)
	data: ChannelControlEntity;
}

/**
 * Response wrapper for array of ChannelControlEntity
 */
@ApiSchema({ name: 'DevicesModuleResChannelControls' })
export class ChannelControlsResponseModel extends BaseSuccessResponseModel<ChannelControlEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(ChannelControlEntity) },
	})
	@Expose()
	@Type(() => ChannelControlEntity)
	data: ChannelControlEntity[];
}

/**
 * Response wrapper for PropertyTimeseriesModel
 */
@ApiSchema({ name: 'DevicesModuleResPropertyTimeseries' })
export class PropertyTimeseriesResponseModel extends BaseSuccessResponseModel<PropertyTimeseriesModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => PropertyTimeseriesModel,
	})
	@Expose()
	@Type(() => PropertyTimeseriesModel)
	data: PropertyTimeseriesModel;
}
