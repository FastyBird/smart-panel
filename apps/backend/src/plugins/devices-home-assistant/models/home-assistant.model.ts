import { Expose, Transform, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsDate, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class HomeAssistantStateModel {
	@Expose()
	@IsString()
	entity_id: string;

	@Expose()
	@IsString()
	state: string;

	@Expose()
	@IsObject()
	attributes: Record<string, unknown>; // Dynamic attributes

	@Expose({ name: 'last_changed' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_changed?: string | Date; lastChanged?: string | Date } }) => {
			const value: string | Date = obj.last_changed || obj.lastChanged;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastChanged: Date;

	@Expose({ name: 'last_reported' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_reported?: string | Date; lastReported?: string | Date } }) => {
			const value: string | Date = obj.last_reported || obj.lastReported;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	lastReported: Date;

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

export class HomeAssistantDeviceModel {
	@Expose()
	@IsString()
	id: string;

	@Expose()
	@IsString()
	name: string;

	@Expose()
	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	entities: string[];

	@Expose({ name: 'adopted_device_id' })
	@IsString()
	@IsOptional()
	adoptedDeviceId: string | null = null;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HomeAssistantStateModel)
	states: HomeAssistantStateModel;
}
