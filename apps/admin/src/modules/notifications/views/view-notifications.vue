<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		v-if="twoPane || !detailId"
		:title="t('notificationsModule.headings.notifications.list')"
		:subtitle="t('notificationsModule.subHeadings.notifications.list')"
		icon="mdi:bell-outline"
		:actions="[
			{
				icon: 'mdi:email-open-multiple-outline',
				label: t('notificationsModule.buttons.markAllRead.title'),
				handler: onMarkAllRead,
				disabled: unreadCount === 0,
			},
		]"
	>
		<template #actions>
			<el-button
				plain
				:disabled="unreadCount === 0"
				data-test-id="mark-all-notifications-read"
				@click="onMarkAllRead"
			>
				<template #icon>
					<icon icon="mdi:email-open-multiple-outline" />
				</template>

				{{ t('notificationsModule.buttons.markAllRead.title') }}
			</el-button>
		</template>
	</view-header>

	<!-- Template 7 from tablet landscape: the list in a 320 px pane and the open notification beside it, each
	     scrolling on its own. Below it the list, and the detail as a page of its own -->
	<div
		v-if="twoPane"
		class="page-pad flex gap-4 flex-1 min-h-0 box-border"
		data-test-id="notifications-two-pane"
	>
		<section
			:aria-label="t('notificationsModule.headings.notifications.list')"
			class="flex flex-col w-[320px] shrink-0 min-h-0 bg-surface border border-solid border-light rounded-lg overflow-hidden"
		>
			<notifications-filter
				v-model:filters="filters"
				:filters-active="filtersActive"
				:selected-count="selectedIds.length"
				@reset-filters="onResetFilters"
				@bulk-action="onBulkAction"
				@clear-selection="selectedIds = []"
			/>
			<div class="flex-1 min-h-0 overflow-y-auto">
				<notifications-inbox-list
					v-model:selected-ids="selectedIds"
					:items="notifications"
					:active-id="detailId"
					:loading="areLoading"
					:filters-active="filtersActive"
					:has-more="hasMore"
					@open="onOpen"
					@load-more="onLoadMore"
					@reset-filters="onResetFilters"
				/>
			</div>
		</section>

		<section class="flex flex-col flex-1 min-w-0 min-h-0 bg-surface border border-solid border-light rounded-lg overflow-hidden">
			<router-view v-slot="{ Component }">
				<component
					:is="Component"
					v-if="Component"
					:notification="openNotification"
					:loading="openLoading"
					in-pane
					@mark-read="onMarkRead"
					@dismiss="onDismiss"
					@remove="onRemove"
				/>
				<state-view
					v-else
					kind="empty"
					icon="mdi:email-open-outline"
					:title="t('notificationsModule.texts.notifications.selectOne')"
					data-test-id="notifications-no-selection"
				/>
			</router-view>
		</section>
	</div>

	<router-view
		v-else-if="detailId"
		v-slot="{ Component }"
	>
		<component
			:is="Component"
			:notification="openNotification"
			:loading="openLoading"
			@mark-read="onMarkRead"
			@dismiss="onDismiss"
			@remove="onRemove"
		/>
	</router-view>

	<div
		v-else
		class="page-pad flex flex-col flex-1 min-h-0 box-border"
	>
		<section class="flex flex-col flex-1 min-h-0 bg-surface border border-solid border-light rounded-lg overflow-hidden">
			<notifications-filter
				v-model:filters="filters"
				:filters-active="filtersActive"
				:selected-count="selectedIds.length"
				@reset-filters="onResetFilters"
				@bulk-action="onBulkAction"
				@clear-selection="selectedIds = []"
			/>
			<div class="flex-1 min-h-0 overflow-y-auto">
				<notifications-inbox-list
					v-model:selected-ids="selectedIds"
					:items="notifications"
					:loading="areLoading"
					:filters-active="filtersActive"
					:has-more="hasMore"
					@open="onOpen"
					@load-more="onLoadMore"
					@reset-filters="onResetFilters"
				/>
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBreadcrumbs, StateView, ViewHeader, injectStoresManager, useSizeClass } from '../../../common';
import NotificationsFilter from '../components/notifications-filter.vue';
import NotificationsInboxList from '../components/notifications-inbox-list.vue';
import { type NotificationsBulkActionOutcome, useNotificationsActions, useNotificationsDataSource } from '../composables/composables';
import { RouteNames } from '../notifications.constants';
import { NotificationsException } from '../notifications.exceptions';
import { notificationsStoreKey } from '../store/keys';
import type { INotification } from '../store/notifications.store.schemas';

