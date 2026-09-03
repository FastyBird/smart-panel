<template>
	<div class="notification-popover">
		<el-empty
			v-if="items.length === 0"
			:description="t('notificationsModule.texts.bell.empty')"
			:image-size="64"
		/>

		<ul
			v-else
			class="notification-popover__list"
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

		<div class="notification-popover__footer">
			<el-button
				text
				:disabled="unreadActiveIds.length === 0"
				@click="onMarkAllRead"
			>
				{{ t('notificationsModule.buttons.markAllRead.title') }}
			</el-button>

			<el-button
				text
				type="primary"
				@click="onViewAll"
			>
				{{ t('notificationsModule.buttons.viewAll.title') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElEmpty } from 'element-plus';

import { useNotifications, useNotificationsActions } from '../composables/composables';
import { NOTIFICATIONS_POPOVER_LIMIT, RouteNames, SEVERITY_RANK } from '../notifications.constants';
import type { INotification } from '../store/notifications.store.schemas';

import NotificationItem from './notification-item.vue';

defineOptions({
	name: 'NotificationPopover',
});

const emit = defineEmits<{
	(e: 'close'): void;
}>();

const { t } = useI18n();
const router = useRouter();

const { active } = useNotifications();
const { markRead, markAllRead, dismiss } = useNotificationsActions();

// Top N active rows by severity rank, then most recent first - the popover is a glance, the
// full list (N-6) is where every active row lives.
const items = computed<INotification[]>((): INotification[] =>
	[...active.value]
		.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.createdAt.getTime() - a.createdAt.getTime())
		.slice(0, NOTIFICATIONS_POPOVER_LIMIT)
);

const unreadActiveIds = computed<INotification['id'][]>((): INotification['id'][] =>
	active.value.filter((notification) => notification.readAt === null).map((notification) => notification.id)
);

// Fire-and-forget: marking read must not hold up navigation, and `markRead` already reports its
// own failure through a flash message.
const onOpen = (notification: INotification): void => {
	if (notification.readAt === null) {
		void markRead(notification.id, true);
	}

	emit('close');

	void router.push({ name: RouteNames.NOTIFICATIONS });
};

const onDismiss = (notification: INotification): void => {
	void dismiss(notification.id, true);
};

const onMarkAllRead = (): void => {
	void markAllRead(unreadActiveIds.value);
};

const onViewAll = (): void => {
	emit('close');

	void router.push({ name: RouteNames.NOTIFICATIONS });
};
</script>

<style scoped>
.notification-popover__list {
	list-style: none;
	margin: 0;
	padding: 0;
	max-height: 400px;
	overflow-y: auto;
}

.notification-popover__list > li + li {
	border-top: 1px solid var(--el-border-color-lighter);
}

.notification-popover__footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 0.5rem;
	padding-top: 0.5rem;
	border-top: 1px solid var(--el-border-color-lighter);
}
</style>
