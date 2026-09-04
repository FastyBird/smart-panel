<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:bell-outline"
				class="w-[20px] h-[20px]"
			/>
		</template>

		<template #title>
			{{ t('notificationsModule.headings.notifications.list') }}
		</template>

		<template #subtitle>
			{{ t('notificationsModule.subHeadings.notifications.list') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="router.push('/')"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>

		<span class="uppercase">{{ t('application.buttons.home.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('notificationsModule.headings.notifications.list')"
		:sub-heading="t('notificationsModule.subHeadings.notifications.list')"
		icon="mdi:bell-outline"
	/>

	<div class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2">
		<list-notifications
			v-model:filters="filters"
			:items="notifications"
			:filters-active="filtersActive"
			:has-more="hasMore"
			:loading="areLoading"
			@detail="onDetail"
			@dismiss="onDismiss"
			@remove="onRemove"
			@load-more="onLoadMore"
			@reset-filters="onResetFilters"
			@adjust-list="onAdjustList"
			@bulk-action="onBulkAction"
		/>
	</div>

	<!-- `title` is what names the dialog for assistive technology once `with-header` is off. -->
	<el-drawer
		v-model="adjustVisible"
		:title="t('notificationsModule.headings.notifications.adjustFilters')"
		:show-close="false"
		:with-header="false"
		:size="isLGDevice ? '300px' : '100%'"
	>
		<div class="flex flex-col h-full">
			<app-bar menu-button-hidden>
				<template #heading>
					<app-bar-heading>
						<template #icon>
							<icon icon="mdi:filter" />
						</template>

						<template #title>
							{{ t('notificationsModule.headings.notifications.adjustFilters') }}
						</template>

						<template #subtitle>
							{{ t('notificationsModule.subHeadings.notifications.adjustFilters') }}
						</template>
					</app-bar-heading>
				</template>

				<template #button-right>
					<app-bar-button
						:align="AppBarButtonAlign.RIGHT"
						class="mr-2"
						:aria-label="t('notificationsModule.buttons.close.title')"
						@click="adjustVisible = false"
					>
						<template #icon>
							<el-icon>
								<icon icon="mdi:close" />
							</el-icon>
						</template>
					</app-bar-button>
				</template>
			</app-bar>

			<list-notifications-adjust
				v-if="adjustVisible"
				v-model:filters="filters"
				:filters-active="filtersActive"
				@reset-filters="onResetFilters"
			/>
		</div>
	</el-drawer>

	<notification-detail-drawer
		v-model="drawerVisible"
		:notification="selectedNotification"
		@mark-read="onMarkRead"
		@dismiss="onDismiss"
		@remove="onRemove"
	/>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElDrawer, ElIcon } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { ListNotifications, ListNotificationsAdjust, NotificationDetailDrawer } from '../components/components';
import { type NotificationsBulkActionOutcome, useNotificationsActions, useNotificationsDataSource } from '../composables/composables';
import { RouteNames } from '../notifications.constants';
import { NotificationsException } from '../notifications.exceptions';
import type { INotification } from '../store/notifications.store.schemas';

defineOptions({
	name: 'ViewNotifications',
});

const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('notificationsModule.meta.notifications.list.title'),
});

const { isMDDevice, isLGDevice } = useBreakpoints();

const { notifications, hasMore, areLoading, filters, filtersActive, fetchNotifications, loadMoreNotifications, resetFilters } =
	useNotificationsDataSource();
const { markRead, markAllRead, dismiss, remove, bulkMarkUnread, bulkDismiss, bulkRemove } = useNotificationsActions();

const selectedId = ref<INotification['id'] | null>(null);
const drawerVisible = ref<boolean>(false);
const adjustVisible = ref<boolean>(false);

const selectedNotification = computed<INotification | null>(
	(): INotification | null => notifications.value.find((notification) => notification.id === selectedId.value) ?? null
);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => [
		{
			label: t('notificationsModule.breadcrumbs.notifications.list'),
			route: router.resolve({ name: RouteNames.NOTIFICATIONS }),
		},
	]
);

const onDetail = (id: INotification['id']): void => {
	selectedId.value = id;
	drawerVisible.value = true;
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

const onAdjustList = (): void => {
	adjustVisible.value = true;
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
	// The store drops a removed row from the current list itself - no refetch needed.
	remove(id).catch((error: unknown): void => {
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
		await fetchNotifications();
	}
};

const onBulkAction = (action: string, ids: INotification['id'][]): void => {
	runBulkAction(action, ids).catch((error: unknown): void => {
		const err = error as Error;

		throw new NotificationsException('Something went wrong', err);
	});
};

// A filter change or a bulk delete can remove the open row from `notifications` entirely - once
// there is nothing left to show, the drawer has nothing left to be open over.
watch(selectedNotification, (value: INotification | null): void => {
	if (value === null) {
		drawerVisible.value = false;
	}
});

watch(drawerVisible, (visible: boolean): void => {
	if (!visible) {
		selectedId.value = null;
	}
});

onBeforeMount((): void => {
	fetchNotifications().catch((error: unknown): void => {
		const err = error as Error;

		throw new NotificationsException('Something went wrong', err);
	});
});
</script>
