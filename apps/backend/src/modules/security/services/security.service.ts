import { Injectable } from '@nestjs/common';

import { SecurityStatusModel } from '../models/security-status.model';
import { Severity } from '../security.constants';

@Injectable()
export class SecurityService {
	getStatus(): SecurityStatusModel {
		const status = new SecurityStatusModel();

		status.armedState = null;
		status.alarmState = null;
		status.highestSeverity = Severity.INFO;
		status.activeAlertsCount = 0;
		status.hasCriticalAlert = false;

		return status;
	}
}
