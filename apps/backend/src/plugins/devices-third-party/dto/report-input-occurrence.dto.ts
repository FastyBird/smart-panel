import { Expose } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DevicesThirdPartyPluginReportInputOccurrence' })
export class ReportInputOccurrenceDto {
	@ApiProperty({
		description: 'Input event name, e.g. press, double_press, long_press',
		example: 'press',
	})
	@Expose()
	@IsString()
	@IsNotEmpty()
	event: string;

	@ApiPropertyOptional({
		description: 'Property identifier or UUID. If omitted, targets default event property',
		example: 'event',
	})
	@Expose()
	@IsString()
	@IsOptional()
	property?: string;

	@ApiPropertyOptional({
		description: 'Optional external source occurrence identifier for deduplication',
		example: 'occ-12345',
	})
	@Expose()
	@IsString()
	@IsOptional()
	sourceOccurrenceId?: string;

	@ApiPropertyOptional({
		description: 'ISO timestamp from external device',
		example: '2026-03-30T12:00:00.000Z',
	})
	@Expose()
	@IsDateString()
	@IsOptional()
	sourceTimestamp?: string;

	@ApiPropertyOptional({
		description: 'Native event type string before normalisation',
		example: 'single_click',
	})
	@Expose()
	@IsString()
	@IsOptional()
	nativeEventType?: string;

	@ApiPropertyOptional({
		description: 'Arbitrary metadata payload',
	})
	@Expose()
	@IsObject()
	@IsOptional()
	data?: Record<string, unknown>;
}

@ApiSchema({ name: 'DevicesThirdPartyPluginReportInputOccurrenceResponse' })
export class ReportInputOccurrenceResponseDto {
	@ApiProperty({
		description: 'Occurrence UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({
		description: 'Device UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsString()
	deviceId: string;

	@ApiProperty({
		description: 'Channel UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsString()
	channelId: string;

	@ApiProperty({
		description: 'Property UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsString()
	propertyId: string;

	@ApiProperty({
		description: 'Event name',
		example: 'press',
	})
	@Expose()
	@IsString()
	event: string;

	@ApiPropertyOptional({
		description: 'Native event type string',
		example: 'single_click',
	})
	@Expose()
	@IsString()
	@IsOptional()
	nativeEventType?: string;

	@ApiPropertyOptional({
		description: 'Source occurrence ID',
		example: 'occ-12345',
	})
	@Expose()
	@IsString()
	@IsOptional()
	sourceOccurrenceId?: string;

	@ApiProperty({
		description: 'Occurrence timestamp',
		example: '2026-03-30T12:00:00.000Z',
	})
	@Expose()
	@IsString()
	timestamp: string;
}
