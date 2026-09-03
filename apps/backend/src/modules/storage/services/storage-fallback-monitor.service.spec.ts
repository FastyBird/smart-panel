import { Test, TestingModule } from '@nestjs/testing';

import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../notifications/notifications.constants';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { STORAGE_MODULE_NAME } from '../storage.constants';

import { StorageFallbackMonitorService } from './storage-fallback-monitor.service';
import { StorageService } from './storage.service';

describe('StorageFallbackMonitorService', () => {
	let service: StorageFallbackMonitorService;
	let storageService: { isUsingFallback: jest.Mock; isConnected: jest.Mock };
	let notifications: { notify: jest.Mock; resolve: jest.Mock };

	beforeEach(async () => {
		storageService = {
			isUsingFallback: jest.fn().mockReturnValue(false),
			isConnected: jest.fn().mockReturnValue(true),
		};

		notifications = {
			notify: jest.fn().mockResolvedValue(null),
			resolve: jest.fn().mockResolvedValue(true),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				StorageFallbackMonitorService,
				{ provide: StorageService, useValue: storageService },
				{ provide: NotificationsService, useValue: notifications },
			],
		}).compile();

		service = module.get(StorageFallbackMonitorService);
	});

	describe('fallback-active', () => {
		it('does not notify while the primary storage stays available', async () => {
			await service.checkStorageStatus();
			await service.checkStorageStatus();

			expect(notifications.notify).not.toHaveBeenCalled();
			expect(notifications.resolve).not.toHaveBeenCalled();
		});

		it('raises fallback-active on the false to true transition', async () => {
			await service.checkStorageStatus();

			storageService.isUsingFallback.mockReturnValue(true);

			await service.checkStorageStatus();

			expect(notifications.notify).toHaveBeenCalledWith(
				expect.objectContaining({
					source: STORAGE_MODULE_NAME,
					kind: NotificationKind.ISSUE,
					key: 'fallback-active',
					severity: NotificationSeverity.WARNING,
					actions: [
						{
							type: NotificationActionType.LINK,
							label: 'Open services',
							url: '/extensions?tab=services',
							primary: true,
						},
					],
				}),
			);
		});

		it('does not re-raise fallback-active while it stays true', async () => {
			storageService.isUsingFallback.mockReturnValue(true);

			await service.checkStorageStatus();
			await service.checkStorageStatus();
			await service.checkStorageStatus();

			expect(notifications.notify).toHaveBeenCalledTimes(1);
		});

		it('resolves fallback-active on the true to false transition', async () => {
			storageService.isUsingFallback.mockReturnValue(true);
			await service.checkStorageStatus();

			storageService.isUsingFallback.mockReturnValue(false);
			await service.checkStorageStatus();

			expect(notifications.resolve).toHaveBeenCalledWith(STORAGE_MODULE_NAME, 'fallback-active');
		});
	});

	describe('storage-unavailable', () => {
		it('raises storage-unavailable on the connected to disconnected transition', async () => {
			await service.checkStorageStatus();

			storageService.isConnected.mockReturnValue(false);

			await service.checkStorageStatus();

			expect(notifications.notify).toHaveBeenCalledWith(
				expect.objectContaining({
					source: STORAGE_MODULE_NAME,
					kind: NotificationKind.ISSUE,
					key: 'storage-unavailable',
					severity: NotificationSeverity.ERROR,
					actions: [
						{
							type: NotificationActionType.LINK,
							label: 'Open services',
							url: '/extensions?tab=services',
							primary: true,
						},
					],
				}),
			);
		});

		it('raises storage-unavailable exactly once for a stable disconnected state', async () => {
			storageService.isConnected.mockReturnValue(false);

			await service.checkStorageStatus();
			await service.checkStorageStatus();
			await service.checkStorageStatus();

			expect(notifications.notify).toHaveBeenCalledTimes(1);
		});

		it('resolves storage-unavailable on the disconnected to connected transition', async () => {
			storageService.isConnected.mockReturnValue(false);
			await service.checkStorageStatus();

			storageService.isConnected.mockReturnValue(true);
			await service.checkStorageStatus();

			expect(notifications.resolve).toHaveBeenCalledWith(STORAGE_MODULE_NAME, 'storage-unavailable');
		});
	});

	it('logs and swallows a failure raised while reading storage status', async () => {
		storageService.isUsingFallback.mockImplementation(() => {
			throw new Error('boom');
		});

		await expect(service.checkStorageStatus()).resolves.toBeUndefined();
	});
});
