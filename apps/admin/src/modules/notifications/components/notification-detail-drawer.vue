<template>
	<el-drawer
		:model-value="props.modelValue"
		:show-close="false"
		:with-header="false"
		:size="isLGDevice ? '40%' : '100%'"
		@update:model-value="(value: boolean) => emit('update:modelValue', value)"
	>
		<div class="flex flex-col h-full">
			<app-bar menu-button-hidden>
				<template #heading>
					<app-bar-heading v-if="notification">
						<template #icon>
							<icon :icon="severityIcon" />
						</template>

						<template #title>
							{{ notification.title }}
						</template>

						<template #subtitle>{{ notification.source }} &middot; {{ relativeTime }}</template>
					</app-bar-heading>
				</template>

				<template #button-right>
					<app-bar-button
						:align="AppBarButtonAlign.RIGHT"
						class="mr-2"
						:aria-label="t('notificationsModule.buttons.close.title')"
						@click="onClose"
					>
						<template #icon>
							<el-icon>
								<icon icon="mdi:close" />
							</el-icon>
						</template>
					</app-bar-button>
				</template>
			</app-bar>

			<template v-if="notification">
				<el-scrollbar class="grow-1 p-2 md:px-4">
					<div class="flex items-center gap-2">
						<notification-severity-tag :severity="notification.severity" />

						<el-text
							v-if="notification.readAt === null"
							size="small"
							type="primary"
						>
							{{ t('notificationsModule.fields.notifications.readAt.no') }}
						</el-text>
					</div>

					<el-text
						v-if="notification.message"
						class="notification-detail-drawer__message mt-4"
					>
						{{ notification.message }}
					</el-text>

					<el-descriptions
						v-if="dataEntries.length > 0"
						:title="t('notificationsModule.headings.notifications.data')"
						:column="1"
						border
						class="mt-4"
					>
						<el-descriptions-item
							v-for="[key, value] in dataEntries"
							:key="key"
							:label="key"
						>
							{{ value }}
						</el-descriptions-item>
					</el-descriptions>

					<notification-actions
						v-if="notification.actions.length > 0"
						:notification="notification"
						class="mt-4"
					/>

					<el-descriptions
						:title="t('notificationsModule.headings.notifications.lifecycle')"
						:column="1"
						border
						class="mt-4"
					>
						<el-descriptions-item :label="t('notificationsModule.fields.notifications.occurrences.title')">
							{{ notification.occurrences }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('notificationsModule.fields.notifications.createdAt.title')">
							{{ formatTimestamp(notification.createdAt) }}
						</el-descriptions-item>
						<el-descriptions-item
							v-if="notification.updatedAt"
							:label="t('notificationsModule.fields.notifications.updatedAt.title')"
						>
							{{ formatTimestamp(notification.updatedAt) }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('notificationsModule.fields.notifications.readAt.title')">
							{{ notification.readAt ? formatTimestamp(notification.readAt) : t('notificationsModule.fields.notifications.readAt.no') }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('notificationsModule.fields.notifications.dismissedAt.title')">
							{{
								notification.dismissedAt ? formatTimestamp(notification.dismissedAt) : t('notificationsModule.fields.notifications.dismissedAt.no')
							}}
						</el-descriptions-item>
						<el-descriptions-item :label="t('notificationsModule.fields.notifications.resolvedAt.title')">
							{{ notification.resolvedAt ? formatTimestamp(notification.resolvedAt) : t('notificationsModule.fields.notifications.resolvedAt.no') }}
						</el-descriptions-item>
					</el-descriptions>
				</el-scrollbar>

				<div
					class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
					style="background-color: var(--el-drawer-bg-color)"
				>
					<div class="p-2">
						<el-button
							link
							class="mr-2"
							data-test-id="close-notification"
							@click="onClose"
						>
							{{ t('notificationsModule.buttons.close.title') }}
						</el-button>

						<el-button
							plain
							data-test-id="toggle-read-notification"
							@click="onToggleRead"
						>
							<template #icon>
								<icon :icon="notification.readAt === null ? 'mdi:email-open-outline' : 'mdi:email-outline'" />
							</template>

							{{ notification.readAt === null ? t('notificationsModule.buttons.markRead.title') : t('notificationsModule.buttons.markUnread.title') }}
						</el-button>

						<el-button
							v-if="notification.dismissedAt === null"
							type="warning"
							plain
							data-test-id="dismiss-notification"
							@click="onDismiss"
						>
							<template #icon>
								<icon icon="mdi:eye-off-outline" />
							</template>

							{{ t('notificationsModule.buttons.dismiss.title') }}
						</el-button>

						<el-button
							type="danger"
							plain
							data-test-id="remove-notification"
							@click="onRemove"
						>
							<template #icon>
								<icon icon="mdi:trash" />
							</template>

							{{ t('application.bulkActions.delete') }}
						</el-button>
					</div>
				</div>
			</template>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDescriptions, ElDescriptionsItem, ElDrawer, ElIcon, ElScrollbar, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';
import { formatTimeAgo } from '@vueuse/core';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, useBreakpoints } from '../../../common';
import { NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import type { INotification } from '../store/notifications.store.schemas';

import NotificationActions from './notification-actions.vue';
import NotificationSeverityTag from './notification-severity-tag.vue';

defineOptions({
	name: 'NotificationDetailDrawer',
});

const props = defineProps<{
	modelValue: boolean;
	notification: INotification | null;
}>();

// The drawer is presentation only: the owning view runs the actions, because it also owns the
// list query and knows whether the result still matches the active filters.
const emit = defineEmits<{
	(e: 'update:modelValue', visible: boolean): void;
	(e: 'mark-read', id: INotification['id'], read: boolean): void;
	(e: 'dismiss', id: INotification['id']): void;
	(e: 'remove', id: INotification['id']): void;
}>();

const { t } = useI18n();

const { isLGDevice } = useBreakpoints();

const dataEntries = computed<[string, string | number | boolean | null][]>((): [string, string | number | boolean | null][] =>
	Object.entries(props.notification?.data ?? {})
);

const severityIcon = computed<string>((): string => {
	switch (props.notification?.severity) {
		case NotificationsModuleNotificationSeverity.critical:
			return 'mdi:alert-octagon-outline';
		case NotificationsModuleNotificationSeverity.error:
			return 'mdi:alert-circle-outline';
		case NotificationsModuleNotificationSeverity.warning:
			return 'mdi:alert-outline';
		default:
			return 'mdi:information-outline';
	}
});

const relativeTime = computed<string>((): string => (props.notification ? formatTimeAgo(props.notification.createdAt) : ''));

const formatTimestamp = (date: Date): string => date.toLocaleString();

const onClose = (): void => {
	emit('update:modelValue', false);
};

const onToggleRead = (): void => {
	if (props.notification) {
		emit('mark-read', props.notification.id, props.notification.readAt === null);
	}
};

const onDismiss = (): void => {
	if (props.notification) {
		emit('dismiss', props.notification.id);
	}
};

const onRemove = (): void => {
	if (props.notification) {
		emit('remove', props.notification.id);
	}
};
</script>

<style scoped>
.notification-detail-drawer__message {
	display: block;
	white-space: pre-wrap;
}
</style>
