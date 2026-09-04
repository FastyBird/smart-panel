<template>
	<el-card
		shadow="never"
		class="px-1 py-2 shrink-0"
		body-class="p-0!"
	>
		<notifications-filter
			v-model:filters="innerFilters"
			:filters-active="props.filtersActive"
			:selected-count="selectedItems.length"
			:bulk-actions="bulkActions"
			@reset-filters="emit('reset-filters')"
			@bulk-action="onBulkAction"
		/>
	</el-card>

	<div
		ref="wrapper"
		class="flex-grow overflow-hidden"
	>
		<el-card
			shadow="never"
			class="max-h-full flex flex-col overflow-hidden box-border"
			body-class="p-0! max-h-full overflow-hidden flex flex-col"
		>
			<notifications-table
				v-model:filters="innerFilters"
				:items="props.items"
				:loading="props.loading"
				:filters-active="props.filtersActive"
				:table-height="tableHeight"
				@detail="onDetail"
				@dismiss="onDismiss"
				@remove="onRemove"
				@reset-filters="emit('reset-filters')"
				@selected-changes="onSelectionChange"
			/>

			<div
				ref="paginator"
				class="flex justify-center w-full"
				:class="{ 'py-4': props.hasMore }"
			>
				<el-button
					v-if="props.hasMore"
					plain
					:loading="props.loading"
					data-test-id="load-more-notifications"
					@click="emit('load-more')"
				>
					<template #icon>
						<icon icon="mdi:chevron-down" />
					</template>

					{{ t('notificationsModule.buttons.loadMore.title') }}
				</el-button>
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { type IBulkAction, useBreakpoints } from '../../../common';
import type { INotificationsFilter } from '../schemas/list.schemas';
import type { INotification } from '../store/notifications.store.schemas';

import NotificationsFilter from './notifications-filter.vue';
import NotificationsTable from './notifications-table.vue';

defineOptions({
	name: 'ListNotifications',
});

const props = defineProps<{
	items: INotification[];
	filters: INotificationsFilter;
	filtersActive: boolean;
	hasMore: boolean;
	loading: boolean;
}>();

const emit = defineEmits<{
	(e: 'detail', id: INotification['id']): void;
	(e: 'dismiss', id: INotification['id']): void;
	(e: 'remove', id: INotification['id']): void;
	(e: 'load-more'): void;
	(e: 'reset-filters'): void;
	(e: 'update:filters', filters: INotificationsFilter): void;
	(e: 'bulk-action', action: string, ids: INotification['id'][]): void;
}>();

const { t } = useI18n();
const { isMDDevice } = useBreakpoints();

let observer: ResizeObserver | null = null;

const wrapper = ref<HTMLElement | null>(null);
const paginator = ref<HTMLElement | null>(null);

const innerFilters = useVModel(props, 'filters', emit);

const tableHeight = ref<number>(250);

const selectedItems = ref<INotification[]>([]);

const bulkActions = computed<IBulkAction[]>((): IBulkAction[] => [
	{ key: 'mark-read', label: t('notificationsModule.buttons.markRead.title'), icon: 'mdi:email-open-outline', type: 'info' },
	{ key: 'mark-unread', label: t('notificationsModule.buttons.markUnread.title'), icon: 'mdi:email-outline', type: 'info' },
	{ key: 'dismiss', label: t('notificationsModule.buttons.dismiss.title'), icon: 'mdi:eye-off-outline', type: 'warning' },
	{ key: 'delete', label: t('application.bulkActions.delete'), icon: 'mdi:trash-can-outline', type: 'danger' },
]);

const onDetail = (id: INotification['id']): void => {
	emit('detail', id);
};

const onDismiss = (id: INotification['id']): void => {
	emit('dismiss', id);
};

const onRemove = (id: INotification['id']): void => {
	emit('remove', id);
};

const onSelectionChange = (selected: INotification[]): void => {
	selectedItems.value = selected;
};

const onBulkAction = (action: string): void => {
	emit(
		'bulk-action',
		action,
		selectedItems.value.map((notification) => notification.id)
	);
};

onMounted((): void => {
	if (!wrapper.value) {
		return;
	}

	const updateHeight = (): void => {
		tableHeight.value = wrapper.value!.clientHeight - (paginator.value?.clientHeight ?? 0);
	};

	if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
		observer = new ResizeObserver(updateHeight);
		observer.observe(wrapper.value);

		// The "Load more" row comes and goes with `hasMore`, which changes the height left for the
		// table without the wrapper itself ever resizing.
		if (paginator.value) {
			observer.observe(paginator.value);
		}
	}

	updateHeight();
});

onBeforeUnmount((): void => {
	observer?.disconnect();
	observer = null;
});

watch(
	(): boolean => isMDDevice.value,
	(val: boolean): void => {
		// The selection column is only rendered from `md` up - a selection made there must not
		// linger, invisible, once the viewport shrinks below it.
		if (!val) {
			selectedItems.value = [];
		}
	}
);
</script>
