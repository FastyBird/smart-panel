import { Test, TestingModule } from '@nestjs/testing';

import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../notifications/notifications.constants';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { PlatformNotSupportedException } from '../../platform/platform.exceptions';
import { ThrottleStatusModel } from '../models/system.model';
import { SYSTEM_MODULE_NAME } from '../system.constants';

import { SystemThrottleMonitorService } from './system-throttle-monitor.service';
import { SystemService } from './system.service';

describe('SystemThrottleMonitorService', () => {
	let service: SystemThrottleMonitorService;
	let systemService: { getThrottleStatus: jest.Mock };
	let notifications: { notify: jest.Mock; resolve: jest.Mock };

	const clearStatus: ThrottleStatusModel = {
		undervoltage: false,
		frequencyCapping: false,
		throttling: false,
		softTempLimit: false,
	};

	beforeEach(async () => {
		systemService = {
			getThrottleStatus: jest.fn().mockResolvedValue({ ...clearStatus }),
		};

		notifications = {
			notify: jest.fn().mockResolvedValue(null),
			resolve: jest.fn().mockResolvedValue(true),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SystemThrottleMonitorService,
				{ provide: SystemService, useValue: systemService },
				{ provide: NotificationsService, useValue: notifications },
			],
		}).compile();

		service = module.get(SystemThrottleMonitorService);
	});

	it('does not notify while every flag stays clear', async () => {
		await service.checkThrottleStatus();
		await service.checkThrottleStatus();

		expect(notifications.notify).not.toHaveBeenCalled();
		expect(notifications.resolve).not.toHaveBeenCalled();
	});

	it('raises throttle:undervoltage as critical on the false to true transition', async () => {
		await service.checkThrottleStatus();

		systemService.getThrottleStatus.mockResolvedValue({ ...clearStatus, undervoltage: true });

		await service.checkThrottleStatus();

		expect(notifications.notify).toHaveBeenCalledWith(
			expect.objectContaining({
				source: SYSTEM_MODULE_NAME,
				kind: NotificationKind.ISSUE,
				key: 'throttle:undervoltage',
				severity: NotificationSeverity.CRITICAL,
				actions: [{ type: NotificationActionType.LINK, label: 'Open system info', url: '/system/info', primary: true }],
			}),
		);
	});

	it.each([
		['throttling', 'throttle:throttling'],
		['frequencyCapping', 'throttle:frequency_capping'],
		['softTempLimit', 'throttle:soft_temp_limit'],
	])('raises %s as warning keyed %s on the false to true transition', async (field, key) => {
		await service.checkThrottleStatus();

		systemService.getThrottleStatus.mockResolvedValue({ ...clearStatus, [field]: true });

		await service.checkThrottleStatus();

		expect(notifications.notify).toHaveBeenCalledWith(
			expect.objectContaining({
				source: SYSTEM_MODULE_NAME,
				kind: NotificationKind.ISSUE,
				key,
				severity: NotificationSeverity.WARNING,
			}),
		);
	});

	it('a flag staying set across ticks then clearing produces one raise and one resolve', async () => {
		await service.checkThrottleStatus();

		systemService.getThrottleStatus.mockResolvedValue({ ...clearStatus, throttling: true });
		await service.checkThrottleStatus();
		await service.checkThrottleStatus();

		systemService.getThrottleStatus.mockResolvedValue({ ...clearStatus });
		await service.checkThrottleStatus();

		expect(notifications.notify).toHaveBeenCalledTimes(1);
		expect(notifications.resolve).toHaveBeenCalledTimes(1);
		expect(notifications.resolve).toHaveBeenCalledWith(SYSTEM_MODULE_NAME, 'throttle:throttling');
	});

	it('raises each still-set flag independently and resolves each on its own clear', async () => {
		systemService.getThrottleStatus.mockResolvedValue({
			undervoltage: true,
			throttling: true,
			frequencyCapping: false,
			softTempLimit: false,
		});

		await service.checkThrottleStatus();

		expect(notifications.notify).toHaveBeenCalledTimes(2);

		systemService.getThrottleStatus.mockResolvedValue(clearStatus);

		await service.checkThrottleStatus();

		expect(notifications.resolve).toHaveBeenCalledWith(SYSTEM_MODULE_NAME, 'throttle:undervoltage');
		expect(notifications.resolve).toHaveBeenCalledWith(SYSTEM_MODULE_NAME, 'throttle:throttling');
	});

	it('is a no-op with no calls and no error log when the platform has no throttle data', async () => {
		systemService.getThrottleStatus.mockRejectedValue(new PlatformNotSupportedException('not supported'));

		const errorSpy = jest.spyOn(service['logger'], 'error');

		await service.checkThrottleStatus();

		expect(notifications.notify).not.toHaveBeenCalled();
		expect(notifications.resolve).not.toHaveBeenCalled();
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it('logs and swallows an unexpected failure reading throttle status', async () => {
		systemService.getThrottleStatus.mockRejectedValue(new Error('boom'));

		await expect(service.checkThrottleStatus()).resolves.toBeUndefined();
		expect(notifications.notify).not.toHaveBeenCalled();
	});
});
