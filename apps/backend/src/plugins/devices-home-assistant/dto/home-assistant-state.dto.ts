import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { IsDate, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

@ApiSchema({ name: 'DevicesHomeAssistantPluginHomeAssistantContext' })
class HomeAssistantContextDto {
	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Context identifier',
		example: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
	})
	id: string;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'Parent context identifier',
		example: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
		nullable: true,
		name: 'parent_id',
	})
	parent_id: string | null;

	@Expose()
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description: 'User identifier',
		example: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
		nullable: true,
		name: 'user_id',
	})
	user_id: string | null;
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginHomeAssistantState' })
export class HomeAssistantStateDto {
	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Home Assistant entity ID',
		example: 'light.living_room',
		name: 'entity_id',
	})
	entity_id: string;

	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Current state of the entity',
		example: 'on',
	})
	state: string;

	@Expose()
	@IsObject()
	@ApiProperty({
		description: 'Dynamic attributes of the entity',
		example: { brightness: 255, color_temp: 370 },
	})
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
	@ApiProperty({
		description: 'Timestamp when the state last changed',
		example: '2023-10-15T14:30:00.000Z',
		format: 'date-time',
		name: 'last_changed',
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
	@ApiProperty({
		description: 'Timestamp when the state was last reported',
		example: '2023-10-15T14:30:00.000Z',
		format: 'date-time',
		name: 'last_reported',
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
	@ApiProperty({
		description: 'Timestamp when the state was last updated',
		example: '2023-10-15T14:30:00.000Z',
		format: 'date-time',
		name: 'last_updated',
	})
	last_updated: Date;

	@Expose()
	@ValidateNested()
	@Type(() => HomeAssistantContextDto)
	@ApiProperty({
		description: 'Context information for this state',
		type: () => HomeAssistantContextDto,
	})
	context: HomeAssistantContextDto;
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginHomeAssistantStateChangedEventData' })
export class HomeAssistantStateChangedEventDataDto {
	@Expose()
	@ValidateNested()
	@Type(() => HomeAssistantStateDto)
	@ApiProperty({
		description: 'Previous state of the entity',
		type: () => HomeAssistantStateDto,
		name: 'old_state',
	})
	old_state: HomeAssistantStateDto;

	@Expose()
	@ValidateNested()
	@Type(() => HomeAssistantStateDto)
	@ApiProperty({
		description: 'New state of the entity',
		type: () => HomeAssistantStateDto,
		nullable: true,
		name: 'new_state',
	})
	new_state: HomeAssistantStateDto | null;
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginHomeAssistantStateChangedEvent' })
export class HomeAssistantStateChangedEventDto {
	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Event type',
		example: 'state_changed',
		name: 'event_type',
	})
	event_type: 'state_changed';

	@Expose()
	@ValidateNested()
	@Type(() => HomeAssistantStateChangedEventDataDto)
	@ApiProperty({
		description: 'Event data containing old and new states',
		type: () => HomeAssistantStateChangedEventDataDto,
	})
	data: HomeAssistantStateChangedEventDataDto;

	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Event origin',
		example: 'LOCAL',
	})
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
	@ApiProperty({
		description: 'Timestamp when the event was fired',
		example: '2023-10-15T14:30:00.000Z',
		format: 'date-time',
		name: 'time_fired',
	})
	time_fired: Date;

	@Expose()
	@ValidateNested()
	@Type(() => HomeAssistantContextDto)
	@ApiProperty({
		description: 'Context information for this event',
		type: () => HomeAssistantContextDto,
	})
	context: HomeAssistantContextDto;
}
