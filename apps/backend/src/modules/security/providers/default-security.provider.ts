import { Injectable } from '@nestjs/common';

import { SecuritySignal } from '../contracts/security-signal.type';
import { SecurityStateProviderInterface } from '../contracts/security-state-provider.interface';
import { Severity } from '../security.constants';

@Injectable()
export class DefaultSecurityProvider implements SecurityStateProviderInterface {
	getKey(): string {
		return 'default';
	}

	getSignals(): SecuritySignal {
		return {
			highestSeverity: Severity.INFO,
			activeAlertsCount: 0,
			hasCriticalAlert: false,
		};
	}
}
