import { Expose } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DevicesHomeAssistantPluginDiscoveredInstance' })
export class DiscoveredInstanceModel {
	@ApiProperty({
		description: 'Hostname or IP address of the Home Assistant instance',
		type: 'string',
		example: '192.168.1.100',
	})
	@Expose()
	@IsString()
	hostname!: string;

	@ApiProperty({
		description: 'Port number',
		type: 'number',
		example: 8123,
	})
	@Expose()
	@IsNumber()
	port!: number;

	@ApiProperty({
		description: 'Instance name (from mDNS)',
		type: 'string',
		example: 'Home Assistant',
	})
	@Expose()
	@IsString()
	name!: string;

	@ApiPropertyOptional({
		description: 'Home Assistant version (if available)',
		type: 'string',
		example: '2024.1.0',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	version?: string;

	@ApiPropertyOptional({
		description: 'Instance UUID (if available)',
		type: 'string',
		example: 'abc123-def456',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	uuid?: string;
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginDiscoveredInstancesResponse' })
export class DiscoveredInstancesResponseModel {
	@ApiProperty({
		description: 'List of discovered Home Assistant instances',
		type: [DiscoveredInstanceModel],
	})
	@Expose()
	data!: DiscoveredInstanceModel[];
}
