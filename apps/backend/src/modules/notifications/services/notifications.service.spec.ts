import { DataSource, IsNull, Repository } from 'typeorm';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { NotificationEntity } from '../entities/notifications.entity';
import {
	EventType,
	NOTIFICATIONS_MAX_PAGE_SIZE,
	NOTIFICATION_MESSAGE_MAX_LENGTH,
	NOTIFICATION_RATE_LIMIT_PER_MINUTE,
	NOTIFICATION_TITLE_MAX_LENGTH,
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../notifications.constants';
import { NotificationsNotFoundException } from '../notifications.exceptions';

import { NotificationInputValidator } from './notification-input.validator';
import { CreateNotificationInput, NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
	let dataSource: DataSource;
	let repository: Repository<NotificationEntity>;
	let service: NotificationsService;
	let eventEmitter: { emit: jest.Mock };

	const baseInput = (overrides: Partial<CreateNotificationInput> = {}): CreateNotificationInput => ({
		source: 'system-module',
		kind: NotificationKind.EVENT,
		severity: NotificationSeverity.INFO,
		title: 'Something happened',
		...overrides,
	});

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
				createdAt: new Date('2026-09-01T10:00:00.000Z'),
				updatedAt: new Date('2026-09-01T10:00:00.000Z'),
				...overrides,
			}),
		);

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [NotificationEntity],
			synchronize: true,
		});

		await dataSource.initialize();

		repository = dataSource.getRepository(NotificationEntity);
		eventEmitter = { emit: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				NotificationsService,
				NotificationInputValidator,
				{ provide: getRepositoryToken(NotificationEntity), useValue: repository },
				{ provide: EventEmitter2, useValue: eventEmitter },
			],
		}).compile();

		service = module.get(NotificationsService);
	});

	afterEach(async () => {
		jest.restoreAllMocks();

		await dataSource.destroy();
	});

	describe('notify - events without a key', () => {
		it('inserts a fresh row with a single occurrence and an untouched lifecycle', async () => {
			const created = await service.notify(baseInput());

			expect(created).not.toBeNull();
			expect(created).toMatchObject({
				source: 'system-module',
				kind: NotificationKind.EVENT,
				key: null,
				occurrences: 1,
				readAt: null,
				dismissedAt: null,
				resolvedAt: null,
			});
			await expect(repository.count()).resolves.toBe(1);
		});

		it('inserts a second row rather than aggregating', async () => {
			const first = await service.notify(baseInput());
			const second = await service.notify(baseInput());

			expect(second?.id).not.toBe(first?.id);
			await expect(repository.count()).resolves.toBe(2);
		});
	});

	describe('notify - events with a key', () => {
		it('upserts onto the same row, counts the occurrence and replaces the content', async () => {
			const first = await service.notify(baseInput({ key: 'login-failed:admin', title: 'One failed login' }));

			const second = await service.notify(
				baseInput({
					key: 'login-failed:admin',
					title: 'Two failed logins',
					message: 'Second attempt from 192.168.1.20',
					severity: NotificationSeverity.WARNING,
					actions: [{ type: NotificationActionType.LINK, label: 'Open', url: '/users' }],
					data: { attempts: 2 },
				}),
			);

			expect(second?.id).toBe(first?.id);
			expect(second).toMatchObject({
				occurrences: 2,
				title: 'Two failed logins',
				message: 'Second attempt from 192.168.1.20',
				severity: NotificationSeverity.WARNING,
				data: { attempts: 2 },
			});
			expect(second?.actions).toEqual([{ type: NotificationActionType.LINK, label: 'Open', url: '/users' }]);
			await expect(repository.count()).resolves.toBe(1);
		});

		it('re-opens the aggregation by clearing read and dismissed marks', async () => {
			const first = await service.notify(baseInput({ key: 'login-failed:admin' }));

			await service.markRead(first.id, true);
			await service.dismiss(first.id, true);

			const second = await service.notify(baseInput({ key: 'login-failed:admin' }));

			expect(second).toMatchObject({ readAt: null, dismissedAt: null });
		});
	});

	describe('notify - issues', () => {
		const issue = (overrides: Partial<CreateNotificationInput> = {}) =>
			baseInput({
				kind: NotificationKind.ISSUE,
				key: 'connection',
				severity: NotificationSeverity.ERROR,
				title: 'Connection lost',
				...overrides,
			});

		it('upserts onto the same row and replaces the content', async () => {
			const first = await service.notify(issue());
			const second = await service.notify(issue({ title: 'Still disconnected', message: 'Retry 4 failed' }));

			expect(second?.id).toBe(first?.id);
			expect(second).toMatchObject({ occurrences: 2, title: 'Still disconnected', message: 'Retry 4 failed' });
		});

		it('keeps read and dismissed marks so a dismissed issue stays hidden', async () => {
			const first = await service.notify(issue());

			await service.markRead(first.id, true);
			await service.dismiss(first.id, true);

			const second = await service.notify(issue());

			expect(second?.readAt).toBeInstanceOf(Date);
			expect(second?.dismissedAt).toBeInstanceOf(Date);
		});

		it('refuses an issue without a key and warns once', async () => {
			const warn = jest.spyOn(Logger.prototype, 'warn');

			await expect(service.notify(issue({ key: undefined }))).resolves.toBeNull();

			await expect(repository.count()).resolves.toBe(0);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});
	});

	describe('resolve', () => {
		it('closes the aggregation so the next notify starts a fresh row', async () => {
			const first = await service.notify(
				baseInput({ kind: NotificationKind.ISSUE, key: 'connection', severity: NotificationSeverity.ERROR }),
			);

			await expect(service.resolve('system-module', 'connection')).resolves.toBe(true);

			const reloaded = await repository.findOne({ where: { id: first.id } });
			expect(reloaded?.resolvedAt).toBeInstanceOf(Date);

			const second = await service.notify(
				baseInput({ kind: NotificationKind.ISSUE, key: 'connection', severity: NotificationSeverity.ERROR }),
			);

			expect(second?.id).not.toBe(first?.id);
			expect(second?.occurrences).toBe(1);
			await expect(repository.count()).resolves.toBe(2);
		});

		it('returns false when the source only has unkeyed rows', async () => {
			await service.notify(baseInput());

			await expect(service.resolve('system-module', 'connection')).resolves.toBe(false);
		});

		it('returns false when no key is given', async () => {
			await expect(service.resolve('system-module', '')).resolves.toBe(false);
		});
	});

	describe('resolveAll', () => {
		it('resolves every active keyed row of the source and reports how many', async () => {
			await service.notify(baseInput({ kind: NotificationKind.ISSUE, key: 'connection' }));
			await service.notify(baseInput({ kind: NotificationKind.ISSUE, key: 'auth' }));
			await service.notify(baseInput());
			await service.notify(baseInput({ source: 'weather-module', kind: NotificationKind.ISSUE, key: 'connection' }));

			await expect(service.resolveAll('system-module')).resolves.toBe(2);

			const untouched = await repository.find({ where: { resolvedAt: IsNull() } });
			expect(untouched.map((row) => `${row.source}:${row.key ?? 'none'}`).sort()).toEqual([
				'system-module:none',
				'weather-module:connection',
			]);
		});

		it('reports zero when the source has nothing active', async () => {
			await expect(service.resolveAll('system-module')).resolves.toBe(0);
		});
	});

	describe('notify - validation', () => {
		it('truncates the title and the message', async () => {
			const created = await service.notify(
				baseInput({
					title: 'a'.repeat(NOTIFICATION_TITLE_MAX_LENGTH + 10),
					message: 'b'.repeat(NOTIFICATION_MESSAGE_MAX_LENGTH + 10),
				}),
			);

			expect(created?.title).toHaveLength(NOTIFICATION_TITLE_MAX_LENGTH);
			expect(created?.message).toHaveLength(NOTIFICATION_MESSAGE_MAX_LENGTH);
		});

		it('drops the fourth action', async () => {
			const link = (label: string) => ({ type: NotificationActionType.LINK as const, label, url: '/system/info' });

			const created = await service.notify(
				baseInput({ actions: [link('one'), link('two'), link('three'), link('four')] }),
			);

			expect(created?.actions).toHaveLength(3);
		});

		it.each([
			[
				'a link with a javascript scheme',
				baseInput({ actions: [{ type: NotificationActionType.LINK, label: 'Run', url: 'javascript:alert(1)' }] }),
			],
			['an oversized data payload', baseInput({ data: { blob: 'x'.repeat(5000) } })],
			['a nested data payload', baseInput({ data: { nested: { deep: true } } as never })],
			['an unknown severity', baseInput({ severity: 'catastrophic' as NotificationSeverity })],
		])('refuses %s', async (_label, input) => {
			const warn = jest.spyOn(Logger.prototype, 'warn');

			await expect(service.notify(input)).resolves.toBeNull();

			await expect(repository.count()).resolves.toBe(0);
			expect(warn).toHaveBeenCalledTimes(1);
		});
	});

	describe('notify - rate guard', () => {
		it('drops calls beyond the per-minute budget and warns once per source', async () => {
			const warn = jest.spyOn(Logger.prototype, 'warn');

			for (let attempt = 0; attempt < NOTIFICATION_RATE_LIMIT_PER_MINUTE; attempt++) {
				await expect(service.notify(baseInput())).resolves.not.toBeNull();
			}

			await expect(service.notify(baseInput())).resolves.toBeNull();
			await expect(service.notify(baseInput())).resolves.toBeNull();

			await expect(repository.count()).resolves.toBe(NOTIFICATION_RATE_LIMIT_PER_MINUTE);
			expect(warn).toHaveBeenCalledTimes(1);
		});

		it('budgets each source separately', async () => {
			for (let attempt = 0; attempt < NOTIFICATION_RATE_LIMIT_PER_MINUTE; attempt++) {
				await service.notify(baseInput());
			}

			await expect(service.notify(baseInput())).resolves.toBeNull();
			await expect(service.notify(baseInput({ source: 'weather-module' }))).resolves.not.toBeNull();
		});

		it('starts a new budget once the window has passed', async () => {
			const startedAt = Date.now();
			const clock = jest.spyOn(Date, 'now').mockReturnValue(startedAt);

			for (let attempt = 0; attempt < NOTIFICATION_RATE_LIMIT_PER_MINUTE; attempt++) {
				await service.notify(baseInput());
			}

			await expect(service.notify(baseInput())).resolves.toBeNull();

			clock.mockReturnValue(startedAt + 60_001);

			await expect(service.notify(baseInput())).resolves.not.toBeNull();
		});
	});

	describe('notify - storage failures', () => {
		it('swallows a write failure, logs it and returns null', async () => {
			const error = jest.spyOn(Logger.prototype, 'error');
			jest.spyOn(repository, 'save').mockRejectedValue(new Error('SQLITE_ERROR: no such table'));

			await expect(service.notify(baseInput())).resolves.toBeNull();

			expect(error).toHaveBeenCalledTimes(1);
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});
	});

	describe('events', () => {
		it('emits a created pointer on insert and an updated pointer on upsert', async () => {
			const created = await service.notify(baseInput({ key: 'update-available' }));

			expect(eventEmitter.emit).toHaveBeenNthCalledWith(1, EventType.NOTIFICATION_CREATED, {
				id: created.id,
				kind: NotificationKind.EVENT,
				severity: NotificationSeverity.INFO,
				source: 'system-module',
			});

			await service.notify(baseInput({ key: 'update-available' }));

			expect(eventEmitter.emit).toHaveBeenNthCalledWith(2, EventType.NOTIFICATION_UPDATED, {
				id: created.id,
				kind: NotificationKind.EVENT,
				severity: NotificationSeverity.INFO,
				source: 'system-module',
			});
		});

		it('emits an updated pointer when a notification is read, dismissed or resolved', async () => {
			const created = await service.notify(baseInput({ kind: NotificationKind.ISSUE, key: 'connection' }));
			eventEmitter.emit.mockClear();

			await service.markRead(created.id, true);
			await service.dismiss(created.id, true);
			await service.resolve('system-module', 'connection');

			const pointer = {
				id: created.id,
				kind: NotificationKind.ISSUE,
				severity: NotificationSeverity.INFO,
				source: 'system-module',
			};

			expect(eventEmitter.emit).toHaveBeenCalledTimes(3);
			expect(eventEmitter.emit).toHaveBeenNthCalledWith(1, EventType.NOTIFICATION_UPDATED, pointer);
			expect(eventEmitter.emit).toHaveBeenNthCalledWith(2, EventType.NOTIFICATION_UPDATED, pointer);
			expect(eventEmitter.emit).toHaveBeenNthCalledWith(3, EventType.NOTIFICATION_UPDATED, pointer);
		});

		it('emits a deleted pointer carrying only the id', async () => {
			const created = await service.notify(baseInput());
			eventEmitter.emit.mockClear();

			await service.remove(created.id);

			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.NOTIFICATION_DELETED, { id: created.id });
		});
	});

	describe('markRead, dismiss and remove', () => {
		it('marks a notification read and unread again', async () => {
			const created = await service.notify(baseInput());

			await expect(service.markRead(created.id, true)).resolves.toMatchObject({ readAt: expect.any(Date) as Date });
			await expect(service.markRead(created.id, false)).resolves.toMatchObject({ readAt: null });
		});

		it('dismisses a notification and restores it', async () => {
			const created = await service.notify(baseInput());

			await expect(service.dismiss(created.id, true)).resolves.toMatchObject({ dismissedAt: expect.any(Date) as Date });
			await expect(service.dismiss(created.id, false)).resolves.toMatchObject({ dismissedAt: null });
		});

		it('removes the row', async () => {
			const created = await service.notify(baseInput());

			await service.remove(created.id);

			await expect(repository.count()).resolves.toBe(0);
		});

		it.each([
			['markRead', (id: string) => service.markRead(id, true)],
			['dismiss', (id: string) => service.dismiss(id, true)],
			['remove', (id: string) => service.remove(id)],
		])('reports %s against an unknown id as not found', async (_label, call) => {
			await expect(call('11111111-1111-4111-8111-111111111111')).rejects.toThrow(NotificationsNotFoundException);
		});
	});

	describe('findOne and countUnread', () => {
		it('returns null for an unknown id', async () => {
			await expect(service.findOne('11111111-1111-4111-8111-111111111111')).resolves.toBeNull();
		});

		it('counts only unread rows that are neither dismissed nor resolved', async () => {
			await seed({ title: 'unread active' });
			await seed({ title: 'read active', readAt: new Date() });
			await seed({ title: 'unread dismissed', dismissedAt: new Date() });
			await seed({ title: 'unread resolved', key: 'a', resolvedAt: new Date() });

			await expect(service.countUnread()).resolves.toBe(1);
		});
	});

	describe('findAll', () => {
		const at = (iso: string) => new Date(iso);

		beforeEach(async () => {
			await seed({ title: 'oldest active', createdAt: at('2026-09-01T10:00:00.000Z') });
			await seed({ title: 'newest active', createdAt: at('2026-09-01T12:00:00.000Z'), readAt: new Date() });
			await seed({ title: 'middle active', createdAt: at('2026-09-01T11:00:00.000Z') });
			await seed({ title: 'dismissed', createdAt: at('2026-09-01T13:00:00.000Z'), dismissedAt: new Date() });
			await seed({ title: 'resolved', createdAt: at('2026-09-01T14:00:00.000Z'), key: 'x', resolvedAt: new Date() });
		});

		it('returns active rows newest first by default', async () => {
			const rows = await service.findAll({});

			expect(rows.map((row) => row.title)).toEqual(['newest active', 'middle active', 'oldest active']);
		});

		it('returns dismissed, resolved or every row on request', async () => {
			await expect(service.findAll({ status: 'dismissed' })).resolves.toHaveLength(1);
			await expect(service.findAll({ status: 'resolved' })).resolves.toHaveLength(1);
			await expect(service.findAll({ status: 'all' })).resolves.toHaveLength(5);
		});

		it('filters by unread', async () => {
			const unread = await service.findAll({ unread: true });

			expect(unread.map((row) => row.title)).toEqual(['middle active', 'oldest active']);
		});

		it('filters by severity, source and kind', async () => {
			await seed({
				title: 'warning from weather',
				source: 'weather-module',
				kind: NotificationKind.ISSUE,
				key: 'forecast',
				severity: NotificationSeverity.WARNING,
				createdAt: at('2026-09-01T15:00:00.000Z'),
			});

			await expect(service.findAll({ severity: [NotificationSeverity.WARNING] })).resolves.toHaveLength(1);
			await expect(service.findAll({ source: 'weather-module' })).resolves.toHaveLength(1);
			await expect(service.findAll({ kind: NotificationKind.ISSUE })).resolves.toHaveLength(1);
		});

		it('continues after the cursor row', async () => {
			const [first] = await service.findAll({});

			const next = await service.findAll({ afterId: first.id });

			expect(next.map((row) => row.title)).toEqual(['middle active', 'oldest active']);
		});

		it('ignores a cursor that no longer exists', async () => {
			const rows = await service.findAll({ afterId: '11111111-1111-4111-8111-111111111111' });

			expect(rows).toHaveLength(3);
		});

		it('honours the requested limit', async () => {
			await expect(service.findAll({ limit: 2 })).resolves.toHaveLength(2);
		});

		it('caps the limit', async () => {
			const find = jest.spyOn(repository, 'find');

			await service.findAll({ limit: 5_000 });

			expect(find.mock.calls[0][0]?.take).toBe(NOTIFICATIONS_MAX_PAGE_SIZE);
		});
	});
});
