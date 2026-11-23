<template>
	<div
		class="flex flex-col"
		data-test-id="notifications-inbox-list"
	>
		<!-- The list side of the inbox (template 7): newest first, the open row highlighted, unread rows in bold with a
		     dot. A chronological feed, so it grows with Load more rather than pages -->
		<state-view
			v-if="props.items.length === 0 && props.loading"
			kind="loading"
			icon="mdi:bell-outline"
			:title="t('notificationsModule.texts.notifications.loading')"
		/>

		<state-view
			v-else-if="props.items.length === 0 && props.filtersActive"
			kind="empty"
			icon="mdi:filter-multiple"
			:title="t('notificationsModule.texts.notifications.noFilteredNotifications')"
		>
			<template #action>
				<el-button
					plain
					data-test-id="reset-notifications-filters-empty"
					@click="emit('reset-filters')"
				>
					{{ t('notificationsModule.buttons.resetFilters.title') }}
				</el-button>
			</template>
		</state-view>

		<state-view
			v-else-if="props.items.length === 0"
			kind="empty"
			icon="mdi:bell-check-outline"
			:title="t('notificationsModule.texts.notifications.noNotifications')"
		/>

		<ul
			v-else
			class="m-0 p-0 list-none"
		>
			<li
				v-for="notification in props.items"
				:key="notification.id"
				:class="[
					'flex items-start gap-3 px-4 py-3 border-b border-b-solid border-light',
					notification.id === props.activeId ? 'bg-primary-soft' : '',
				]"
				:data-unread="notification.readAt === null ? 'true' : undefined"
				data-test-id="notifications-inbox-row"
			>
				<el-checkbox
					:model-value="props.selectedIds.includes(notification.id)"
					:aria-label="t('notificationsModule.aria.select', { title: notification.title })"
					class="h-auto! mt-px"
					data-test-id="notifications-inbox-select"
					@update:model-value="(value: string | number | boolean) => onSelect(notification.id, value === true)"
				/>

				<button
					:aria-current="notification.id === props.activeId ? 'true' : undefined"
					class="flex items-start gap-2 flex-1 min-w-0 p-0 border-0 bg-transparent text-left font-inherit text-inherit cursor-pointer"
					type="button"
					data-test-id="notifications-inbox-open"
					@click="emit('open', notification.id)"
				>
					<notification-severity-dot
						:severity="notification.severity"
						class="mt-[6px]"
					/>
					<span class="flex flex-col gap-0.5 flex-1 min-w-0">
						<span class="flex items-center gap-2 min-w-0">
							<span :class="['truncate', notification.readAt === null ? 'text-card-title' : 'text-body']">{{ notification.title }}</span>
							<span
								v-if="notification.occurrences > 1"
								class="shrink-0 text-caption"
							>
								×{{ notification.occurrences }}
							</span>
						</span>
						<span class="text-help truncate">{{ notification.source }} · {{ formatTimeAgo(notification.createdAt) }}</span>
					</span>
					<span
						v-if="notification.readAt === null"
						:aria-label="t('notificationsModule.fields.notifications.readAt.no')"
						role="img"
						class="shrink-0 w-2 h-2 mt-[7px] rounded-full bg-primary"
					/>
				</button>
			</li>
		</ul>

		<div
			v-if="props.hasMore && props.items.length > 0"
			class="flex justify-center py-3"
		>
			<el-button
				plain
				:loading="props.loading"
				data-test-id="load-more-notifications"
				@click="emit('load-more')"
			>
				{{ t('notificationsModule.buttons.loadMore.title') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElCheckbox } from 'element-plus';

import { formatTimeAgo } from '@vueuse/core';

import { StateView } from '../../../common';
import type { INotification } from '../store/notifications.store.schemas';

import NotificationSeverityDot from './notification-severity-dot.vue';

defineOptions({
	name: 'NotificationsInboxList',
});

const props = withDefaults(
	defineProps<{
		items: INotification[];
		/** The notification open in the detail */
		activeId?: INotification['id'] | null;
		/** The rows picked for a bulk action (`v-model:selected-ids`) */
		selectedIds: INotification['id'][];
		loading: boolean;
		filtersActive: boolean;
		hasMore: boolean;
	}>(),
	{
		activeId: null,
	}
);

const emit = defineEmits<{
	(e: 'open', id: INotification['id']): void;
	(e: 'load-more'): void;
	(e: 'reset-filters'): void;
	(e: 'update:selected-ids', ids: INotification['id'][]): void;
}>();

const { t } = useI18n();

const onSelect = (id: INotification['id'], selected: boolean): void => {
	emit('update:selected-ids', selected ? [...props.selectedIds, id] : props.selectedIds.filter((selectedId) => selectedId !== id));
};
</script>
