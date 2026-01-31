import { Expose } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { SecurityEventType, Severity } from '../security.constants';

@ApiSchema({ name: 'SecurityModuleDataEvent' })
export class SecurityEventModel {
	@ApiProperty({
		description: 'Unique event identifier',
		type: 'string',
		format: 'uuid',
	})
	@Expose()
	id: string;

	@ApiProperty({
		description: 'ISO 8601 timestamp of the event',
		type: 'string',
		format: 'date-time',
	})
	@Expose()
	timestamp: string;

	@ApiProperty({
		description: 'Type of the security event',
		enum: SecurityEventType,
		example: SecurityEventType.ALERT_RAISED,
		name: 'event_type',
	})
	@Expose({ name: 'event_type' })
	eventType: SecurityEventType;

	@ApiPropertyOptional({
		description: 'Severity of the event',
		enum: Severity,
	})
	@Expose()
	severity?: Severity;

	@ApiPropertyOptional({
		description: 'Alert ID associated with this event',
		type: 'string',
		name: 'alert_id',
	})
	@Expose({ name: 'alert_id' })
	alertId?: string;

	@ApiPropertyOptional({
		description: 'Alert type associated with this event',
		type: 'string',
		name: 'alert_type',
	})
	@Expose({ name: 'alert_type' })
	alertType?: string;

	@ApiPropertyOptional({
		description: 'Source device ID',
		type: 'string',
		name: 'source_device_id',
	})
	@Expose({ name: 'source_device_id' })
	sourceDeviceId?: string;

	@ApiPropertyOptional({
		description: 'Additional event payload',
		type: 'object',
	})
	@Expose()
	payload?: Record<string, unknown>;
}

@ApiSchema({ name: 'SecurityModuleResEvents' })
export class SecurityEventsResponseModel extends BaseSuccessResponseModel<SecurityEventModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => [SecurityEventModel],
	})
	@Expose()
	declare data: SecurityEventModel[];
}
