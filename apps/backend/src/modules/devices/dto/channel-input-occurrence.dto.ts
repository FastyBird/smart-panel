import { Expose } from 'class-transformer';
import { IsISO8601, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

/**
 * Data transfer object for ingesting a physical hardware input occurrence.
 */
@ApiSchema({ name: 'DevicesModuleReqCreateChannelInputOccurrence' })
export class CreateChannelInputOccurrenceDto {
	@ApiProperty({
		description: 'Unique identifier of the device reporting the input occurrence',
		format: 'uuid',
	})
	@IsUUID('4')
	@IsNotEmpty()
	@Expose()
	deviceId: string;

	@ApiProperty({
		description: 'Unique identifier of the input channel triggering the occurrence',
		format: 'uuid',
	})
	@IsUUID('4')
	@IsNotEmpty()
	@Expose()
	channelId: string;

	@ApiProperty({
		description: 'Unique identifier of the channel property representing the input capability',
		format: 'uuid',
	})
	@IsUUID('4')
	@IsNotEmpty()
	@Expose()
	propertyId: string;

	@ApiProperty({
		description: 'Input interaction event type (e.g. press, double_press, long_press, down, up, change)',
	})
	@IsString()
	@IsNotEmpty()
	@Expose()
	event: string;

	@ApiPropertyOptional({
		description: 'Source timestamp of the event in ISO 8601 string format (if recorded at hardware)',
	})
	@IsISO8601()
	@IsOptional()
	@Expose()
	sourceTimestamp?: string;

	@ApiPropertyOptional({
		description: 'Native sequence counter or packet ID used for transport redelivery deduplication',
	})
	@IsString()
	@IsOptional()
	@Expose()
	sourceOccurrenceId?: string;

	@ApiPropertyOptional({
		description: 'Original native event identifier from provider (e.g. btn_down, single_push)',
	})
	@IsString()
	@IsOptional()
	@Expose()
	nativeEventType?: string;

	@ApiPropertyOptional({
		description: 'Optional structured context data for the occurrence',
		type: 'object',
		additionalProperties: true,
	})
	@IsObject()
	@IsOptional()
	@Expose()
	data?: Record<string, unknown>;
}
