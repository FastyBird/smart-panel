import { Expose } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

/**
 * Model representing a discovered WLED device that hasn't been added yet
 */
@ApiSchema({ name: 'DevicesWledPluginDataDiscoveredDevice' })
export class WledDiscoveredDeviceModel {
	@ApiProperty({
		description: 'Device hostname or IP address',
		example: '192.168.1.100',
	})
	@Expose()
	@IsString()
	host: string;

	@ApiProperty({
		description: 'Device name advertised via mDNS',
		example: 'WLED-Living-Room',
	})
	@Expose()
	@IsString()
	name: string;

	@ApiPropertyOptional({
		description: 'Device MAC address (if available)',
		example: 'AA:BB:CC:DD:EE:FF',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	mac?: string | null;

	@ApiProperty({
		description: 'Device port',
		example: 80,
	})
	@Expose()
	@IsNumber()
	port: number;
}

/**
 * Response wrapper for array of discovered WLED devices
 */
@ApiSchema({ name: 'DevicesWledPluginResDiscoveredDevices' })
export class WledDiscoveredDevicesResponseModel extends BaseSuccessResponseModel<WledDiscoveredDeviceModel[]> {
	@ApiProperty({
		description: 'List of discovered WLED devices not yet added to the system',
		type: 'array',
		items: { $ref: getSchemaPath(WledDiscoveredDeviceModel) },
	})
	@Expose()
	declare data: WledDiscoveredDeviceModel[];
}
