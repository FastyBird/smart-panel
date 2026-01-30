import { AlarmState, ArmedState, SecurityAlertType, Severity } from '../security.constants';

export interface SecurityLastEvent {
	type: string;
	timestamp: string; // ISO 8601
	sourceDeviceId?: string;
	severity?: Severity;
}

export interface SecurityAlert {
	id: string;
	type: SecurityAlertType;
	severity: Severity;
	timestamp: string; // ISO 8601
	acknowledged: boolean;
	sourceDeviceId?: string;
	sourceChannelId?: string;
	sourcePropertyId?: string;
	message?: string;
}

export interface SecuritySignal {
	armedState?: ArmedState | null;
	alarmState?: AlarmState | null;
	highestSeverity?: Severity;
	activeAlertsCount?: number;
	hasCriticalAlert?: boolean;
	lastEvent?: SecurityLastEvent;
	activeAlerts?: SecurityAlert[];
}
