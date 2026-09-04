<template>
	<!--
		The row itself stays clickable for mouse users, but a `div` is never keyboard-focusable and
		this row nests real `<button>`s (dismiss, the primary action) - giving the row `role="button"`
		would put an interactive control inside another one. The title below carries its own
		`role="button"` instead, as a sibling of those buttons rather than their ancestor, and stops
		its click from bubbling so mouse activation is not double-counted against the row's handler.
	-->
	<div
		class="notification-item"
		@click="emit('click', notification)"
	>
		<notification-severity-dot
			:severity="notification.severity"
			class="notification-item__severity"
		/>

		<div class="notification-item__body">
			<div class="notification-item__title-row">
				<el-text
					role="button"
					tabindex="0"
					:aria-label="notification.title"
					class="notification-item__title"
					truncated
					@click.stop="emit('click', notification)"
					@keydown.enter.prevent="emit('click', notification)"
					@keydown.space.prevent="emit('click', notification)"
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

			<div
				v-if="primaryAction"
				class="notification-item__action"
				@click.stop
			>
				<el-button
					size="small"
					plain
					:disabled="isExecuting"
					@click="emit('action', notification)"
				>
					<template #icon>
						<icon :icon="actionIcon" />
					</template>

					{{ primaryAction.label }}
				</el-button>
			</div>
		</div>

		<div
			class="notification-item__actions"
			@click.stop
		>
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

import { NotificationsModuleNotificationActionOperation, NotificationsModuleNotificationActionType } from '../../../openapi.constants';
import type { INotification, INotificationAction } from '../store/notifications.store.schemas';

import NotificationSeverityDot from './notification-severity-dot.vue';

defineOptions({
	name: 'NotificationItem',
});

const props = withDefaults(
	defineProps<{
		notification: INotification;
		// Shared across every row in the popover (one `useNotificationAction()` call) - disables
		// the primary action button while any row's action is in flight, backstopping the
		// `isExecuting` guard inside `useNotificationAction.execute` itself.
		isExecuting?: boolean;
	}>(),
	{
		isExecuting: false,
	}
);

const emit = defineEmits<{
	(e: 'click', notification: INotification): void;
	(e: 'action', notification: INotification): void;
	(e: 'dismiss', notification: INotification): void;
}>();

const { t } = useI18n();

const primaryAction = computed<INotificationAction | undefined>((): INotificationAction | undefined =>
	props.notification.actions.find((action) => action.primary)
);

// One icon per kind of primary action, so the button reads as "opens somewhere" or "runs
// something" before the label is even parsed.
const actionIcon = computed<string>((): string => {
	const action = primaryAction.value;

	if (!action) {
		return 'mdi:arrow-right';
	}

	switch (action.type) {
		case NotificationsModuleNotificationActionType.link:
			return 'mdi:open-in-new';
		case NotificationsModuleNotificationActionType.service:
			return action.operation === NotificationsModuleNotificationActionOperation.stop
				? 'mdi:stop-circle-outline'
				: action.operation === NotificationsModuleNotificationActionOperation.start
					? 'mdi:play-circle-outline'
					: 'mdi:restart';
		default:
			return 'mdi:play-circle-outline';
	}
});

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
	margin-top: 0.4rem;
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

.notification-item__action {
	margin-top: 0.375rem;
}

.notification-item__actions {
	display: flex;
	align-items: center;
	flex-shrink: 0;
}
</style>
