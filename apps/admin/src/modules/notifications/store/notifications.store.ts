import type { Ref } from 'vue';
import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { MODULES_PREFIX } from '../../../app.constants';
import { getErrorReason, logger, snakeToCamel, useBackend } from '../../../common';
import type {
	NotificationsModuleBulkRemoveNotificationsOperation,
	NotificationsModuleBulkUpdateNotificationsOperation,
	NotificationsModuleDeleteNotificationOperation,
	NotificationsModuleGetNotificationOperation,
	NotificationsModuleGetNotificationsOperation,
	NotificationsModuleNotificationKind,
	NotificationsModuleNotificationSeverity,
	NotificationsModuleNotificationStatus,
	NotificationsModuleUpdateNotificationOperation,
} from '../../../openapi.constants';
import { NOTIFICATIONS_MODULE_PREFIX, SEVERITY_RANK } from '../notifications.constants';
import { NotificationsApiException, NotificationsValidationException } from '../notifications.exceptions';

import { NotificationSchema, NotificationsBulkResultSchema } from './notifications.store.schemas';
import type {
	IBulkResult,
	INotification,
	INotificationActionRes,
	INotificationRes,
	INotificationsStateSemaphore,
} from './notifications.store.schemas';

// STORE ACTION PAYLOADS
// ======================

export interface INotificationsFetchActionPayload {
	status?: 'active' | 'dismissed' | 'resolved' | 'all';
	severity?: NotificationsModuleNotificationSeverity[];
	source?: string;
	kind?: NotificationsModuleNotificationKind;
	unread?: boolean;
	afterId?: string;
	// `false` (default) resets `listIds` before applying the page; `true` appends the page.
	append?: boolean;
}

export interface INotificationsGetActionPayload {
	id: INotification['id'];
}

export interface INotificationsSetActionPayload {
	id: INotification['id'];
	data: Partial<INotification>;
}

export interface INotificationsUnsetActionPayload {
	id: INotification['id'];
}

export interface INotificationsOnEventActionPayload {
	id: INotification['id'];
	data: Record<string, unknown>;
}

export interface INotificationsMarkReadActionPayload {
	id: INotification['id'];
	read: boolean;
}

export interface INotificationsDismissActionPayload {
	id: INotification['id'];
	dismissed: boolean;
}

export interface INotificationsRemoveActionPayload {
	id: INotification['id'];
}

export interface INotificationsBulkUpdateActionPayload {
	ids: INotification['id'][];
	read?: boolean;
	dismissed?: boolean;
}

export interface INotificationsBulkRemoveActionPayload {
	ids: INotification['id'][];
}

// STORE
// =====

export interface INotificationsStoreState {
	items: Ref<{ [key: INotification['id']]: INotification }>;
	listIds: Ref<INotification['id'][]>;
	hasMore: Ref<boolean>;
	nextCursor: Ref<string | undefined>;
	semaphore: Ref<INotificationsStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface INotificationsStoreActions {
	findAll: () => INotification[];
	findById: (id: INotification['id']) => INotification | null;
	list: () => INotification[];
	active: () => INotification[];
	unreadCount: () => number;
	highestActiveSeverity: () => NotificationsModuleNotificationSeverity | null;
	onEvent: (payload: INotificationsOnEventActionPayload) => INotification;
	set: (payload: INotificationsSetActionPayload) => INotification;
	unset: (payload: INotificationsUnsetActionPayload) => void;
	get: (payload: INotificationsGetActionPayload) => Promise<INotification>;
	fetch: (payload?: INotificationsFetchActionPayload) => Promise<INotification[]>;
	markRead: (payload: INotificationsMarkReadActionPayload) => Promise<INotification>;
	dismiss: (payload: INotificationsDismissActionPayload) => Promise<INotification>;
	remove: (payload: INotificationsRemoveActionPayload) => Promise<void>;
	bulkUpdate: (payload: INotificationsBulkUpdateActionPayload) => Promise<IBulkResult>;
	bulkRemove: (payload: INotificationsBulkRemoveActionPayload) => Promise<IBulkResult>;
	isLoaded: () => boolean;
	refresh: () => Promise<void>;
}

export type NotificationsStoreSetup = INotificationsStoreState & INotificationsStoreActions;

const defaultSemaphore: INotificationsStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
	updating: [],
	deleting: [],
};