defineOptions({
	name: 'ViewNotifications',
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('notificationsModule.meta.notifications.list.title'),
});

const { isPhone, isTabletPortrait } = useSizeClass();

const notificationsStore = injectStoresManager().getStore(notificationsStoreKey);

const { notifications, hasMore, areLoading, filters, filtersActive, fetchNotifications, loadMoreNotifications, resetFilters } =
	useNotificationsDataSource();
const { markRead, markAllRead, markEverythingRead, dismiss, remove, bulkMarkUnread, bulkDismiss, bulkRemove } = useNotificationsActions();

// Template 7: two panes from tablet landscape; below it the list, then the detail as a page of its own
const twoPane = computed<boolean>((): boolean => !isPhone.value && !isTabletPortrait.value);

// The open notification is the detail route's: the bell, a shared link and the list all open the same route
const detailId = computed<INotification['id'] | null>((): INotification['id'] | null =>
	route.name === RouteNames.NOTIFICATION && typeof route.params.id === 'string' ? route.params.id : null
);

// From the store rather than the list: the bell can open a notification the filtered list does not hold
const openNotification = computed<INotification | null>((): INotification | null =>
	detailId.value === null ? null : notificationsStore.findById(detailId.value)
);

const openLoading = ref<boolean>(false);

const unreadCount = computed<number>((): number => notificationsStore.unreadCount());

// The rows picked for a bulk action
const selectedIds = ref<INotification['id'][]>([]);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => [
		{
			label: t('notificationsModule.breadcrumbs.notifications.list'),
			route: router.resolve({ name: RouteNames.NOTIFICATIONS }),
		},
	]
);

// The query carries the list's filters, so the list reads the same when the detail is left again
const onOpen = (id: INotification['id']): void => {
	void router.push({ name: RouteNames.NOTIFICATION, params: { id }, query: route.query });
};

const onCloseDetail = (): void => {
	void router.push({ name: RouteNames.NOTIFICATIONS, query: route.query });
};

const onMarkAllRead = (): void => {
	markEverythingRead()
		.then((mutated: boolean): Promise<void> | undefined => {
			// Under "Unread only" the rows just read no longer match: read the list again
			if (mutated && filters.value.unread) {
				return fetchNotifications();
			}

			return undefined;
		})
		.catch((error: unknown): void => {
			const err = error as Error;

			throw new NotificationsException('Something went wrong', err);
		});
};

const onLoadMore = (): void => {
	loadMoreNotifications().catch((error: unknown): void => {
		const err = error as Error;

		throw new NotificationsException('Something went wrong', err);
	});
};

const onResetFilters = (): void => {
	resetFilters();
};

const onMarkRead = (id: INotification['id'], read: boolean): void => {
	// `markRead` reports its own failure through a flash message. Under the "unread only" filter a
	// row that was just read no longer matches, but the store only updates it in place - refetch so
	// the list agrees with the filter again.
	markRead(id, read)
		.then((): Promise<void> | undefined => {
			if (filters.value.unread && read) {
				return fetchNotifications();
			}

			return undefined;
		})
		.catch((error: unknown): void => {
			const err = error as Error;

			throw new NotificationsException('Something went wrong', err);
		});
};

const dismissedAtOf = (id: INotification['id']): number | null =>
	notifications.value.find((notification) => notification.id === id)?.dismissedAt?.getTime() ?? null;

const onDismiss = (id: INotification['id']): void => {
	const before = dismissedAtOf(id);

	// `dismiss` confirms first and reports both a cancellation and a failure itself; only a row
	// whose `dismissedAt` actually moved has stopped matching the "active" status filter, and only
	// then does the list need to be re-read from the backend.
	dismiss(id, true)
		.then((): Promise<void> | undefined => {
			if (filters.value.status === 'active' && dismissedAtOf(id) !== before) {
				return fetchNotifications();
			}

			return undefined;
		})
		.catch((error: unknown): void => {
			const err = error as Error;

			throw new NotificationsException('Something went wrong', err);
		});
};

