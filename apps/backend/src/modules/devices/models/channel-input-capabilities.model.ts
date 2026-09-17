import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { ChannelCategory, DataTypeType, PermissionType, PropertyCategory } from '../devices.constants';

/**
 * Capability descriptor for an individual input property
 */
@ApiSchema({ name: 'DevicesModuleDataChannelInputPropertyCapability' })
export class ChannelInputPropertyCapabilityModel {
	@ApiProperty({ description: 'Property unique identifier', format: 'uuid' })
	@Expose()
	id: string;

	@ApiProperty({ description: 'Property category', enum: PropertyCategory })
	@Expose()
	category: PropertyCategory;

	@ApiProperty({ description: 'Property permissions', enum: PermissionType, isArray: true })
	@Expose()
	permissions: PermissionType[];

	@ApiProperty({ description: 'Property data type', enum: DataTypeType })
	@Expose()
	data_type: DataTypeType;

	@ApiProperty({
		description: 'Permitted format values or enum options (null if unbounded)',
		type: 'array',
		items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
		nullable: true,
	})
	@Expose()
	format: string[] | number[] | null;
}

/**
 * Channel input capability descriptor
 */
@ApiSchema({ name: 'DevicesModuleDataChannelInputCapabilities' })
export class ChannelInputCapabilitiesModel {
	@ApiProperty({ description: 'Channel unique identifier', format: 'uuid' })
	@Expose()
	channel_id: string;

	@ApiProperty({ description: 'Associated device unique identifier', format: 'uuid' })
	@Expose()
	device_id: string;

	@ApiProperty({ description: 'Channel category', enum: ChannelCategory })
	@Expose()
	category: ChannelCategory;

	@ApiProperty({ description: 'Whether this channel is recognized as a hardware input source', type: 'boolean' })
	@Expose()
	is_input: boolean;

	@ApiProperty({
		description: 'Supported interaction events (e.g. press, double_press, long_press, down, up)',
		type: 'array',
		items: { type: 'string' },
	})
	@Expose()
	supported_events: string[];

	@ApiProperty({
		description: 'Input properties exposed by this channel',
		type: () => [ChannelInputPropertyCapabilityModel],
	})
	@Expose()
	@Type(() => ChannelInputPropertyCapabilityModel)
	properties: ChannelInputPropertyCapabilityModel[];
}

/**
 * Response wrapper for channel input capabilities
 */
@ApiSchema({ name: 'DevicesModuleResChannelInputCapabilities' })
export class ChannelInputCapabilitiesResponseModel extends BaseSuccessResponseModel<ChannelInputCapabilitiesModel> {
	@ApiProperty({
		description: 'The channel input capabilities',
		type: () => ChannelInputCapabilitiesModel,
	})
	@Expose()
	declare data: ChannelInputCapabilitiesModel;
}
