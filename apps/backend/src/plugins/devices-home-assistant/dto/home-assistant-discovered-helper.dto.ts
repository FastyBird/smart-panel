import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataDiscoveredHelper' })
export class HomeAssistantDiscoveredHelperDto {
	@ApiProperty({
		name: 'entity_id',
		description: 'Home Assistant entity ID',
		type: 'string',
		example: 'input_boolean.my_helper',
	})
	@Expose({ name: 'entity_id' })
	@IsString()
	entity_id: string;

	@ApiProperty({
		description: 'Helper name',
		type: 'string',
		example: 'My Helper',
	})
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({
		description: 'Home Assistant domain',
		type: 'string',
		example: 'input_boolean',
	})
	@Expose()
	@IsString()
	domain: string;
}
