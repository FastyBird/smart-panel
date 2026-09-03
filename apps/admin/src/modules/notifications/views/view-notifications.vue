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
import { useNotificationsActions, useNotificationsDataSource } from '../composables/composables';
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

const onBulkAction = (action: string, ids: INotification['id'][]): void => {
	switch (action) {
		case 'mark-read':
			void markAllRead(ids);
			break;
		case 'mark-unread':
			void bulkMarkUnread(ids);
			break;
		case 'dismiss':
			void bulkDismiss(ids);
			break;
		case 'delete':
			void bulkRemove(ids);
			break;
	}
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