/**
 * Maps one wire-shaped action onto the store's camelCase shape. `params` is opaque data an
 * extension action defines for itself, so unlike every other field it is carried through
 * untouched rather than case-converted - `NotificationSchema` validates its actual shape.
 */
const transformNotificationAction = (action: INotificationActionRes): Record<string, unknown> => {
	const { params, ...rest } = action;

	return { ...snakeToCamel(rest), params };
};

/**
 * Maps one wire-shaped notification onto the store's camelCase shape and validates it.
 * `data` is free-form, emitter-supplied context - like `params` above, its keys must survive
 * untouched, so it is carried around the blanket `snakeToCamel` rather than through it.
 */
const transformNotificationResponse = (response: INotificationRes): INotification => {
	const { data, actions, ...rest } = response;

	const parsed = NotificationSchema.safeParse({
		...snakeToCamel(rest),
		data,
		actions: (actions ?? []).map(transformNotificationAction),
	});

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new NotificationsValidationException('Failed to validate received notification data.');
	}

	return parsed.data;
};

export const useNotifications = defineStore<'notifications_module-notifications', NotificationsStoreSetup>(
	'notifications_module-notifications',
	(): NotificationsStoreSetup => {
		const backend = useBackend();

		const semaphore = ref<INotificationsStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const items = ref<{ [key: INotification['id']]: INotification }>({});

		// Ordered ids of the current query - reset by a plain `fetch()`, appended to by
		// `fetch({ append: true })`. Independent of `items`, which keeps every row ever seen so the
		// bell can read `active()` regardless of what the page last queried for.
		const listIds = ref<INotification['id'][]>([]);

		const hasMore = ref<boolean>(false);
		const nextCursor = ref<string | undefined>(undefined);

		const findAll = (): INotification[] => Object.values(items.value);

		const findById = (id: INotification['id']): INotification | null => items.value[id] ?? null;

		const list = (): INotification[] =>
			listIds.value.map((id) => items.value[id]).filter((notification): notification is INotification => typeof notification !== 'undefined');

		const active = (): INotification[] => findAll().filter((notification) => notification.dismissedAt === null && notification.resolvedAt === null);

		const unreadCount = (): number => active().filter((notification) => notification.readAt === null).length;

		const highestActiveSeverity = (): NotificationsModuleNotificationSeverity | null => {
			const activeNotifications = active();

			if (activeNotifications.length === 0) {
				return null;
			}

			return activeNotifications.reduce<NotificationsModuleNotificationSeverity>(
				(highest, notification) => (SEVERITY_RANK[notification.severity] > SEVERITY_RANK[highest] ? notification.severity : highest),
				activeNotifications[0].severity
			);
		};

		// Stamped on every write that is not a fetch/get applying its own response - a websocket
		// event, a mark-read, a dismiss, a bulk confirmation. A read (`get`/`fetch`) remembers the
		// stamp it went out under, so when its response lands it can tell whether the row has been
		// written since - and if so, leaves that newer write alone rather than clobbering it with a
		// now-stale snapshot. See `devices.store.ts` for the same pattern in full.
		let mutationToken = 0;
		const mutationTokenById: Record<INotification['id'], number> = {};

		// The subset of those stamps that came from something authoritative rather than a row
		// merely being re-read - used by `bulkUpdate` to tell whether its optimistic local nudge is
		// still safe to apply once the confirmation lands.
		const writeTokenById: Record<INotification['id'], number> = {};

		const commit = (notification: INotification, { read = false }: { read?: boolean } = {}): INotification => {
			mutationTokenById[notification.id] = ++mutationToken;

			if (!read) {
				writeTokenById[notification.id] = mutationTokenById[notification.id];
			}

			return (items.value[notification.id] = notification);
		};

		const forget = (id: INotification['id']): void => {
			mutationTokenById[id] = ++mutationToken;
			writeTokenById[id] = mutationTokenById[id];

			delete items.value[id];

			listIds.value = listIds.value.filter((existingId) => existingId !== id);
		};

		const set = (payload: INotificationsSetActionPayload): INotification => {
			if (payload.id in items.value) {
				// Strip undefined values so schema defaults from a partial update don't overwrite
				// real data already in the store.
				const cleaned = omitBy(payload.data, isUndefined);
				const parsed = NotificationSchema.safeParse({ ...items.value[payload.id], ...cleaned });

				if (!parsed.success) {
					logger.error('Schema validation failed with:', parsed.error);

					throw new NotificationsValidationException('Failed to insert notification.');
				}

				return commit(parsed.data);
			}

			const parsed = NotificationSchema.safeParse({ ...payload.data, id: payload.id });

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new NotificationsValidationException('Failed to insert notification.');
			}

			return commit(parsed.data);
		};

		const unset = (payload: INotificationsUnsetActionPayload): void => {
			forget(payload.id);
		};

		const onEvent = (payload: INotificationsOnEventActionPayload): INotification => {
			return set({
				id: payload.id,
				data: transformNotificationResponse(payload.data as INotificationRes),
			});
		};

		const pendingGetPromises: Record<INotification['id'], Promise<INotification>> = {};

		const get = async (payload: INotificationsGetActionPayload): Promise<INotification> => {
			const existingPromise = pendingGetPromises[payload.id];

			if (existingPromise) {
				return existingPromise;
			}

			const getPromise = (async (): Promise<INotification> => {
				if (semaphore.value.fetching.item.includes(payload.id)) {
					throw new NotificationsApiException('Already fetching notification.');
				}

				semaphore.value.fetching.item.push(payload.id);

				// Read before the request goes out: most often raced by the sockets handler's own
				// `unset()` on a `Deleted` event that lands while this `get()` (issued for an earlier
				// `Created`/`Updated` pointer) is still in flight.
				const requestedAt = mutationToken;

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${NOTIFICATIONS_MODULE_PREFIX}/notifications/{id}`, {
						params: {
							path: { id: payload.id },
						},
					});

					if (typeof responseData !== 'undefined') {
						const transformed = transformNotificationResponse(responseData.data);

						// Superseded by a newer write - most likely the row was deleted while this read
						// was in flight. The read is still a truthful answer to hand back to the caller,
						// it is just not allowed to write a now-stale snapshot into the store.
						if ((mutationTokenById[payload.id] ?? 0) > requestedAt) {
							return transformed;
						}

						commit(transformed, { read: true });

						return transformed;
					}

					let errorReason: string | null = 'Failed to fetch notification.';

					if (error) {
						errorReason = getErrorReason<NotificationsModuleGetNotificationOperation>(error, errorReason);
					}

					throw new NotificationsApiException(errorReason, response.status);
				} finally {
					semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);
				}
			})();

			pendingGetPromises[payload.id] = getPromise;

			try {
				return await getPromise;
			} finally {
				delete pendingGetPromises[payload.id];
			}
		};

		// Overlapping calls are allowed to run concurrently rather than being coalesced or refused -
		// with no filter dimension singled out as the cache key (there are six: status, severity,
		// source, kind, unread, afterId), each row a response carries still lands safely through the
		// same per-row mutation-token check `get()` uses, so correctness does not depend on only one
		// list request being in flight at a time.
		let inFlightFetchCount = 0;

		const fetch = async (payload?: INotificationsFetchActionPayload): Promise<INotification[]> => {
			inFlightFetchCount += 1;
			semaphore.value.fetching.items = true;

			const requestedAt = mutationToken;

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${MODULES_PREFIX}/${NOTIFICATIONS_MODULE_PREFIX}/notifications`, {
					params: {
						query: {
							// `status` is a plain string literal on the payload so callers do not need to
							// import an enum for it; the values are identical to the generated query
							// parameter's enum, which is all this cast relies on.
							status: payload?.status as NotificationsModuleNotificationStatus | undefined,
							severity: payload?.severity,
							source: payload?.source,
							kind: payload?.kind,
							unread: payload?.unread,
							after_id: payload?.afterId,
						},
					},
				});

				if (typeof responseData !== 'undefined') {
					const pageIds: INotification['id'][] = [];

					for (const row of responseData.data) {
						const transformed = transformNotificationResponse(row);

						if ((mutationTokenById[transformed.id] ?? 0) > requestedAt) {
							// Superseded by a write that landed while this request was in flight - keep
							// whatever that write left behind (including having unset the row) rather than
							// resurrecting or overwriting it with this now-stale snapshot.
							if (items.value[transformed.id]) {
								pageIds.push(transformed.id);
							}

							continue;
						}

						commit(transformed, { read: true });
						pageIds.push(transformed.id);
					}

					listIds.value = payload?.append ? [...listIds.value, ...pageIds.filter((id) => !listIds.value.includes(id))] : pageIds;

					hasMore.value = responseData.metadata.has_more;
					nextCursor.value = responseData.metadata.next_cursor;

					firstLoad.value = true;

					return pageIds.map((id) => items.value[id]).filter((notification): notification is INotification => typeof notification !== 'undefined');
				}

				let errorReason: string | null = 'Failed to fetch notifications.';

				if (error) {
					errorReason = getErrorReason<NotificationsModuleGetNotificationsOperation>(error, errorReason);
				}

				throw new NotificationsApiException(errorReason, response.status);
			} finally {
				inFlightFetchCount -= 1;

				if (inFlightFetchCount === 0) {
					semaphore.value.fetching.items = false;
				}
			}
		};

		const markRead = async (payload: INotificationsMarkReadActionPayload): Promise<INotification> => {
			semaphore.value.updating.push(payload.id);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.PATCH(`/${MODULES_PREFIX}/${NOTIFICATIONS_MODULE_PREFIX}/notifications/{id}`, {
					params: { path: { id: payload.id } },
					body: { data: { read: payload.read } },
				});

				if (typeof responseData !== 'undefined') {
					return commit(transformNotificationResponse(responseData.data));
				}

				let errorReason: string | null = 'Failed to update notification.';

				if (error) {
					errorReason = getErrorReason<NotificationsModuleUpdateNotificationOperation>(error, errorReason);
				}

				throw new NotificationsApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
			}
		};

		const dismiss = async (payload: INotificationsDismissActionPayload): Promise<INotification> => {
			semaphore.value.updating.push(payload.id);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.PATCH(`/${MODULES_PREFIX}/${NOTIFICATIONS_MODULE_PREFIX}/notifications/{id}`, {
					params: { path: { id: payload.id } },
					body: { data: { dismissed: payload.dismissed } },
				});

				if (typeof responseData !== 'undefined') {
					return commit(transformNotificationResponse(responseData.data));
				}

				let errorReason: string | null = 'Failed to update notification.';

				if (error) {
					errorReason = getErrorReason<NotificationsModuleUpdateNotificationOperation>(error, errorReason);
				}

				throw new NotificationsApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
			}
		};

		const remove = async (payload: INotificationsRemoveActionPayload): Promise<void> => {
			semaphore.value.deleting.push(payload.id);

			try {
				const { error, response } = await backend.client.DELETE(`/${MODULES_PREFIX}/${NOTIFICATIONS_MODULE_PREFIX}/notifications/{id}`, {
					params: { path: { id: payload.id } },
				});

				if (response.status === 204) {
					forget(payload.id);

					return;
				}

				let errorReason: string | null = 'Failed to remove notification.';

				if (error) {
					errorReason = getErrorReason<NotificationsModuleDeleteNotificationOperation>(error, errorReason);
				}

				throw new NotificationsApiException(errorReason, response.status);
			} finally {
				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
			}
		};

		/**
		 * Updates a selection in one request rather than one PATCH per row, which the backend's
		 * shared rate limit would refuse past a small selection. The response carries only the
		 * outcome, so the local rows are nudged to the state just confirmed instead of being
		 * re-fetched one by one.
		 */
		const bulkUpdate = async (payload: INotificationsBulkUpdateActionPayload): Promise<IBulkResult> => {
			if (payload.ids.length === 0) {
				return { succeeded: [], failed: [] };
			}

			semaphore.value.updating.push(...payload.ids);

			// What each row was stamped at before the request goes out - a row a websocket event
			// rewrites while the bulk request is in flight must keep that newer state rather than
			// being walked back to the value this request asked for.
			const stampedBefore = new Map(payload.ids.map((id): [INotification['id'], number] => [id, writeTokenById[id] ?? 0]));

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${MODULES_PREFIX}/${NOTIFICATIONS_MODULE_PREFIX}/notifications/bulk-update`, {
					body: { data: { ids: payload.ids, read: payload.read, dismissed: payload.dismissed } },
				});

				if (typeof responseData === 'undefined' || !response.ok) {
					let errorReason: string | null = 'Failed to update notifications.';

					if (error) {
						errorReason = getErrorReason<NotificationsModuleBulkUpdateNotificationsOperation>(error, errorReason);
					}

					throw new NotificationsApiException(errorReason, response.status);
				}

				const result = NotificationsBulkResultSchema.parse(responseData.data);

				for (const id of result.succeeded) {
					const record = items.value[id];

					if (record !== undefined && (writeTokenById[id] ?? 0) === stampedBefore.get(id)) {
						commit({
							...record,
							...(payload.read !== undefined ? { readAt: payload.read ? new Date() : null } : {}),
							...(payload.dismissed !== undefined ? { dismissedAt: payload.dismissed ? new Date() : null } : {}),
						});
					}
				}

				return result;
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => !payload.ids.includes(item));
			}
		};

		/**
		 * Removes a selection in one request. Same reasoning as `bulkUpdate`.
		 */
		const bulkRemove = async (payload: INotificationsBulkRemoveActionPayload): Promise<IBulkResult> => {
			if (payload.ids.length === 0) {
				return { succeeded: [], failed: [] };
			}

			semaphore.value.deleting.push(...payload.ids);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${MODULES_PREFIX}/${NOTIFICATIONS_MODULE_PREFIX}/notifications/bulk-remove`, {
					body: { data: { ids: payload.ids } },
				});

				if (typeof responseData === 'undefined' || !response.ok) {
					let errorReason: string | null = 'Failed to remove notifications.';

					if (error) {
						errorReason = getErrorReason<NotificationsModuleBulkRemoveNotificationsOperation>(error, errorReason);
					}

					throw new NotificationsApiException(errorReason, response.status);
				}

				const result = NotificationsBulkResultSchema.parse(responseData.data);

				for (const id of result.succeeded) {
					forget(id);
				}

				return result;
			} finally {
				semaphore.value.deleting = semaphore.value.deleting.filter((item) => !payload.ids.includes(item));
			}
		};

		// Reconnect refresh contract: the store says whether it holds anything worth re-reading, so
		// the caller never has to guess from a flag it does not maintain.
		const isLoaded = (): boolean => firstLoad.value || findAll().length > 0;

		// Refreshes with the active rows - the scope the bell and the minimal N-5 view both render.
		const refresh = async (): Promise<void> => {
			await fetch({ status: 'active' });
		};

		return {
			items,
			listIds,
			hasMore,
			nextCursor,
			semaphore,
			firstLoad,
			findAll,
			findById,
			list,
			active,
			unreadCount,
			highestActiveSeverity,
			onEvent,
			set,
			unset,
			get,
			fetch,
			markRead,
			dismiss,
			remove,
			bulkUpdate,
			bulkRemove,
			isLoaded,
			refresh,
		};
	}
);

export const registerNotificationsStore = (pinia: Pinia): Store<string, INotificationsStoreState, object, INotificationsStoreActions> => {
	return useNotifications(pinia);
};
