import { createPinia, setActivePinia } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationsModuleNotificationKind, NotificationsModuleNotificationSeverity } from '../../../openapi.constants';

import { matchesListQuery, useNotifications } from './notifications.store';
import type { INotification, INotificationRes } from './notifications.store.schemas';

// `vi.mock` factories are hoisted above regular top-level declarations, so anything they
// reference directly (not merely wrapped in a function that runs later) has to go through
// `vi.hoisted` to avoid a temporal-dead-zone `ReferenceError` at import time.
const { mockBackendClient, mockLogger } = vi.hoisted(() => ({
	mockBackendClient: {
		GET: vi.fn(),
		POST: vi.fn(),
		PATCH: vi.fn(),
		DELETE: vi.fn(),
	},
	mockLogger: {
		log: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		fatal: vi.fn(),
	},
}));

vi.mock('../../../common', async () => {
	const utils = await vi.importActual('../../../common/utils/utils');
	const composables = await vi.importActual('../../../common/composables/composables');
	const services = await vi.importActual('../../../common/services/services');
	const store = await vi.importActual('../../../common/store/stores');
	const constants = await vi.importActual('../../../common/common.constants');

	return {
		...utils,
		...composables,
		...services,
		...store,
		...constants,
		useBackend: vi.fn(() => ({
			client: mockBackendClient,
		})),
		logger: mockLogger,
	};
});

const notificationFixture = (overrides: Partial<INotificationRes> = {}): INotificationRes =>
	({
		id: uuid(),
		source: 'system-module',
		kind: NotificationsModuleNotificationKind.event,
		key: null,
		severity: NotificationsModuleNotificationSeverity.warning,
		title: 'Something happened',
		message: null,
		actions: [],
		data: null,
		persistent: false,
		occurrences: 1,
		read_at: null,
		dismissed_at: null,
		resolved_at: null,
		created_at: '2026-09-02T12:00:00.000Z',
		updated_at: null,
		...overrides,
	}) as unknown as INotificationRes;

