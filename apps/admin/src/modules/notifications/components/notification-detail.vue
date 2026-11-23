<template>
	<article
		class="flex flex-col flex-1 min-h-0"
		:aria-labelledby="`notification-${props.notification.id}-title`"
		data-test-id="notification-detail"
	>
		<!-- The detail of one notification, for the right pane of the inbox and for its own page below tablet landscape.
		     Presentation only: the inbox runs the actions, because it also owns the list query -->
		<div class="flex flex-col gap-5 flex-1 min-h-0 overflow-y-auto p-4 tp:p-5">
			<header class="flex flex-col gap-2">
				<div class="flex flex-wrap items-center gap-2">
					<notification-severity-tag :severity="props.notification.severity" />
					<status-tag
						v-if="props.notification.readAt === null"
						status="primary"
						:label="t('notificationsModule.fields.notifications.readAt.no')"
						data-test-id="notification-detail-unread"
					/>
				</div>
				<h2
					:id="`notification-${props.notification.id}-title`"
					class="m-0 text-section break-words"
				>
					{{ props.notification.title }}
				</h2>
				<span class="text-help">{{ metaLine }}</span>
			</header>

			<p
				v-if="props.notification.message"
				class="m-0 text-body whitespace-pre-wrap break-words"
				data-test-id="notification-detail-message"
			>
				{{ props.notification.message }}
			</p>

			<notification-actions
				v-if="props.notification.actions.length > 0"
				:notification="props.notification"
			/>

			<section
				v-if="dataItems.length > 0"
				class="flex flex-col gap-3"
				data-test-id="notification-detail-data"
			>
				<h3 class="m-0 text-card-title">{{ t('notificationsModule.headings.notifications.data') }}</h3>
				<kv-grid :items="dataItems" />
			</section>

			<section
				class="flex flex-col gap-3"
				data-test-id="notification-detail-lifecycle"
			>
				<h3 class="m-0 text-card-title">{{ t('notificationsModule.headings.notifications.lifecycle') }}</h3>
				<kv-grid
					:items="lifecycleItems"
					:cols="2"
				/>
			</section>
		</div>

		<div
			class="sticky bottom-0 z-1 flex flex-wrap items-center justify-end gap-2 shrink-0 px-4 py-2.5 border-t border-t-solid border-light bg-surface rounded-b-lg"
			data-test-id="notification-detail-footer"
		>
			<el-button
				plain
				data-test-id="toggle-read-notification"
				@click="emit('mark-read', props.notification.id, props.notification.readAt === null)"
			>
				<template #icon>
					<icon :icon="props.notification.readAt === null ? 'mdi:email-open-outline' : 'mdi:email-outline'" />
				</template>
				{{ props.notification.readAt === null ? t('notificationsModule.buttons.markRead.title') : t('notificationsModule.buttons.markUnread.title') }}
			</el-button>

			<el-button
				v-if="props.notification.dismissedAt === null"
				plain
				data-test-id="dismiss-notification"
				@click="emit('dismiss', props.notification.id)"
			>
				<template #icon>
					<icon icon="mdi:eye-off-outline" />
				</template>
				{{ t('notificationsModule.buttons.dismiss.title') }}
			</el-button>

			<!-- Spec section 4: the destructive action lives in the more menu -->
			<el-tooltip
				:content="t('notificationsModule.buttons.more.title')"
				placement="top"
			>
				<el-dropdown
					trigger="click"
					placement="top-end"
					@command="emit('remove', props.notification.id)"
				>
					<el-button
						:aria-label="t('notificationsModule.buttons.more.title')"
						text
						circle
						data-test-id="notification-detail-more"
					>
						<template #icon>
							<icon icon="mdi:dots-horizontal" />
						</template>
					</el-button>

					<template #dropdown>
						<el-dropdown-menu>
							<el-dropdown-item
								command="remove"
								class="text-danger!"
								data-test-id="remove-notification"
							>
								{{ t('application.bulkActions.delete') }}
							</el-dropdown-item>
						</el-dropdown-menu>
					</template>
				</el-dropdown>
			</el-tooltip>
		</div>
	</article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { KvGrid, type KvGridItem, StatusTag } from '../../../common';
import { formatRelativeTime } from '../notifications.utils';
import type { INotification } from '../store/notifications.store.schemas';

import NotificationActions from './notification-actions.vue';
import NotificationSeverityTag from './notification-severity-tag.vue';

defineOptions({
	name: 'NotificationDetail',
});

const props = defineProps<{
	notification: INotification;
}>();

const emit = defineEmits<{
	(e: 'mark-read', id: INotification['id'], read: boolean): void;
	(e: 'dismiss', id: INotification['id']): void;
	(e: 'remove', id: INotification['id']): void;
}>();

const { t, locale } = useI18n();

const formatTimestamp = (date: Date): string => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'medium' }).format(date);

const metaLine = computed<string>((): string =>
	[
		props.notification.source,
		formatRelativeTime(props.notification.createdAt, locale.value),
		props.notification.occurrences > 1
			? `${t('notificationsModule.fields.notifications.occurrences.title')}: ${props.notification.occurrences}`
			: null,
	]
		.filter((part): part is string => part !== null)
		.join(' · ')
);

const dataItems = computed<KvGridItem[]>((): KvGridItem[] =>
	Object.entries(props.notification.data ?? {}).map(([label, value]) => ({
		label,
		value: value === null ? null : typeof value === 'boolean' ? String(value) : value,
		mono: true,
	}))
);

const lifecycleItems = computed<KvGridItem[]>((): KvGridItem[] => {
	const notification = props.notification;

	return [
		{ label: t('notificationsModule.fields.notifications.createdAt.title'), value: formatTimestamp(notification.createdAt) },
		...(notification.updatedAt
			? [{ label: t('notificationsModule.fields.notifications.updatedAt.title'), value: formatTimestamp(notification.updatedAt) }]
			: []),
		{
			label: t('notificationsModule.fields.notifications.readAt.title'),
			value: notification.readAt ? formatTimestamp(notification.readAt) : t('notificationsModule.fields.notifications.readAt.no'),
		},
		{
			label: t('notificationsModule.fields.notifications.dismissedAt.title'),
			value: notification.dismissedAt ? formatTimestamp(notification.dismissedAt) : t('notificationsModule.fields.notifications.dismissedAt.no'),
		},
		{
			label: t('notificationsModule.fields.notifications.resolvedAt.title'),
			value: notification.resolvedAt ? formatTimestamp(notification.resolvedAt) : t('notificationsModule.fields.notifications.resolvedAt.no'),
		},
		{ label: t('notificationsModule.fields.notifications.occurrences.title'), value: notification.occurrences },
	];
});
</script>
