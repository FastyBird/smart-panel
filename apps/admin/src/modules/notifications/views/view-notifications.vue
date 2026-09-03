<template>
	<app-bar-heading v-if="!isMDDevice">
		<template #icon>
			<icon icon="mdi:bell-outline" />
		</template>

		<template #title>
			{{ t('notificationsModule.headings.notifications.list') }}
		</template>

		<template #subtitle>
			{{ t('notificationsModule.subHeadings.notifications.list') }}
		</template>
	</app-bar-heading>

	<view-header
		:heading="t('notificationsModule.headings.notifications.list')"
		:sub-heading="t('notificationsModule.subHeadings.notifications.list')"
		icon="mdi:bell-outline"
	/>

	<div class="view-notifications">
		<notifications-filter v-model:filters="filters" />

		<list-notifications
			:items="notifications"
			:has-more="hasMore"
			:loading="areLoading"
			@detail="onDetail"
			@load-more="onLoadMore"
			@bulk-action="onBulkAction"
		/>
	</div>

	<notification-detail-drawer
		v-model="drawerVisible"
		:notification="selectedNotification"
	/>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';

import { AppBarHeading, ViewHeader, useBreakpoints } from '../../../common';
import { ListNotifications, NotificationDetailDrawer, NotificationsFilter } from '../components/components';
import { type NotificationsBulkActionOutcome, useNotificationsActions, useNotificationsDataSource } from '../composables/composables';
import { NotificationsException } from '../notifications.exceptions';
import type { INotification } from '../store/notifications.store.schemas';

defineOptions({
	name: 'ViewNotifications',
});

const { t } = useI18n();
const { isMDDevice } = useBreakpoints();

const { notifications, hasMore, areLoading, filters, fetchNotifications, loadMoreNotifications } = useNotificationsDataSource();
const { markAllRead, bulkMarkUnread, bulkDismiss, bulkRemove } = useNotificationsActions();

const selectedId = ref<INotification['id'] | null>(null);
const drawerVisible = ref<boolean>(false);

const selectedNotification = computed<INotification | null>(
	(): INotification | null => notifications.value.find((notification) => notification.id === selectedId.value) ?? null
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

<style scoped>
.view-notifications {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}
</style>
