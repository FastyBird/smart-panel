import { Expose } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../devices.constants';

/**
 * Standard typed occurrence envelope delivered independently of property state.
 */
@ApiSchema({ name: 'DevicesModuleDataChannelInputOccurrence' })
export class ChannelInputOccurrencePayload {
	@ApiProperty({
		description: 'Unique occurrence identifier (UUIDv4)',
		format: 'uuid',
	})
	@Expose()
	id: string;

	@ApiProperty({
		description: 'Device unique identifier',
		format: 'uuid',
	})
	@Expose()
	deviceId: string;

	@ApiProperty({
		description: 'Channel unique identifier',
		format: 'uuid',
	})
	@Expose()
	channelId: string;

	@ApiProperty({
		description: 'Property unique identifier',
		format: 'uuid',
	})
	@Expose()
	propertyId: string;

	@ApiPropertyOptional({
		description: 'Device category',
		enum: DeviceCategory,
	})
	@Expose()
	deviceCategory?: DeviceCategory;

	@ApiProperty({
		description: 'Channel category',
		enum: ChannelCategory,
	})
	@Expose()
	channelCategory: ChannelCategory;

	@ApiProperty({
		description: 'Property category',
		enum: PropertyCategory,
	})
	@Expose()
	propertyCategory: PropertyCategory;

	@ApiProperty({
		description: 'Normalized interaction event (e.g. press, long_press, double_press, triple_press, down, up)',
		example: 'press',
	})
	@Expose()
	event: string;

	@ApiProperty({
		description: 'Server receive timestamp in ISO 8601 format',
	})
	@Expose()
	timestamp: string;

	@ApiPropertyOptional({
		description: 'Source hardware timestamp when provided by device clock',
	})
	@Expose()
	sourceTimestamp?: string;

	@ApiPropertyOptional({
		description: 'Native sequence counter or packet ID used for transport redelivery deduplication',
	})
	@Expose()
	sourceOccurrenceId?: string;

	@ApiPropertyOptional({
		description: 'Original native event identifier from provider',
	})
	@Expose()
	nativeEventType?: string;

	@ApiPropertyOptional({
		description: 'Optional structured context data (e.g. duration_ms, delta)',
		type: 'object',
		additionalProperties: true,
	})
	@Expose()
	data?: Record<string, unknown>;

	@ApiPropertyOptional({
		description: 'Device platform or plugin integration type',
	})
	@Expose()
	integration?: string;
}

/**
 * Response wrapper for single input occurrence
 */
@ApiSchema({ name: 'DevicesModuleResChannelInputOccurrence' })
export class ChannelInputOccurrenceResponseModel extends BaseSuccessResponseModel<ChannelInputOccurrencePayload> {
	@ApiProperty({
		description: 'The actual occurrence payload',
		type: () => ChannelInputOccurrencePayload,
	})
	@Expose()
	declare data: ChannelInputOccurrencePayload;
}