const onRemove = (id: INotification['id']): void => {
	// The store drops a removed row from the current list itself - no refetch needed. The open notification going away
	// leaves the detail with nothing to show, so the inbox returns to the list
	remove(id)
		.then((): void => {
			if (detailId.value === id && notificationsStore.findById(id) === null) {
				onCloseDetail();
			}
		})
		.catch((error: unknown): void => {
			const err = error as Error;

			throw new NotificationsException('Something went wrong', err);
		});
};

// `markAllRead` keeps its boolean (true whenever at least one id mutated) rather than the wider
// `NotificationsBulkActionOutcome` the other three bulk actions return - this narrows either shape
// to the one thing the caller below actually needs: does the list need to refresh.
const isMutatingOutcome = (outcome: boolean | NotificationsBulkActionOutcome): boolean =>
	typeof outcome === 'boolean' ? outcome : outcome === 'mutated';

// Refetching unconditionally after every bulk action would re-issue the request even when the
// user cancelled the confirmation or the whole batch failed - refetch only when something in the
// selection actually changed (a partial success still counts, since some rows may no longer match
// the current filter).
const runBulkAction = async (action: string, ids: INotification['id'][]): Promise<void> => {
	let outcome: boolean | NotificationsBulkActionOutcome;

	switch (action) {
		case 'mark-read':
			outcome = await markAllRead(ids);
			break;
		case 'mark-unread':
			outcome = await bulkMarkUnread(ids);
			break;
		case 'dismiss':
			outcome = await bulkDismiss(ids);
			break;
		case 'delete':
			outcome = await bulkRemove(ids);
			break;
		default:
			return;
	}

	if (isMutatingOutcome(outcome)) {
		selectedIds.value = [];

		// A bulk delete can take the open notification with it, partly successful or not; the detail then has nothing
		// left to show, as after a single removal
		if (action === 'delete' && detailId.value !== null && notificationsStore.findById(detailId.value) === null) {
			onCloseDetail();
		}

		await fetchNotifications();
	}
};

// The filter bar names the action; the inbox holds the selection it applies to
const onBulkAction = (action: string): void => {
	runBulkAction(action, [...selectedIds.value]).catch((error: unknown): void => {
		const err = error as Error;

		throw new NotificationsException('Something went wrong', err);
	});
};

// A filter change starts a different list, so a selection made in the old one does not carry over; rows that left the
// list (removed, or no longer matching after a refresh) drop out of the selection too
watch(
	filters,
	(): void => {
		selectedIds.value = [];
	},
	{ deep: true }
);

watch(notifications, (items: INotification[]): void => {
	const present = new Set(items.map((notification) => notification.id));

	if (selectedIds.value.some((id) => !present.has(id))) {
		selectedIds.value = selectedIds.value.filter((id) => present.has(id));
	}
});

// Opening a notification reads it, as an inbox does; "Mark as unread" in the detail undoes it. One not loaded yet (a
// link, or the bell from a list filtered differently) is read from the backend first
// Each opening is one request: moving on to another notification before a read comes back leaves that read without a
// say over the loading state of the one now open
let openRequest = 0;

watch(
	detailId,
	async (id: INotification['id'] | null): Promise<void> => {
		const request = ++openRequest;

		openLoading.value = false;

		if (id === null) {
			return;
		}

		if (notificationsStore.findById(id) === null) {
			openLoading.value = true;

			try {
				await notificationsStore.get({ id });
			} catch {
				// The detail shows "not found"
			} finally {
				if (request === openRequest) {
					openLoading.value = false;
				}
			}
		}

		const notification = notificationsStore.findById(id);

		// Through the same path as the detail's Mark as read, so under "Unread only" the list is read again and the row
		// leaves it
		if (request !== openRequest || notification === null) {
			return;
		}

		if (notification.readAt === null) {
			onMarkRead(id, true);
		} else if (filters.value.unread && notifications.value.some((item) => item.id === id)) {
			// Read already by another request (the bell marks a row read as it opens it) while the "Unread only" list
			// still holds it: the list is read again so the row leaves it all the same
			fetchNotifications().catch((error: unknown): void => {
				const err = error as Error;

				throw new NotificationsException('Something went wrong', err);
			});
		}
	},
	{ immediate: true }
);

onBeforeMount((): void => {
	fetchNotifications().catch((error: unknown): void => {
		const err = error as Error;

		throw new NotificationsException('Something went wrong', err);
	});
});
</script>
