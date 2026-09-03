import { DataSource, Repository } from 'typeorm';

import { Logger } from '@nestjs/common';
import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ConfigService } from '../../config/services/config.service';
import { NotificationEntity } from '../entities/notifications.entity';
import { NotificationsConfigModel } from '../models/config.model';
import {
	DEFAULT_MAX_NOTIFICATIONS,
	DEFAULT_RETENTION_DAYS,
	NOTIFICATIONS_MODULE_NAME,
	NotificationKind,
	NotificationSeverity,
} from '../notifications.constants';

import { NotificationsRetentionService } from './notifications-retention.service';

describe('NotificationsRetentionService', () => {
	let dataSource: DataSource;
	let repository: Repository<NotificationEntity>;
	let service: NotificationsRetentionService;
	let configService: { getModuleConfig: jest.Mock };

	const DAY_MS = 24 * 60 * 60 * 1000;

	const ago = (days: number): Date => new Date(Date.now() - days * DAY_MS);

	const seed = async (overrides: Partial<NotificationEntity> = {}): Promise<NotificationEntity> =>
		repository.save(
			repository.create({
				source: 'system-module',
				kind: NotificationKind.EVENT,
				key: null,
				severity: NotificationSeverity.INFO,
				title: 'Seeded',
				message: null,
				actions: [],
				data: null,
				persistent: false,
				occurrences: 1,
				readAt: null,
				dismissedAt: null,
				resolvedAt: null,
				createdAt: ago(1),
				updatedAt: ago(1),
				...overrides,
			}),
		);

	const titles = async (): Promise<string[]> => {
		const rows = await repository.find({ order: { title: 'ASC' } });

		return rows.map((row) => row.title);
	};

	const buildService = async (config?: Partial<NotificationsConfigModel>): Promise<void> => {
		configService = {
			getModuleConfig: jest.fn().mockReturnValue({
				type: NOTIFICATIONS_MODULE_NAME,
				enabled: true,
				retentionDays: DEFAULT_RETENTION_DAYS,
				maxNotifications: DEFAULT_MAX_NOTIFICATIONS,
				...config,
			}),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				NotificationsRetentionService,
				{ provide: getRepositoryToken(NotificationEntity), useValue: repository },
				{ provide: ConfigService, useValue: configService },
			],
		}).compile();

		service = module.get(NotificationsRetentionService);
	};

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [NotificationEntity],
			synchronize: true,
		});

		await dataSource.initialize();

		repository = dataSource.getRepository(NotificationEntity);

		await buildService();
	});

	afterEach(async () => {
		jest.restoreAllMocks();

		await dataSource.destroy();
	});

	describe('boot cleanup', () => {
		it('resolves non-persistent issues that nothing has touched since the process started', async () => {
			await seed({ title: 'stale issue', kind: NotificationKind.ISSUE, key: 'connection', updatedAt: ago(1) });

			await service.onApplicationBootstrap();

			const [row] = await repository.find();
			expect(row.resolvedAt).toBeInstanceOf(Date);
		});

		it('leaves persistent issues, events and issues re-raised after boot alone', async () => {
			await seed({ title: 'persistent issue', kind: NotificationKind.ISSUE, key: 'a', persistent: true });
			await seed({ title: 'event', kind: NotificationKind.EVENT, key: 'b' });
			await seed({
				title: 'freshly raised issue',
				kind: NotificationKind.ISSUE,
				key: 'c',
				updatedAt: new Date(Date.now() + 60_000),
			});

			await service.onApplicationBootstrap();

			const rows = await repository.find({ order: { title: 'ASC' } });
			expect(rows.map((row) => row.resolvedAt)).toEqual([null, null, null]);
		});

		it('leaves an already resolved issue untouched', async () => {
			const resolvedAt = ago(2);
			await seed({ title: 'resolved issue', kind: NotificationKind.ISSUE, key: 'connection', resolvedAt });

			await service.onApplicationBootstrap();

			const [row] = await repository.find();
			expect(row.resolvedAt?.toISOString()).toBe(resolvedAt.toISOString());
		});

		it('logs and continues when the table is not there yet', async () => {
			const error = jest.spyOn(Logger.prototype, 'error');
			jest.spyOn(repository, 'find').mockRejectedValue(new Error('SQLITE_ERROR: no such table'));

			await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();

			expect(error).toHaveBeenCalledTimes(1);
		});
	});

	describe('daily retention job', () => {
		it('runs at a quarter past three every night', () => {
			const options = Reflect.getMetadata(
				SCHEDULE_CRON_OPTIONS,
				// eslint-disable-next-line @typescript-eslint/unbound-method
				NotificationsRetentionService.prototype.runRetention,
			) as { cronTime: string };

			expect(options.cronTime).toBe('15 3 * * *');
		});

		it('deletes dismissed and resolved rows past the retention window', async () => {
			await buildService({ retentionDays: 30 });

			await seed({ title: 'old dismissed', dismissedAt: ago(31) });
			await seed({ title: 'old resolved', key: 'a', resolvedAt: ago(31) });
			await seed({ title: 'recent dismissed', dismissedAt: ago(2) });
			await seed({ title: 'still active' });

			await service.runRetention();

			await expect(titles()).resolves.toEqual(['recent dismissed', 'still active']);
		});

		it('counts an event from the later of its dismissal and resolution', async () => {
			await buildService({ retentionDays: 30 });

			await seed({
				title: 'dismissed long ago, resolved recently',
				key: 'a',
				dismissedAt: ago(60),
				resolvedAt: ago(2),
			});
			await seed({ title: 'both aged out', key: 'b', dismissedAt: ago(60), resolvedAt: ago(31) });

			await service.runRetention();

			await expect(titles()).resolves.toEqual(['dismissed long ago, resolved recently']);
		});

		it('deletes an event that was dismissed longer ago than the retention window', async () => {
			await buildService({ retentionDays: 30 });

			await seed({ title: 'old dismissed event', kind: NotificationKind.EVENT, dismissedAt: ago(31) });

			await service.runRetention();

			await expect(titles()).resolves.toEqual([]);
		});

		it('keeps an issue that was dismissed but never resolved, however old the dismissal', async () => {
			await buildService({ retentionDays: 30 });

			await seed({
				title: 'dismissed but still broken',
				kind: NotificationKind.ISSUE,
				key: 'connection',
				dismissedAt: ago(400),
			});

			await service.runRetention();

			await expect(titles()).resolves.toEqual(['dismissed but still broken']);
		});

		it('deletes an issue once its resolution has aged out', async () => {
			await buildService({ retentionDays: 30 });

			await seed({ title: 'long resolved', kind: NotificationKind.ISSUE, key: 'a', resolvedAt: ago(31) });
			await seed({ title: 'recently resolved', kind: NotificationKind.ISSUE, key: 'b', resolvedAt: ago(2) });

			await service.runRetention();

			await expect(titles()).resolves.toEqual(['recently resolved']);
		});

		it('counts an issue from the later of its resolution and its dismissal', async () => {
			await buildService({ retentionDays: 30 });

			await seed({
				title: 'resolved long ago, dismissed recently',
				kind: NotificationKind.ISSUE,
				key: 'a',
				resolvedAt: ago(60),
				dismissedAt: ago(2),
			});
			await seed({
				title: 'dismissed long ago, resolved recently',
				kind: NotificationKind.ISSUE,
				key: 'b',
				dismissedAt: ago(60),
				resolvedAt: ago(2),
			});
			await seed({
				title: 'both aged out',
				kind: NotificationKind.ISSUE,
				key: 'c',
				dismissedAt: ago(60),
				resolvedAt: ago(31),
			});

			await service.runRetention();

			await expect(titles()).resolves.toEqual([
				'dismissed long ago, resolved recently',
				'resolved long ago, dismissed recently',
			]);
		});

		it('falls back to the default retention when the module config cannot be read', async () => {
			await buildService();
			configService.getModuleConfig.mockImplementation(() => {
				throw new Error('Configuration module not found.');
			});
			const warn = jest.spyOn(Logger.prototype, 'warn');

			await seed({ title: 'aged out', dismissedAt: ago(DEFAULT_RETENTION_DAYS + 1) });
			await seed({ title: 'within the window', dismissedAt: ago(DEFAULT_RETENTION_DAYS - 1) });

			await service.runRetention();

			await expect(titles()).resolves.toEqual(['within the window']);
			expect(warn).toHaveBeenCalled();
		});

		it('logs and continues when the prune fails', async () => {
			const error = jest.spyOn(Logger.prototype, 'error');
			jest.spyOn(repository, 'find').mockRejectedValue(new Error('SQLITE_ERROR: no such table'));

			await expect(service.runRetention()).resolves.toBeUndefined();

			expect(error).toHaveBeenCalledTimes(1);
		});
	});

	describe('cap enforcement', () => {
		it('evicts the oldest read events first, then the oldest unread ones', async () => {
			await buildService({ maxNotifications: 2 });

			await seed({ title: 'old read', createdAt: ago(10), readAt: ago(9) });
			await seed({ title: 'newer read', createdAt: ago(8), readAt: ago(7) });
			await seed({ title: 'old unread', createdAt: ago(6) });
			await seed({ title: 'newest unread', createdAt: ago(1) });

			await service.runRetention();

			await expect(titles()).resolves.toEqual(['newest unread', 'old unread']);
		});

		it('evicts unread events only once the read ones are gone', async () => {
			await buildService({ maxNotifications: 1 });

			await seed({ title: 'read', createdAt: ago(10), readAt: ago(9) });
			await seed({ title: 'older unread', createdAt: ago(8) });
			await seed({ title: 'newer unread', createdAt: ago(1) });

			await service.runRetention();

			await expect(titles()).resolves.toEqual(['newer unread']);
		});

		it('never evicts issues, and does not count them against the cap', async () => {
			await buildService({ maxNotifications: 2 });

			await seed({ title: 'issue one', kind: NotificationKind.ISSUE, key: 'a', createdAt: ago(10) });
			await seed({ title: 'issue two', kind: NotificationKind.ISSUE, key: 'b', createdAt: ago(9) });
			await seed({ title: 'issue three', kind: NotificationKind.ISSUE, key: 'c', createdAt: ago(8) });
			await seed({ title: 'event one', createdAt: ago(7) });
			await seed({ title: 'event two', createdAt: ago(6) });

			await service.runRetention();

			await expect(titles()).resolves.toEqual(['event one', 'event two', 'issue one', 'issue three', 'issue two']);
		});

		it('leaves dismissed and resolved events out of the cap', async () => {
			await buildService({ maxNotifications: 2 });

			await seed({ title: 'dismissed', createdAt: ago(10), dismissedAt: ago(1) });
			await seed({ title: 'active one', createdAt: ago(9) });
			await seed({ title: 'active two', createdAt: ago(8) });

			await service.runRetention();

			await expect(titles()).resolves.toEqual(['active one', 'active two', 'dismissed']);
		});

		it('does nothing while the active events stay within the cap', async () => {
			await buildService({ maxNotifications: 5 });

			await seed({ title: 'one' });
			await seed({ title: 'two' });

			await service.runRetention();

			await expect(titles()).resolves.toEqual(['one', 'two']);
		});
	});
});
