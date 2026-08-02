import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

/**
 * Response wrapper for the distinct physical devices behind a virtual device.
 */
@ApiSchema({ name: 'DevicesVirtualPluginResSourceDevices' })
export class VirtualSourceDevicesResponseModel extends BaseSuccessResponseModel<DeviceEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(DeviceEntity) },
	})
	@Expose()
	declare data: DeviceEntity[];
}
