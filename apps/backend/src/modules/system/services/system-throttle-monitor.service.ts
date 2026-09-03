import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { createExtensionLogger } from '../../../common/logger';
import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../notifications/notifications.constants';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { PlatformNotSupportedException } from '../../platform/platform.exceptions';
import { ThrottleStatusModel } from '../models/system.model';
import { SYSTEM_MODULE_NAME } from '../system.constants';

import { SystemService } from './system.service';

interface ThrottleFlagDefinition {
	key: string;
	field: keyof ThrottleStatusModel;
	severity: NotificationSeverity;
	title: string;
}

/**
 * One row per `ThrottleStatusModel` flag. `undervoltage` is the only one that can silently
 * corrupt data or crash the board, so it alone is `critical`; the others degrade performance
 * without risking damage.
 */
const THROTTLE_FLAGS: readonly ThrottleFlagDefinition[] = [
	{
		key: 'throttle:undervoltage',
		field: 'undervoltage',
		severity: NotificationSeverity.CRITICAL,
		title: 'Under-voltage detected',
	},
	{
		key: 'throttle:throttling',
		field: 'throttling',
		severity: NotificationSeverity.WARNING,
		title: 'CPU is being throttled',
	},
	{
		key: 'throttle:frequency_capping',
		field: 'frequencyCapping',
		severity: NotificationSeverity.WARNING,
		title: 'CPU frequency is capped',
	},
	{
		key: 'throttle:soft_temp_limit',
		field: 'softTempLimit',
		severity: NotificationSeverity.WARNING,
		title: 'Soft temperature limit reached',
	},
];

/**
 * Polls `SystemService.getThrottleStatus()`, today only a pull source behind
 * `GET /system/throttle`, and turns each flag's transition into a notification.
 *
 * A platform that cannot read throttle status (anything but Raspberry Pi hardware) rejects
 * with `PlatformNotSupportedException` on every call - expected, not an error, so it is a
 * silent no-op rather than a per-tick log line.
 */
@Injectable()
export class SystemThrottleMonitorService {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'SystemThrottleMonitorService');

	// Which flags this monitor currently believes are raised. Doubles as the "already raised"
	// guard: a flag observed set on every tick is only notified on the tick it is added here.
	private readonly activeFlags = new Set<string>();

	constructor(
		private readonly systemService: SystemService,
		private readonly notifications: NotificationsService,
	) {}

	@Cron('*/5 * * * *')
	async checkThrottleStatus(): Promise<void> {
		try {
			const status = await this.systemService.getThrottleStatus();

			for (const flag of THROTTLE_FLAGS) {
				await this.applyFlag(flag, status[flag.field]);
			}
		} catch (error) {
			if (error instanceof PlatformNotSupportedException) {
				return;
			}

			const err = error as Error;

			this.logger.error(`Failed to check throttle status: ${err.message}`, err.stack);
		}
	}

	private async applyFlag(flag: ThrottleFlagDefinition, isSet: boolean): Promise<void> {
		const wasActive = this.activeFlags.has(flag.key);

		if (isSet && !wasActive) {
			this.activeFlags.add(flag.key);

			await this.notifications.notify({
				source: SYSTEM_MODULE_NAME,
				kind: NotificationKind.ISSUE,
				key: flag.key,
				severity: flag.severity,
				title: flag.title,
				actions: [{ type: NotificationActionType.LINK, label: 'Open system info', url: '/system/info', primary: true }],
			});

			return;
		}

		if (!isSet && wasActive) {
			// Only leaves `activeFlags` on the success path: a rejected resolve leaves the flag
			// marked active so the next poll - which will see the same cleared reading - retries
			// it, instead of the issue staying open forever with nothing left to revisit it.
			try {
				await this.notifications.resolve(SYSTEM_MODULE_NAME, flag.key);

				this.activeFlags.delete(flag.key);
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Failed to resolve the ${flag.key} issue: ${err.message}`, err.stack);
			}
		}
	}
}