describe('Notifications Store', () => {
	let store: ReturnType<typeof useNotifications>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useNotifications();

		vi.clearAllMocks();
	});

	describe('set / unset / onEvent', () => {
		it('inserts a new row through set()', () => {
			const id = uuid();

			const notification = store.set({
				id,
				data: {
					source: 'system-module',
					kind: NotificationsModuleNotificationKind.event,
					severity: NotificationsModuleNotificationSeverity.info,
					title: 'Backup finished',
					createdAt: new Date('2026-09-02T12:00:00.000Z'),
				},
			});

			expect(notification.id).toBe(id);
			expect(notification.title).toBe('Backup finished');
			expect(store.findById(id)).not.toBeNull();
		});

		it('merges a partial update into an existing row through set()', () => {
			const id = uuid();

			store.set({
				id,
				data: {
					source: 'system-module',
					kind: NotificationsModuleNotificationKind.event,
					severity: NotificationsModuleNotificationSeverity.info,
					title: 'Backup finished',
					createdAt: new Date('2026-09-02T12:00:00.000Z'),
				},
			});

			const updated = store.set({
				id,
				data: { title: 'Backup finished (retry)' },
			});

			expect(updated.title).toBe('Backup finished (retry)');
			expect(updated.source).toBe('system-module');
		});

		it('rejects a row that fails schema validation', () => {
			expect(() =>
				store.set({
					id: uuid(),
					// Missing every required field (source, kind, severity, title, createdAt).
					data: {},
				})
			).toThrow();
		});

		it('removes a row through unset() and drops it from listIds', async () => {
			const notification = notificationFixture();

			mockBackendClient.GET.mockResolvedValueOnce({
				data: { data: [notification], metadata: { has_more: false, next_cursor: undefined } },
				error: undefined,
				response: { status: 200, ok: true },
			});

			await store.fetch();

			expect(store.findById(notification.id)).not.toBeNull();
			expect(store.list().map((item) => item.id)).toContain(notification.id);

			store.unset({ id: notification.id });

			expect(store.findById(notification.id)).toBeNull();
			expect(store.list().map((item) => item.id)).not.toContain(notification.id);
		});

		it('parses a wire-shaped payload through onEvent()', () => {
			const notification = notificationFixture({ title: 'Home Assistant connection lost', severity: NotificationsModuleNotificationSeverity.error });

			const parsed = store.onEvent({ id: notification.id, data: notification as unknown as Record<string, unknown> });

			expect(parsed.title).toBe('Home Assistant connection lost');
			expect(parsed.severity).toBe(NotificationsModuleNotificationSeverity.error);
			expect(store.findById(notification.id)?.title).toBe('Home Assistant connection lost');
		});

		it('keeps data and action params untouched by case conversion', () => {
			const notification = notificationFixture({
				data: { failed_attempts: 3, remote_ip: '10.0.0.5' },
				actions: [
					{
						type: 'extension_action',
						label: 'Retry',
						extension_type: 'devices-home-assistant-plugin',
						action_id: 'reconnect',
						params: { force_reload: true },
					},
				],
			} as Partial<INotificationRes>);

			const parsed = store.onEvent({ id: notification.id, data: notification as unknown as Record<string, unknown> });

			expect(parsed.data).toEqual({ failed_attempts: 3, remote_ip: '10.0.0.5' });
			expect(parsed.actions[0]?.params).toEqual({ force_reload: true });
			expect(parsed.actions[0]?.extensionType).toBe('devices-home-assistant-plugin');
			expect(parsed.actions[0]?.actionId).toBe('reconnect');
		});
	});

	describe('live list', () => {
		const listResponse = (rows: INotificationRes[]) => ({
			data: { data: rows, metadata: { has_more: false, next_cursor: undefined } },
			error: undefined,
			response: { status: 200, ok: true },
		});

		const rowResponse = (row: INotificationRes) => ({
			data: { data: row },
			error: undefined,
			response: { status: 200, ok: true },
		});

		it('slots a row read through get() at the top of the open list when it matches the list query', async () => {
			const listed = notificationFixture({ id: uuid() });
			const created = notificationFixture({ id: uuid() });

			mockBackendClient.GET.mockResolvedValueOnce(listResponse([listed]));

			await store.fetch({ status: 'active' });

			mockBackendClient.GET.mockResolvedValueOnce(rowResponse(created));

			await store.get({ id: created.id });

			expect(store.list().map((item) => item.id)).toEqual([created.id, listed.id]);
		});

		it('keeps a row that falls outside the open list query out of the list, while still storing it', async () => {
			const listed = notificationFixture({ id: uuid() });
			const alreadyRead = notificationFixture({ id: uuid(), read_at: '2026-09-02T12:30:00.000Z' });

			mockBackendClient.GET.mockResolvedValueOnce(listResponse([listed]));

			await store.fetch({ unread: true });

			mockBackendClient.GET.mockResolvedValueOnce(rowResponse(alreadyRead));

			await store.get({ id: alreadyRead.id });

			expect(store.list().map((item) => item.id)).toEqual([listed.id]);
			expect(store.findById(alreadyRead.id)).not.toBeNull();
		});

		it('reads a list fetched without a status as the active list, exactly like the backend does', async () => {
			const dismissed = notificationFixture({ id: uuid(), dismissed_at: '2026-09-02T12:30:00.000Z' });
			const active = notificationFixture({ id: uuid() });

			mockBackendClient.GET.mockResolvedValueOnce(listResponse([]));

			await store.fetch();

			mockBackendClient.GET.mockResolvedValueOnce(rowResponse(dismissed));

			await store.get({ id: dismissed.id });

			mockBackendClient.GET.mockResolvedValueOnce(rowResponse(active));

			await store.get({ id: active.id });

			expect(store.list().map((item) => item.id)).toEqual([active.id]);
		});

		it('leaves the list alone before it has been read for the first time', async () => {
			const created = notificationFixture({ id: uuid() });

			mockBackendClient.GET.mockResolvedValueOnce(rowResponse(created));

			await store.get({ id: created.id });

			expect(store.list()).toEqual([]);
			expect(store.findById(created.id)).not.toBeNull();
		});

		it('does not list a row twice when get() re-reads one that is already listed', async () => {
			const listed = notificationFixture({ id: uuid() });

			mockBackendClient.GET.mockResolvedValueOnce(listResponse([listed]));

			await store.fetch({ status: 'all' });

			mockBackendClient.GET.mockResolvedValueOnce(rowResponse({ ...listed, title: 'Updated title' }));

			await store.get({ id: listed.id });

			expect(store.list().map((item) => item.id)).toEqual([listed.id]);
			expect(store.findById(listed.id)?.title).toBe('Updated title');
		});

		it('keeps the query of the first page when later pages are appended', async () => {
			const first = notificationFixture({ id: uuid() });
			const second = notificationFixture({ id: uuid() });
			const created = notificationFixture({ id: uuid() });

			mockBackendClient.GET.mockResolvedValueOnce(listResponse([first]));

			await store.fetch({ status: 'active', source: 'system-module' });

			mockBackendClient.GET.mockResolvedValueOnce(listResponse([second]));

			await store.fetch({ status: 'active', source: 'system-module', afterId: first.id, append: true });

			mockBackendClient.GET.mockResolvedValueOnce(rowResponse(created));

			await store.get({ id: created.id });

			expect(store.list().map((item) => item.id)).toEqual([created.id, first.id, second.id]);
		});
	});

	describe('matchesListQuery()', () => {
		const row = (overrides: Partial<INotification> = {}): INotification => ({
			id: uuid(),
			source: 'system-module',
			kind: NotificationsModuleNotificationKind.issue,
			key: null,
			severity: NotificationsModuleNotificationSeverity.warning,
			title: 'Update available',
			message: null,
			actions: [],
			data: null,
			persistent: false,
			occurrences: 1,
			readAt: null,
			dismissedAt: null,
			resolvedAt: null,
			createdAt: new Date('2026-09-02T12:00:00.000Z'),
			updatedAt: null,
			...overrides,
		});

		const dismissedAt = new Date('2026-09-02T13:00:00.000Z');
		const resolvedAt = new Date('2026-09-02T14:00:00.000Z');
		const readAt = new Date('2026-09-02T12:30:00.000Z');

		it.each([
			['no status', {}, row(), true],
			['no status, dismissed row', {}, row({ dismissedAt }), false],
			['no status, resolved row', {}, row({ resolvedAt }), false],
			['active', { status: 'active' as const }, row(), true],
			['active, dismissed row', { status: 'active' as const }, row({ dismissedAt }), false],
			['dismissed', { status: 'dismissed' as const }, row({ dismissedAt }), true],
			['dismissed, active row', { status: 'dismissed' as const }, row(), false],
			['resolved', { status: 'resolved' as const }, row({ resolvedAt }), true],
			['resolved, active row', { status: 'resolved' as const }, row(), false],
			['all, dismissed row', { status: 'all' as const }, row({ dismissedAt }), true],
			['all, resolved row', { status: 'all' as const }, row({ resolvedAt }), true],
			['severity in selection', { severity: [NotificationsModuleNotificationSeverity.warning] }, row(), true],
			['severity outside selection', { severity: [NotificationsModuleNotificationSeverity.error] }, row(), false],
			['empty severity selection', { severity: [] }, row(), true],
			['same source', { source: 'system-module' }, row(), true],
			['other source', { source: 'security-module' }, row(), false],
			['same kind', { kind: NotificationsModuleNotificationKind.issue }, row(), true],
			['other kind', { kind: NotificationsModuleNotificationKind.event }, row(), false],
			['unread only, unread row', { unread: true }, row(), true],
			['unread only, read row', { unread: true }, row({ readAt }), false],
			['read only, read row', { unread: false }, row({ readAt }), true],
			['read only, unread row', { unread: false }, row(), false],
		])('%s', (_name, query, notification, expected) => {
			expect(matchesListQuery(notification, query)).toBe(expected);
		});
	});

	describe('fetch()', () => {
		it('resets listIds on a plain fetch and keeps items merged by id', async () => {
			const first = notificationFixture({ title: 'First page row' });

			mockBackendClient.GET.mockResolvedValueOnce({
				data: { data: [first], metadata: { has_more: true, next_cursor: first.id } },
				error: undefined,
				response: { status: 200, ok: true },
			});

			await store.fetch();

			expect(store.list().map((item) => item.id)).toEqual([first.id]);
			expect(store.hasMore).toBe(true);
			expect(store.nextCursor).toBe(first.id);

			const second = notificationFixture({ title: 'Replacement page row' });

			mockBackendClient.GET.mockResolvedValueOnce({
				data: { data: [second], metadata: { has_more: false, next_cursor: undefined } },
				error: undefined,
				response: { status: 200, ok: true },
			});

			await store.fetch();

			// A plain fetch replaces listIds with the new page...
			expect(store.list().map((item) => item.id)).toEqual([second.id]);
			// ...but items keeps every row ever seen, so the first row is still reachable by id.
			expect(store.findById(first.id)).not.toBeNull();
		});

		it('appends the page onto listIds when append is true, without duplicating an id', async () => {
			const first = notificationFixture({ title: 'Page one row' });

			mockBackendClient.GET.mockResolvedValueOnce({
				data: { data: [first], metadata: { has_more: true, next_cursor: first.id } },
				error: undefined,
				response: { status: 200, ok: true },
			});

			await store.fetch();

			const second = notificationFixture({ title: 'Page two row' });

			mockBackendClient.GET.mockResolvedValueOnce({
				data: { data: [second], metadata: { has_more: false, next_cursor: undefined } },
				error: undefined,
				response: { status: 200, ok: true },
			});

			await store.fetch({ afterId: first.id, append: true });

			expect(store.list().map((item) => item.id)).toEqual([first.id, second.id]);

			// Re-appending the same row (e.g. an overlapping page) must not duplicate its id.
			mockBackendClient.GET.mockResolvedValueOnce({
				data: { data: [second], metadata: { has_more: false, next_cursor: undefined } },
				error: undefined,
				response: { status: 200, ok: true },
			});

			await store.fetch({ afterId: first.id, append: true });

			expect(store.list().map((item) => item.id)).toEqual([first.id, second.id]);
		});

		it('sends the filters as query parameters rather than filtering locally', async () => {
			mockBackendClient.GET.mockResolvedValueOnce({
				data: { data: [], metadata: { has_more: false, next_cursor: undefined } },
				error: undefined,
				response: { status: 200, ok: true },
			});

			await store.fetch({
				status: 'active',
				severity: [NotificationsModuleNotificationSeverity.error, NotificationsModuleNotificationSeverity.critical],
				source: 'system-module',
				kind: NotificationsModuleNotificationKind.issue,
				unread: true,
				afterId: 'b2222222-2222-2222-2222-222222222222',
			});

			expect(mockBackendClient.GET).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					params: {
						query: {
							status: 'active',
							severity: [NotificationsModuleNotificationSeverity.error, NotificationsModuleNotificationSeverity.critical],
							source: 'system-module',
							kind: NotificationsModuleNotificationKind.issue,
							unread: true,
							after_id: 'b2222222-2222-2222-2222-222222222222',
						},
					},
				})
			);
		});
	});

	describe('ordering token', () => {
		it('skips a stale get() that lands after the row was unset', async () => {
			const notification = notificationFixture();

			let resolveRequest!: (value: unknown) => void;

			const request = new Promise((resolve) => {
				resolveRequest = resolve;
			});

			(mockBackendClient.GET as Mock).mockReturnValueOnce(request);

			const pending = store.get({ id: notification.id });

			// The Deleted event races ahead of the still-in-flight get(), forgetting the row.
			store.unset({ id: notification.id });

			resolveRequest({ data: { data: notification }, error: undefined, response: { status: 200, ok: true } });

			const result = await pending;

			// The read is still a truthful answer to the caller...
			expect(result.id).toBe(notification.id);
			// ...but it must not resurrect the row the newer unset() removed.
			expect(store.findById(notification.id)).toBeNull();
		});

		it('applies a get() that lands with nothing newer written since', async () => {
			const notification = notificationFixture();

			mockBackendClient.GET.mockResolvedValueOnce({
				data: { data: notification },
				error: undefined,
				response: { status: 200, ok: true },
			});

			await store.get({ id: notification.id });

			expect(store.findById(notification.id)).not.toBeNull();
		});
	});

	describe('unreadCount / highestActiveSeverity', () => {
		it('counts only active, unread rows', async () => {
			const unreadActive = notificationFixture({ read_at: null, dismissed_at: null, resolved_at: null });
			const readActive = notificationFixture({ read_at: '2026-09-02T12:00:00.000Z', dismissed_at: null, resolved_at: null });
			const unreadDismissed = notificationFixture({ read_at: null, dismissed_at: '2026-09-02T12:00:00.000Z', resolved_at: null });
			const unreadResolved = notificationFixture({ read_at: null, dismissed_at: null, resolved_at: '2026-09-02T12:00:00.000Z' });

			mockBackendClient.GET.mockResolvedValueOnce({
				data: { data: [unreadActive, readActive, unreadDismissed, unreadResolved], metadata: { has_more: false, next_cursor: undefined } },
				error: undefined,
				response: { status: 200, ok: true },
			});

			await store.fetch();

			expect(store.unreadCount()).toBe(1);
			expect(store.active().map((item) => item.id)).toEqual([unreadActive.id, readActive.id]);
		});

		it('returns null when there are no active rows', () => {
			expect(store.highestActiveSeverity()).toBeNull();
		});

		it('picks the highest severity among the active rows', async () => {
			const info = notificationFixture({ severity: NotificationsModuleNotificationSeverity.info });
			const critical = notificationFixture({ severity: NotificationsModuleNotificationSeverity.critical });
			const warning = notificationFixture({ severity: NotificationsModuleNotificationSeverity.warning });

			mockBackendClient.GET.mockResolvedValueOnce({
				data: { data: [info, critical, warning], metadata: { has_more: false, next_cursor: undefined } },
				error: undefined,
				response: { status: 200, ok: true },
			});

			await store.fetch();

			expect(store.highestActiveSeverity()).toBe(NotificationsModuleNotificationSeverity.critical);
		});

		it('ignores a dismissed critical row in favour of an active warning row', async () => {
			const dismissedCritical = notificationFixture({
				severity: NotificationsModuleNotificationSeverity.critical,
				dismissed_at: '2026-09-02T12:00:00.000Z',
			});
			const activeWarning = notificationFixture({ severity: NotificationsModuleNotificationSeverity.warning });

			mockBackendClient.GET.mockResolvedValueOnce({
				data: { data: [dismissedCritical, activeWarning], metadata: { has_more: false, next_cursor: undefined } },
				error: undefined,
				response: { status: 200, ok: true },
			});

			await store.fetch();

			expect(store.highestActiveSeverity()).toBe(NotificationsModuleNotificationSeverity.warning);
		});
	});
});
