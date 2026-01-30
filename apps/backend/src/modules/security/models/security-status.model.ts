import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { AlarmState, ArmedState, SecurityAlertType, Severity } from '../security.constants';

@ApiSchema({ name: 'SecurityModuleDataLastEvent' })
export class SecurityLastEventModel {
	@ApiProperty({
		description: 'Type of the security event',
		type: 'string',
		example: 'motion_detected',
	})
	@Expose()
	type: string;

	@ApiProperty({
		description: 'ISO 8601 timestamp of the event',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
	})
	@Expose()
	timestamp: string;

	@ApiPropertyOptional({
		description: 'ID of the device that triggered the event',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'source_device_id' })
	sourceDeviceId?: string;

	@ApiPropertyOptional({
		description: 'Severity of the event',
		enum: Severity,
		example: Severity.INFO,
	})
	@Expose()
	severity?: Severity;
}

@ApiSchema({ name: 'SecurityModuleDataAlert' })
export class SecurityAlertModel {
	@ApiProperty({
		description: 'Stable unique identifier for the alert',
		type: 'string',
		example: 'sensor:dev_123:smoke',
	})
	@Expose()
	id: string;

	@ApiProperty({
		description: 'Type of the security alert',
		enum: SecurityAlertType,
		example: SecurityAlertType.SMOKE,
	})
	@Expose()
	type: SecurityAlertType;

	@ApiProperty({
		description: 'Severity of the alert',
		enum: Severity,
		example: Severity.CRITICAL,
	})
	@Expose()
	severity: Severity;

	@ApiProperty({
		description: 'ISO 8601 timestamp when the alert was detected',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
	})
	@Expose()
	timestamp: string;

	@ApiProperty({
		description: 'Whether the alert has been acknowledged',
		type: 'boolean',
		example: false,
	})
	@Expose()
	acknowledged: boolean;

	@ApiPropertyOptional({
		description: 'ID of the source device',
		type: 'string',
		name: 'source_device_id',
	})
	@Expose({ name: 'source_device_id' })
	sourceDeviceId?: string;

	@ApiPropertyOptional({
		description: 'ID of the source channel',
		type: 'string',
		name: 'source_channel_id',
	})
	@Expose({ name: 'source_channel_id' })
	sourceChannelId?: string;

	@ApiPropertyOptional({
		description: 'ID of the source property',
		type: 'string',
		name: 'source_property_id',
	})
	@Expose({ name: 'source_property_id' })
	sourcePropertyId?: string;

	@ApiPropertyOptional({
		description: 'Human-readable summary of the alert',
		type: 'string',
	})
	@Expose()
	message?: string;
}

@ApiSchema({ name: 'SecurityModuleDataStatus' })
export class SecurityStatusModel {
	@ApiProperty({
		description: 'Current armed state of the security system',
		enum: ArmedState,
		nullable: true,
		example: ArmedState.DISARMED,
		name: 'armed_state',
	})
	@Expose({ name: 'armed_state' })
	armedState: ArmedState | null;

	@ApiProperty({
		description: 'Current alarm state',
		enum: AlarmState,
		nullable: true,
		example: AlarmState.IDLE,
		name: 'alarm_state',
	})
	@Expose({ name: 'alarm_state' })
	alarmState: AlarmState | null;

	@ApiProperty({
		description: 'Highest severity among active alerts',
		enum: Severity,
		example: Severity.INFO,
		name: 'highest_severity',
	})
	@Expose({ name: 'highest_severity' })
	highestSeverity: Severity;

	@ApiProperty({
		description: 'Number of currently active alerts',
		type: 'number',
		example: 0,
		name: 'active_alerts_count',
	})
	@Expose({ name: 'active_alerts_count' })
	activeAlertsCount: number;

	@ApiProperty({
		description: 'Whether any active alert has critical severity',
		type: 'boolean',
		example: false,
		name: 'has_critical_alert',
	})
	@Expose({ name: 'has_critical_alert' })
	hasCriticalAlert: boolean;

	@ApiProperty({
		description: 'List of currently active security alerts',
		type: () => [SecurityAlertModel],
		name: 'active_alerts',
	})
	@Expose({ name: 'active_alerts' })
	@Type(() => SecurityAlertModel)
	activeAlerts: SecurityAlertModel[];

	@ApiPropertyOptional({
		description: 'Most recent security event',
		type: () => SecurityLastEventModel,
		name: 'last_event',
	})
	@Expose({ name: 'last_event' })
	@Type(() => SecurityLastEventModel)
	lastEvent?: SecurityLastEventModel;
}
