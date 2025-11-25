import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

import { ApiSchema } from '../../../common/decorators/api-schema.decorator';

@ApiSchema('DevicesHomeAssistantPluginHomeAssistantDiscoveredDevice')
export class HomeAssistantDiscoveredDeviceDto {
	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Device identifier',
		example: 'device_001',
	})
	id: string;

	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Device name',
		example: 'Living Room Lights',
	})
	name: string;

	@Expose()
	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	@ApiProperty({
		description: 'List of Home Assistant entity IDs associated with this device',
		example: ['light.living_room', 'switch.living_room_fan'],
		isArray: true,
		type: String,
	})
	entities: string[];
}
