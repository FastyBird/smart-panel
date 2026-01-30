import { AlarmState, ArmedState, Severity } from '../security.constants';

export interface SecurityLastEvent {
	type: string;
	timestamp: string;
	sourceDeviceId?: string;
	severity?: Severity;
}

export interface SecurityStateProviderInterface {
	getArmedState(): ArmedState | null;
	getAlarmState(): AlarmState | null;
	getActiveAlerts(): { count: number; highestSeverity: Severity; hasCritical: boolean };
	getLastEvent(): SecurityLastEvent | null;
}
