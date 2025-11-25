import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DevicesHomeAssistantPluginServiceRequest' })
export class ServiceRequestDto {
	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Home Assistant entity ID',
		example: 'light.living_room',
		name: 'entity_id',
	})
	entity_id: string;

	[key: string]: unknown; // Dynamic properties like brightness, color_temp, etc.
}
