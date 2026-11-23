<template>
	<div data-test-id="notifications-filter">
		<!-- The inbox filter bar, sized for the 320 px list pane: status and Unread only in the row, severity and source in
		     the filters drawer. Notifications are filtered by the backend and have no free-text search, so the shared
		     list-filter-bar (always with a search field) does not fit here -->
		<div class="flex items-center gap-2 px-4 py-3 border-b border-b-solid border-light">
			<el-select
				:model-value="innerFilters.status"
				:aria-label="t('notificationsModule.fields.filters.status.title')"
				class="flex-1 min-w-0"
				data-test-id="notifications-filter-status"
				@update:model-value="(value: INotificationsFilter['status']) => (innerFilters.status = value)"
			>
				<el-option
					v-for="status in STATUSES"
					:key="status"
					:value="status"
					:label="`${t('notificationsModule.fields.filters.status.title')}: ${t(`notificationsModule.fields.filters.status.options.${status}`)}`"
				/>
			</el-select>

			<el-checkbox
				v-model="innerFilters.unread"
				border
				class="mr-0! shrink-0"
				data-test-id="unread-only-notifications"
			>
				{{ t('notificationsModule.fields.filters.unread.title') }}
			</el-checkbox>

			<el-tooltip
				v-if="props.filtersActive"
				:content="t('notificationsModule.buttons.resetFilters.title')"
				placement="top"
			>
				<el-button
					:aria-label="t('notificationsModule.buttons.resetFilters.title')"
					text
					circle
					data-test-id="reset-notifications-filters"
					@click="emit('reset-filters')"
				>
					<template #icon>
						<icon icon="mdi:filter-off" />
					</template>
				</el-button>
			</el-tooltip>

			<el-tooltip
				:content="t('notificationsModule.headings.notifications.adjustFilters')"
				placement="top"
			>
				<el-badge
					:value="drawerFilterCount"
					:hidden="drawerFilterCount === 0"
					type="primary"
				>
					<el-button
						:aria-label="t('notificationsModule.headings.notifications.adjustFilters')"
						text
						circle
						data-test-id="adjust-notifications-filters"
						@click="drawerOpen = true"
					>
						<template #icon>
							<icon icon="mdi:filter-variant" />
						</template>
					</el-button>
				</el-badge>
			</el-tooltip>
		</div>

		<div
			v-if="props.selectedCount > 0"
			class="flex flex-wrap items-center gap-2 px-4 py-2 bg-primary-soft border-b border-b-solid border-primary-soft"
			data-test-id="notifications-filter-bulk"
		>
			<span
				class="text-card-title"
				role="status"
			>
				{{ t('application.bulkActions.selected', { count: props.selectedCount }) }}
			</span>

			<span class="flex-1" />

			<el-button
				type="primary"
				text
				data-test-id="notifications-clear-selection"
				@click="emit('clear-selection')"
			>
				{{ t('application.listFilterBar.clearSelection') }}
			</el-button>

			<div class="flex flex-wrap items-center gap-2 w-full">
				<el-button
					v-for="action in BULK_ACTIONS"
					:key="action.key"
					:type="action.key === 'delete' ? 'danger' : undefined"
					plain
					size="small"
					class="ml-0!"
					:data-test-id="`bulk-${action.key}`"
					@click="emit('bulk-action', action.key)"
				>
					{{ t(action.label) }}
				</el-button>
			</div>
		</div>

		<el-drawer
			v-model="drawerOpen"
			:title="t('notificationsModule.headings.notifications.adjustFilters')"
			:size="isPhone ? '100%' : '320px'"
			direction="rtl"
			append-to-body
			data-test-id="notifications-filter-drawer"
		>
			<list-notifications-adjust
				v-if="drawerOpen"
				v-model:filters="innerFilters"
				:filters-active="props.filtersActive"
				@reset-filters="emit('reset-filters')"
			/>
		</el-drawer>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElBadge, ElButton, ElCheckbox, ElDrawer, ElOption, ElSelect, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { useSizeClass } from '../../../common';
import type { INotificationsFilter } from '../schemas/list.schemas';

import ListNotificationsAdjust from './list-notifications-adjust.vue';

defineOptions({
	name: 'NotificationsFilter',
});

const props = withDefaults(
	defineProps<{
		filters: INotificationsFilter;
		filtersActive: boolean;
		selectedCount?: number;
	}>(),
	{
		selectedCount: 0,
	}
);

const emit = defineEmits<{
	(e: 'update:filters', filters: INotificationsFilter): void;
	(e: 'reset-filters'): void;
	(e: 'bulk-action', key: string): void;
	(e: 'clear-selection'): void;
}>();

const { t } = useI18n();
const { isPhone } = useSizeClass();

const STATUSES: INotificationsFilter['status'][] = ['all', 'active', 'dismissed', 'resolved'];

// Destructive last, in the danger colour (spec section 4)
const BULK_ACTIONS: { key: string; label: string }[] = [
	{ key: 'mark-read', label: 'notificationsModule.buttons.markRead.title' },
	{ key: 'mark-unread', label: 'notificationsModule.buttons.markUnread.title' },
	{ key: 'dismiss', label: 'notificationsModule.buttons.dismiss.title' },
	{ key: 'delete', label: 'application.bulkActions.delete' },
];

const innerFilters = useVModel(props, 'filters', emit);

const drawerOpen = ref<boolean>(false);

// The filters only the drawer shows, so the button tells there is more set than the row reveals
const drawerFilterCount = computed<number>((): number => (innerFilters.value.severity.length > 0 ? 1 : 0) + (innerFilters.value.source ? 1 : 0));
</script>
