import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../devices.constants';

/**
 * Device category enum schema
 */
@ApiSchema({ name: 'DevicesModuleDataDeviceCategory' })
export class DevicesModuleDeviceCategory {
	@ApiProperty({
		description: 'Device category',
		enum: DeviceCategory,
		example: DeviceCategory.GENERIC,
	})
	category: DeviceCategory;
}

/**
 * Channel category enum schema
 */
@ApiSchema({ name: 'DevicesModuleDataChannelCategory' })
export class DevicesModuleChannelCategory {
	@ApiProperty({
		description: 'Channel category',
		enum: ChannelCategory,
		example: ChannelCategory.GENERIC,
	})
	category: ChannelCategory;
}

/**
 * Channel property category enum schema
 */
@ApiSchema({ name: 'DevicesModuleDataChannelPropertyCategory' })
export class DevicesModuleChannelPropertyCategory {
	@ApiProperty({
		description: 'Channel property category',
		enum: PropertyCategory,
		example: PropertyCategory.GENERIC,
	})
	category: PropertyCategory;
}
