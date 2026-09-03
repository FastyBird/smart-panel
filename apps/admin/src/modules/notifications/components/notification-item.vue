<template>
	<div
		class="notification-item"
		@click="emit('click', notification)"
	>
		<notification-severity-tag
			:severity="notification.severity"
			class="notification-item__severity"
		/>

		<div class="notification-item__body">
			<div class="notification-item__title-row">
				<el-text
					class="notification-item__title"
					truncated
				>
					{{ notification.title }}
				</el-text>

				<el-badge
					v-if="notification.occurrences > 1"
					:value="notification.occurrences"
					type="info"
					class="notification-item__occurrences"
				/>
			</div>

			<div class="notification-item__meta">
				<el-text
					class="notification-item__source"
					size="small"
					type="info"
				>
					{{ notification.source }}
				</el-text>
				<el-text
					class="notification-item__time"
					size="small"
					type="info"
				>
					{{ relativeTime }}
				</el-text>
			</div>
		</div>

		<div
			class="notification-item__actions"
			@click.stop
		>
			<el-button
				v-if="primaryAction"
				size="small"
				type="primary"
				text
				bg
				@click="emit('action', notification)"
			>
				{{ primaryAction.label }}
			</el-button>

			<el-tooltip :content="t('notificationsModule.buttons.dismiss.title')">
				<el-button
					size="small"
					circle
					text
					:aria-label="t('notificationsModule.buttons.dismiss.title')"
					@click="emit('dismiss', notification)"
				>
					<template #icon>
						<icon icon="mdi:close" />
					</template>
				</el-button>
			</el-tooltip>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElBadge, ElButton, ElText, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';
import { formatTimeAgo } from '@vueuse/core';

import type { INotification, INotificationAction } from '../store/notifications.store.schemas';

import NotificationSeverityTag from './notification-severity-tag.vue';

defineOptions({
	name: 'NotificationItem',
});

const props = defineProps<{
	notification: INotification;
}>();

const emit = defineEmits<{
	(e: 'click', notification: INotification): void;
	(e: 'action', notification: INotification): void;
	(e: 'dismiss', notification: INotification): void;
}>();

const { t } = useI18n();

const primaryAction = computed<INotificationAction | undefined>((): INotificationAction | undefined =>
	props.notification.actions.find((action) => action.primary)
);

const relativeTime = computed<string>((): string => formatTimeAgo(props.notification.createdAt));
</script>

<style scoped>
.notification-item {
	display: flex;
	align-items: flex-start;
	gap: 0.5rem;
	padding: 0.5rem 0;
	cursor: pointer;
}

.notification-item__severity {
	flex-shrink: 0;
	margin-top: 0.125rem;
}

.notification-item__body {
	flex: 1;
	min-width: 0;
}

.notification-item__title-row {
	display: flex;
	align-items: center;
	gap: 0.375rem;
}

.notification-item__title {
	font-weight: 600;
}

.notification-item__meta {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	margin-top: 0.125rem;
}

.notification-item__actions {
	display: flex;
	align-items: center;
	gap: 0.25rem;
	flex-shrink: 0;
}
</style>
