<template>
	<app-bar-heading v-if="!isMDDevice">
		<template #icon>
			<icon icon="mdi:bell-outline" />
		</template>

		<template #title>
			{{ t('notificationsModule.headings.notifications.list') }}
		</template>
	</app-bar-heading>

	<div class="view-notifications">
		<el-empty
			v-if="items.length === 0"
			:description="t('notificationsModule.texts.bell.empty')"
		/>

		<ul
			v-else
			class="view-notifications__list"
		>
			<li
				v-for="item in items"
				:key="item.id"
			>
				<notification-item
					:notification="item"
					@click="onOpen(item)"
					@action="onOpen(item)"
					@dismiss="onDismiss(item)"
				/>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElEmpty } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarHeading, useBreakpoints } from '../../../common';
import { NotificationItem } from '../components/components';
import { useNotifications, useNotificationsActions } from '../composables/composables';
import { SEVERITY_RANK } from '../notifications.constants';
import type { INotification } from '../store/notifications.store.schemas';

defineOptions({
	name: 'ViewNotifications',
});

const { t } = useI18n();
const { isMDDevice } = useBreakpoints();

// A minimal placeholder: every active row, no filters and no bulk bar. N-6 replaces this view
// with the full page (query-synced filters, bulk actions, "load more", the detail drawer); this
// exists so the bell popover's "View all" has a destination in the meantime.
const { active, fetchNotifications } = useNotifications();
const { markRead, dismiss } = useNotificationsActions();

const items = computed<INotification[]>((): INotification[] =>
	[...active.value].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.createdAt.getTime() - a.createdAt.getTime())
);

const onOpen = (notification: INotification): void => {
	if (notification.readAt === null) {
		void markRead(notification.id, true);
	}
};

const onDismiss = (notification: INotification): void => {
	void dismiss(notification.id, true);
};

onMounted((): void => {
	void fetchNotifications({ status: 'active' });
});
</script>

<style scoped>
.view-notifications__list {
	list-style: none;
	margin: 0;
	padding: 0;
}

.view-notifications__list > li + li {
	border-top: 1px solid var(--el-border-color-lighter);
}
</style>
