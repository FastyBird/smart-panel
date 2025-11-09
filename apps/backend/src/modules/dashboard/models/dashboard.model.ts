import { Expose, Transform, Type } from 'class-transformer';
import { IsDate, IsNumber, ValidateNested } from 'class-validator';

export class RegisteredPagesModel {
	@Expose()
	@IsNumber()
	value: number;

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

export class RegisteredTilesModel {
	@Expose()
	@IsNumber()
	value: number;

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

export class RegisteredDataSourcesModel {
	@Expose()
	@IsNumber()
	value: number;

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

export class ModuleStatsModel {
	@Expose({ name: 'registered_pages' })
	@ValidateNested()
	@Type(() => RegisteredPagesModel)
	registeredPages: RegisteredPagesModel;

	@Expose({ name: 'registered_tiles' })
	@ValidateNested()
	@Type(() => RegisteredTilesModel)
	registeredTiles: RegisteredTilesModel;

	@Expose({ name: 'registered_data_sources' })
	@ValidateNested()
	@Type(() => RegisteredDataSourcesModel)
	registeredDataSources: RegisteredDataSourcesModel;
}
