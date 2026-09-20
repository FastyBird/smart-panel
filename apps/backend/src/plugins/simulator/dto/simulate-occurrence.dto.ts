import { Expose, Type } from 'class-transformer';
import { IsDefined, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'SimulatorPluginSimulateOccurrence' })
export class SimulateOccurrenceDto {
	@ApiProperty({
		description: 'Channel ID where the input occurrence happened',
		name: 'channel_id',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"channel_id","reason":"Channel ID is required."}]' })
	@IsUUID('4', { message: '[{"field":"channel_id","reason":"Channel ID must be a valid UUID."}]' })
	channel_id: string;

	@ApiPropertyOptional({
		description: 'Property ID for event occurrence (if omitted, auto-detected from channel event property)',
		name: 'property_id',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174001',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"property_id","reason":"Property ID must be a valid UUID."}]' })
	property_id?: string;

	@ApiProperty({
		description: 'Normalized input event interaction (e.g. press, double_press, long_press, triple_press, down, up)',
		type: 'string',
		example: 'press',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"event","reason":"Event is required."}]' })
	@IsString({ message: '[{"field":"event","reason":"Event must be a string."}]' })
	event: string;

	@ApiPropertyOptional({
		description: 'Optional ISO timestamp or epoch from device hardware clock',
		name: 'source_timestamp',
		type: 'string',
		example: '2026-09-20T10:00:00.000Z',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"source_timestamp","reason":"Source timestamp must be a string."}]' })
	source_timestamp?: string;

	@ApiPropertyOptional({
		description: 'Optional native event_cnt, packet ID, or sequence number for transport deduplication',
		name: 'source_occurrence_id',
		type: 'string',
		example: 'seq-42',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"source_occurrence_id","reason":"Source occurrence ID must be a string."}]' })
	source_occurrence_id?: string;

	@ApiPropertyOptional({
		description: 'Original provider event string (e.g. single_push, btn_down)',
		name: 'native_event_type',
		type: 'string',
		example: 'single_push',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"native_event_type","reason":"Native event type must be a string."}]' })
	native_event_type?: string;

	@ApiPropertyOptional({
		description: 'Optional structured metadata or context',
		type: 'object',
		additionalProperties: true,
		example: { duration_ms: 150 },
	})
	@Expose()
	@IsOptional()
	@IsObject({ message: '[{"field":"data","reason":"Data must be an object."}]' })
	data?: Record<string, unknown>;
}

@ApiSchema({ name: 'SimulatorPluginReqSimulateOccurrence' })
export class ReqSimulateOccurrenceDto {
	@ApiProperty({ description: 'Simulation occurrence data', type: () => SimulateOccurrenceDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Simulation occurrence data is required."}]' })
	@IsObject({ message: '[{"field":"data","reason":"Simulation occurrence data must be an object."}]' })
	@ValidateNested()
	@Type(() => SimulateOccurrenceDto)
	data: SimulateOccurrenceDto;
}
