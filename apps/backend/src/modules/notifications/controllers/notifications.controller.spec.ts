import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';

import { getResponseMeta } from '../../../common/utils/http.utils';
import { ROLES_KEY } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { BulkRemoveNotificationsDto, ReqBulkRemoveNotificationsDto } from '../dto/bulk-remove-notifications.dto';
import { BulkUpdateNotificationsDto, ReqBulkUpdateNotificationsDto } from '../dto/bulk-update-notifications.dto';
import { ReqUpdateNotificationDto, UpdateNotificationDto } from '../dto/update-notification.dto';
import { NotificationEntity } from '../entities/notifications.entity';
import { NotificationKind, NotificationSeverity } from '../notifications.constants';
import { NotificationsNotFoundException } from '../notifications.exceptions';
import { NotificationsService } from '../services/notifications.service';

import { NotificationsController } from './notifications.controller';

const fakeNotification = (overrides: Partial<NotificationEntity> = {}): NotificationEntity =>
	({
		id: 'a0000000-0000-4000-8000-000000000001',
		source: 'system-module',
		kind: NotificationKind.EVENT,
		key: null,
		severity: NotificationSeverity.INFO,
		title: 'Something happened',
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
	}) as NotificationEntity;

describe('NotificationsController', () => {
	let service: jest.Mocked<Pick<NotificationsService, 'findAll' | 'findOne' | 'markRead' | 'dismiss' | 'remove'>>;
	let controller: NotificationsController;

	beforeEach(() => {
		service = {
			findAll: jest.fn().mockResolvedValue([]),
			findOne: jest.fn().mockResolvedValue(null),
			markRead: jest.fn(),
			dismiss: jest.fn(),
			remove: jest.fn().mockResolvedValue(undefined),
		};

		controller = new NotificationsController(service as unknown as NotificationsService);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('role metadata', () => {
		it.each(['findAll', 'findOne', 'update', 'remove', 'bulkUpdate', 'bulkRemove'] as const)(
			'requires owner or admin on %s',
			(method) => {
				const handler = NotificationsController.prototype[method];

				expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.OWNER, UserRole.ADMIN]);
			},
		);
	});

	describe('findAll', () => {
		it('forwards parsed filters, normalises severity and requests one extra row', async () => {
			const req = {} as Request;

			await controller.findAll(
				req,
				'dismissed',
				['warning', 'error'],
				'system-module',
				NotificationKind.ISSUE,
				'true',
				'cursor-id',
				10,
			);

			expect(service.findAll).toHaveBeenCalledWith({
				status: 'dismissed',
				severity: [NotificationSeverity.WARNING, NotificationSeverity.ERROR],
				source: 'system-module',
				kind: NotificationKind.ISSUE,
				unread: true,
				afterId: 'cursor-id',
				limit: 11,
			});
		});

		it('normalises a single severity string into an array', async () => {
			const req = {} as Request;

			await controller.findAll(req, undefined, 'warning');

			expect(service.findAll).toHaveBeenCalledWith(
				expect.objectContaining({ severity: [NotificationSeverity.WARNING] }),
			);
		});

		it('rejects an invalid severity value instead of reaching the service', async () => {
			const req = {} as Request;

			await expect(controller.findAll(req, undefined, 'bogus')).rejects.toBeInstanceOf(BadRequestException);
			expect(service.findAll).not.toHaveBeenCalled();
		});

		it('falls back to the default limit for a non-numeric value', async () => {
			const req = {} as Request;

			await controller.findAll(req, undefined, undefined, undefined, undefined, undefined, undefined, 'abc');

			// Default page size is 50, so the service is asked for one extra row.
			expect(service.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 51 }));
		});

		it('clamps a zero limit up to the floor of the valid range instead of rejecting it', async () => {
			const req = {} as Request;

			await controller.findAll(req, undefined, undefined, undefined, undefined, undefined, undefined, 0);

			expect(service.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 2 }));
		});

		it('paginates 3 equally-timed rows across two pages of limit 2 without loss or repeat', async () => {
			const c = fakeNotification({ id: 'row-c' });
			const b = fakeNotification({ id: 'row-b' });
			const a = fakeNotification({ id: 'row-a' });

			service.findAll.mockResolvedValueOnce([c, b, a]);

			const firstReq = {} as Request;
			const firstPage = await controller.findAll(
				firstReq,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				2,
			);

			expect(firstPage.data).toEqual([c, b]);
			expect(getResponseMeta(firstReq)).toEqual({ next_cursor: 'row-b', has_more: true });

			service.findAll.mockResolvedValueOnce([a]);

			const secondReq = {} as Request;
			const secondPage = await controller.findAll(
				secondReq,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				'row-b',
				2,
			);

			expect(secondPage.data).toEqual([a]);
			expect(getResponseMeta(secondReq)).toEqual({ next_cursor: undefined, has_more: false });
			expect(service.findAll).toHaveBeenLastCalledWith(expect.objectContaining({ afterId: 'row-b', limit: 3 }));
		});

		it('reports has_more and a cursor at the maximum page size boundary (limit=200, 201 rows)', async () => {
			const rows = Array.from({ length: 201 }, (_, index) => fakeNotification({ id: `row-${index}` }));

			service.findAll.mockResolvedValueOnce(rows);

			const req = {} as Request;
			const response = await controller.findAll(
				req,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				200,
			);

			expect(service.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 201 }));
			expect(response.data).toHaveLength(200);
			expect(response.data[199].id).toBe('row-199');
			expect(getResponseMeta(req)).toEqual({ next_cursor: 'row-199', has_more: true });
		});
	});

	describe('findOne', () => {
		it('returns the wrapped notification', async () => {
			const notification = fakeNotification();
			service.findOne.mockResolvedValue(notification);

			const response = await controller.findOne(notification.id);

			expect(response.data).toBe(notification);
		});

		it('404s when the row does not exist', async () => {
			service.findOne.mockResolvedValue(null);

			await expect(controller.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
		});
	});

	describe('update', () => {
		const body = (data: Partial<UpdateNotificationDto>): ReqUpdateNotificationDto =>
			({ data }) as ReqUpdateNotificationDto;

		it('marks read when only read is provided, leaving dismissed alone', async () => {
			const notification = fakeNotification();
			service.findOne.mockResolvedValue(notification);
			service.markRead.mockResolvedValue(fakeNotification({ readAt: new Date() }));

			await controller.update(notification.id, body({ read: true }));

			expect(service.markRead).toHaveBeenCalledWith(notification.id, true);
			expect(service.dismiss).not.toHaveBeenCalled();
		});

		it('dismisses when only dismissed is provided, leaving read alone', async () => {
			const notification = fakeNotification();
			service.findOne.mockResolvedValue(notification);
			service.dismiss.mockResolvedValue(fakeNotification({ dismissedAt: null }));

			await controller.update(notification.id, body({ dismissed: false }));

			expect(service.dismiss).toHaveBeenCalledWith(notification.id, false);
			expect(service.markRead).not.toHaveBeenCalled();
		});

		it('applies both fields when both are provided and returns the latest state', async () => {
			const notification = fakeNotification();
			service.findOne.mockResolvedValue(notification);
			service.markRead.mockResolvedValue(fakeNotification({ readAt: new Date() }));
			const finalState = fakeNotification({ readAt: new Date(), dismissedAt: new Date() });
			service.dismiss.mockResolvedValue(finalState);

			const response = await controller.update(notification.id, body({ read: true, dismissed: true }));

			expect(service.markRead).toHaveBeenCalledWith(notification.id, true);
			expect(service.dismiss).toHaveBeenCalledWith(notification.id, true);
			expect(response.data).toBe(finalState);
		});

		it('404s when the row does not exist, without calling the service', async () => {
			service.findOne.mockResolvedValue(null);

			await expect(controller.update('missing', body({ read: true }))).rejects.toBeInstanceOf(NotFoundException);
			expect(service.markRead).not.toHaveBeenCalled();
		});
	});

	describe('remove', () => {
		it('removes an existing notification', async () => {
			const notification = fakeNotification();
			service.findOne.mockResolvedValue(notification);

			await controller.remove(notification.id);

			expect(service.remove).toHaveBeenCalledWith(notification.id);
		});

		it('404s when the row does not exist, without calling the service', async () => {
			service.findOne.mockResolvedValue(null);

			await expect(controller.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
			expect(service.remove).not.toHaveBeenCalled();
		});
	});

	describe('bulkUpdate', () => {
		it('collects a failure without aborting the rest of the selection', async () => {
			service.markRead.mockImplementation((id: string) => {
				if (id === 'bad-id') {
					throw new NotificationsNotFoundException(`Notification with id=${id} not found`);
				}

				return Promise.resolve(fakeNotification({ id, readAt: new Date() }));
			});

			const requestBody: ReqBulkUpdateNotificationsDto = {
				data: { ids: ['good-id', 'bad-id'], read: true } as BulkUpdateNotificationsDto,
			};

			const response = await controller.bulkUpdate(requestBody);

			expect(response.data.succeeded).toEqual(['good-id']);
			expect(response.data.failed).toEqual([{ id: 'bad-id', reason: 'Notification with id=bad-id not found' }]);
			expect(service.markRead).toHaveBeenCalledTimes(2);
		});

		it('reports an unexpected failure with the fallback reason instead of leaking it', async () => {
			service.markRead.mockRejectedValueOnce(new Error('boom'));

			const requestBody: ReqBulkUpdateNotificationsDto = {
				data: { ids: ['id-1'], read: true } as BulkUpdateNotificationsDto,
			};

			const response = await controller.bulkUpdate(requestBody);

			expect(response.data.failed).toEqual([{ id: 'id-1', reason: 'Notification could not be updated' }]);
		});

		it('skips both service calls when neither read nor dismissed is provided', async () => {
			const requestBody: ReqBulkUpdateNotificationsDto = {
				data: { ids: ['id-1'] } as BulkUpdateNotificationsDto,
			};

			await controller.bulkUpdate(requestBody);

			expect(service.markRead).not.toHaveBeenCalled();
			expect(service.dismiss).not.toHaveBeenCalled();
		});
	});

	describe('bulkRemove', () => {
		it('removes every id and reports succeeded and failed separately', async () => {
			service.remove.mockImplementation((id: string) => {
				if (id === 'bad-id') {
					throw new NotificationsNotFoundException(`Notification with id=${id} not found`);
				}

				return Promise.resolve();
			});

			const requestBody: ReqBulkRemoveNotificationsDto = {
				data: { ids: ['good-id', 'bad-id'] } as BulkRemoveNotificationsDto,
			};

			const response = await controller.bulkRemove(requestBody);

			expect(response.data.succeeded).toEqual(['good-id']);
			expect(response.data.failed).toEqual([{ id: 'bad-id', reason: 'Notification with id=bad-id not found' }]);
		});
	});
});
