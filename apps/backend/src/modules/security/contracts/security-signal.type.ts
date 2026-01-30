import { AlarmState, ArmedState, Severity } from '../security.constants';

export interface SecurityLastEvent {
	type: string;
	timestamp: string; // ISO 8601
	sourceDeviceId?: string;
	severity?: Severity;
}

export interface SecuritySignal {
	armedState?: ArmedState | null;
	alarmState?: AlarmState | null;
	highestSeverity?: Severity;
	activeAlertsCount?: number;
	hasCriticalAlert?: boolean;
	lastEvent?: SecurityLastEvent;
}
