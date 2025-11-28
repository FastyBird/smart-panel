import { Expose } from 'class-transformer';
import { IsArray, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

/**
 * Model representing all available statistics as a dynamic object
 * where keys are stat names and values are stat data
 */
@ApiSchema({ name: 'StatsModuleDataAllStats' })
export class AllStatsModel {
	// Dynamic properties representing statistics
	// Example: cpu_usage: { value: 45.2, timestamp: '2024-01-15T10:30:00Z' }
	[key: string]: unknown;
}

/**
 * Model representing a single statistic value
 * Structure varies based on the specific statistic
 */
@ApiSchema({ name: 'StatsModuleDataStat' })
export class StatModel {
	// Dynamic properties representing statistic data
	// Example: value: 45.2, timestamp: '2024-01-15T10:30:00Z'
	[key: string]: unknown;
}

/**
 * Model representing the list of available statistic keys
 */
@ApiSchema({ name: 'StatsModuleDataStatsKeys' })
export class StatsKeysModel {
	@ApiProperty({
		description: 'List of available statistic keys',
		example: ['cpu_usage', 'memory_usage', 'disk_usage', 'network_traffic'],
		type: 'array',
		items: { type: 'string' },
	})
	@Expose()
	@IsArray()
	@IsString({ each: true })
	keys: string[];
}
