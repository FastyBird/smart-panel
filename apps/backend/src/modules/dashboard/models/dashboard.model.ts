import { Expose, Transform, Type } from 'class-transformer';
import { IsDate, IsNumber, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DashboardModuleDataRegisteredPages' })
export class RegisteredPagesModel {
	@ApiProperty({ description: 'Number of registered pages', type: 'number', example: 5 })
	@Expose()
	@IsNumber()
	value: number;

	@ApiProperty({
		name: 'last_updated',
		description: 'Last update timestamp',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
	})
	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_updated?: string | Date; lastUpdated?: string | Date } }) => {
			const value: string | Date = obj.last_updated || obj.lastUpdated;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

@ApiSchema({ name: 'DashboardModuleDataRegisteredTiles' })
export class RegisteredTilesModel {
	@ApiProperty({ description: 'Number of registered tiles', type: 'number', example: 12 })
	@Expose()
	@IsNumber()
	value: number;

	@ApiProperty({
		name: 'last_updated',
		description: 'Last update timestamp',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
	})
	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_updated?: string | Date; lastUpdated?: string | Date } }) => {
			const value: string | Date = obj.last_updated || obj.lastUpdated;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

@ApiSchema({ name: 'DashboardModuleDataRegisteredDataSources' })
export class RegisteredDataSourcesModel {
	@ApiProperty({ description: 'Number of registered data sources', type: 'number', example: 8 })
	@Expose()
	@IsNumber()
	value: number;

	@ApiProperty({
		name: 'last_updated',
		description: 'Last update timestamp',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
	})
	@Expose({ name: 'last_updated' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_updated?: string | Date; lastUpdated?: string | Date } }) => {
			const value: string | Date = obj.last_updated || obj.lastUpdated;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastUpdated: Date;
}

@ApiSchema({ name: 'DashboardModuleDataStats' })
export class ModuleStatsModel {
	@ApiProperty({
		name: 'registered_pages',
		description: 'Registered pages statistics',
		type: () => RegisteredPagesModel,
	})
	@Expose({ name: 'registered_pages' })
	@ValidateNested()
	@Type(() => RegisteredPagesModel)
	registeredPages: RegisteredPagesModel;

	@ApiProperty({
		name: 'registered_tiles',
		description: 'Registered tiles statistics',
		type: () => RegisteredTilesModel,
	})
	@Expose({ name: 'registered_tiles' })
	@ValidateNested()
	@Type(() => RegisteredTilesModel)
	registeredTiles: RegisteredTilesModel;

	@ApiProperty({
		name: 'registered_data_sources',
		description: 'Registered data sources statistics',
		type: () => RegisteredDataSourcesModel,
	})
	@Expose({ name: 'registered_data_sources' })
	@ValidateNested()
	@Type(() => RegisteredDataSourcesModel)
	registeredDataSources: RegisteredDataSourcesModel;
}
