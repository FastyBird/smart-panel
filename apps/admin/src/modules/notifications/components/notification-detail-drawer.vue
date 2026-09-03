<template>
	<el-drawer
		:model-value="modelValue"
		size="480px"
		@update:model-value="(value: boolean) => emit('update:modelValue', value)"
	>
		<template #header>
			<notification-severity-tag
				v-if="notification"
				:severity="notification.severity"
			/>
			<el-text class="notification-detail-drawer__title">{{ notification?.title }}</el-text>
		</template>

		<template v-if="notification">
			<el-text
				v-if="notification.message"
				class="notification-detail-drawer__message"
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
					{{ notification.dismissedAt ? formatTimestamp(notification.dismissedAt) : t('notificationsModule.fields.notifications.dismissedAt.no') }}
				</el-descriptions-item>
				<el-descriptions-item :label="t('notificationsModule.fields.notifications.resolvedAt.title')">
					{{ notification.resolvedAt ? formatTimestamp(notification.resolvedAt) : t('notificationsModule.fields.notifications.resolvedAt.no') }}
				</el-descriptions-item>
			</el-descriptions>

			<div class="notification-detail-drawer__footer">
				<el-button
					v-if="notification.dismissedAt === null"
					@click="onDismiss"
				>
					{{ t('notificationsModule.buttons.dismiss.title') }}
				</el-button>

				<el-button
					type="danger"
					plain
					@click="onRemove"
				>
					{{ t('application.bulkActions.delete') }}
				</el-button>
			</div>
		</template>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDescriptions, ElDescriptionsItem, ElDrawer, ElText } from 'element-plus';

import { useNotificationsActions } from '../composables/composables';
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

const emit = defineEmits<{
	(e: 'update:modelValue', visible: boolean): void;
}>();

const { t } = useI18n();

const { dismiss, remove } = useNotificationsActions();

const dataEntries = computed<[string, string | number | boolean | null][]>((): [string, string | number | boolean | null][] =>
	Object.entries(props.notification?.data ?? {})
);

const formatTimestamp = (date: Date): string => date.toLocaleString();

const onDismiss = (): void => {
	if (props.notification) {
		void dismiss(props.notification.id, true);
	}
};

const onRemove = (): void => {
	if (props.notification) {
		void remove(props.notification.id);
	}
};
</script>

<style scoped>
.notification-detail-drawer__title {
	margin-left: 0.5rem;
	font-weight: 600;
}

.notification-detail-drawer__message {
	display: block;
	white-space: pre-wrap;
}

.notification-detail-drawer__footer {
	display: flex;
	justify-content: flex-end;
	gap: 0.5rem;
	margin-top: 1.5rem;
}
</style>
