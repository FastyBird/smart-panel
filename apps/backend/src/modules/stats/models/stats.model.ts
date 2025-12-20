import { Expose } from 'class-transformer';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

/**
 * Model representing a single statistic value
 */
@ApiSchema({ name: 'StatsModuleDataStatsValue' })
export class StatsValueModel {
	@ApiProperty({
		description: 'The metric value; may be numeric or null when unavailable.',
		type: 'number',
		nullable: true,
		example: 42.7,
	})
	@Expose()
	@ValidateIf((o: StatsValueModel) => o.value !== null)
	@IsNumber()
	@IsOptional()
	value: number | null;

	@ApiProperty({
		description: 'ISO 8601 timestamp of the last metric update.',
		type: 'string',
		format: 'date-time',
		example: '2025-11-02T09:13:45.607Z',
	})
	@Expose({ name: 'last_updated' })
	@IsDateString()
	last_updated: string;
}

/**
 * Per-module metrics map (e.g., cpu_load_1m, req_per_min).
 */
@ApiSchema({
	name: 'StatsModuleDataModuleStats',
	description: 'Per-module metrics map (e.g., cpu_load_1m, req_per_min).',
})
export class ModuleStatsModel {
	// Dynamic properties representing module metrics
	// Example: cpu_load_1m: { value: 0.5, last_updated: '2025-11-02T09:13:45.607Z' }
	[key: string]: StatsValueModel;
}

/**
 * Stats grouped by module name. Known modules are listed, but additional modules are allowed.
 */
@ApiSchema({
	name: 'StatsModuleDataStats',
	description: 'Stats grouped by module name. Known modules are listed, but additional modules are allowed.',
})
export class StatsModel {
	@ApiPropertyOptional({
		description: 'WebSocket module statistics',
		type: 'object',
		additionalProperties: { $ref: getSchemaPath(StatsValueModel) },
	})
	@Expose({ name: 'websocket-module' })
	'websocket-module'?: ModuleStatsModel;

	@ApiPropertyOptional({
		description: 'System module statistics',
		type: 'object',
		additionalProperties: { $ref: getSchemaPath(StatsValueModel) },
	})
	@Expose({ name: 'system-module' })
	'system-module'?: ModuleStatsModel;

	@ApiPropertyOptional({
		description: 'API module statistics',
		type: 'object',
		additionalProperties: { $ref: getSchemaPath(StatsValueModel) },
	})
	@Expose({ name: 'api-module' })
	'api-module'?: ModuleStatsModel;

	@ApiPropertyOptional({
		description: 'Dashboard module statistics',
		type: 'object',
		additionalProperties: { $ref: getSchemaPath(StatsValueModel) },
	})
	@Expose({ name: 'dashboard-module' })
	'dashboard-module'?: ModuleStatsModel;

	@ApiPropertyOptional({
		description: 'Devices module statistics',
		type: 'object',
		additionalProperties: { $ref: getSchemaPath(StatsValueModel) },
	})
	@Expose({ name: 'devices-module' })
	'devices-module'?: ModuleStatsModel;

	@ApiPropertyOptional({
		description: 'Extensions module statistics (plugin services)',
		type: 'object',
		additionalProperties: { $ref: getSchemaPath(StatsValueModel) },
	})
	@Expose({ name: 'extensions-module' })
	'extensions-module'?: ModuleStatsModel;

	// Additional properties for other modules
	// Note: The index signature allows additional module properties
	// The OpenAPI schema will be generated with additionalProperties pointing to ModuleStatsModel
	[key: string]: ModuleStatsModel | undefined;
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
