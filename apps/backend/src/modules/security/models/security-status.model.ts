import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { AlarmState, ArmedState, Severity } from '../security.constants';

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

	@ApiPropertyOptional({
		description: 'Most recent security event',
		type: () => SecurityLastEventModel,
		name: 'last_event',
	})
	@Expose({ name: 'last_event' })
	@Type(() => SecurityLastEventModel)
	lastEvent?: SecurityLastEventModel;
}
