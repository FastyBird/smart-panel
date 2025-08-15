import { Expose, Transform, Type } from 'class-transformer';
import { IsDate, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

class HomeAssistantContextDto {
	@Expose()
	@IsString()
	id: string;

	@Expose()
	@IsOptional()
	@IsString()
	parent_id: string | null;

	@Expose()
	@IsOptional()
	@IsString()
	user_id: string | null;
}

export class HomeAssistantStateDto {
	@Expose()
	@IsString()
	entity_id: string;

	@Expose()
	@IsString()
	state: string;

	@Expose()
	@IsObject()
	attributes: Record<string, unknown>; // Dynamic attributes

	@Expose()
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_changed?: string | Date } }) => {
			return typeof obj.last_changed === 'string' ? new Date(obj.last_changed) : obj.last_changed;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	last_changed: Date;

	@Expose()
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_reported?: string | Date } }) => {
			return typeof obj.last_reported === 'string' ? new Date(obj.last_reported) : obj.last_reported;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	last_reported: Date;

	@Expose()
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_updated?: string } }) => {
			return typeof obj.last_updated === 'string' ? new Date(obj.last_updated) : obj.last_updated;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	last_updated: Date;

	@Expose()
	@ValidateNested()
	@Type(() => HomeAssistantContextDto)
	context: HomeAssistantContextDto;
}

export class HomeAssistantStateChangedEventDataDto {
	@Expose()
	@ValidateNested()
	@Type(() => HomeAssistantStateDto)
	old_state: HomeAssistantStateDto;

	@Expose()
	@ValidateNested()
	@Type(() => HomeAssistantStateDto)
	new_state: HomeAssistantStateDto | null;
}

export class HomeAssistantStateChangedEventDto {
	@Expose()
	@IsString()
	event_type: 'state_changed';

	@Expose()
	@ValidateNested()
	@Type(() => HomeAssistantStateChangedEventDataDto)
	data: HomeAssistantStateChangedEventDataDto;

	@Expose()
	@IsString()
	origin: string;

	@Expose()
	@IsDate()
	@Transform(
		({ obj }: { obj: { time_fired?: string } }) => {
			return typeof obj.time_fired === 'string' ? new Date(obj.time_fired) : obj.time_fired;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	time_fired: Date;

	@Expose()
	@ValidateNested()
	@Type(() => HomeAssistantContextDto)
	context: HomeAssistantContextDto;
}
