<template>
	<div class="list-notifications">
		<bulk-actions-toolbar
			v-if="selectedIds.length > 0"
			:selected-count="selectedIds.length"
			:actions="bulkActions"
			@action="onBulkAction"
		/>

		<el-table
			v-loading="props.loading"
			:element-loading-text="t('notificationsModule.texts.notifications.loading')"
			:data="props.items"
			row-key="id"
			table-layout="fixed"
			class="list-notifications__table"
			@selection-change="onSelectionChange"
			@row-click="onRowClick"
		>
			<template #empty>
				<el-empty :description="t('notificationsModule.texts.notifications.empty')" />
			</template>

			<el-table-column
				type="selection"
				:width="42"
			/>

			<el-table-column
				:label="t('notificationsModule.table.columns.severity.title')"
				:width="110"
			>
				<template #default="scope">
					<notification-severity-tag :severity="(scope.row as INotification).severity" />
				</template>
			</el-table-column>

			<el-table-column
				:label="t('notificationsModule.table.columns.title.title')"
				prop="title"
				:min-width="220"
			>
				<template #default="scope">
					<el-text truncated>{{ (scope.row as INotification).title }}</el-text>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('notificationsModule.table.columns.source.title')"
				prop="source"
				:width="220"
			>
				<template #default="scope">
					<el-text
						truncated
						size="small"
						type="info"
					>
						{{ (scope.row as INotification).source }}
					</el-text>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('notificationsModule.table.columns.occurrences.title')"
				:width="110"
				align="center"
			>
				<template #default="scope">
					{{ (scope.row as INotification).occurrences }}
				</template>
			</el-table-column>

			<el-table-column
				:label="t('notificationsModule.table.columns.time.title')"
				:width="150"
			>
				<template #default="scope">
					<el-tooltip :content="formatFull((scope.row as INotification).createdAt)">
						<span>{{ formatTimeAgo((scope.row as INotification).createdAt) }}</span>
					</el-tooltip>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('notificationsModule.table.columns.actions.title')"
				:min-width="180"
			>
				<template #default="scope">
					<notification-actions :notification="scope.row as INotification" />
				</template>
			</el-table-column>
		</el-table>

		<div
			v-if="props.hasMore"
			class="list-notifications__load-more"
		>
			<el-button
				:loading="props.loading"
				@click="emit('load-more')"
			>
				{{ t('notificationsModule.buttons.loadMore.title') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElEmpty, ElTable, ElTableColumn, ElText, ElTooltip, vLoading } from 'element-plus';

import { formatTimeAgo } from '@vueuse/core';

import { BulkActionsToolbar, type IBulkAction } from '../../../common';
import type { INotification } from '../store/notifications.store.schemas';

import NotificationActions from './notification-actions.vue';
import NotificationSeverityTag from './notification-severity-tag.vue';

defineOptions({
	name: 'ListNotifications',
});

const props = defineProps<{
	items: INotification[];
	hasMore: boolean;
	loading: boolean;
}>();

const emit = defineEmits<{
	(e: 'detail', id: INotification['id']): void;
	(e: 'load-more'): void;
	(e: 'bulk-action', action: string, ids: INotification['id'][]): void;
}>();

const { t } = useI18n();

const selectedIds = ref<INotification['id'][]>([]);

const bulkActions = computed<IBulkAction[]>((): IBulkAction[] => [
	{ key: 'mark-read', label: t('notificationsModule.buttons.markRead.title'), icon: 'mdi:email-open-outline', type: 'info' },
	{ key: 'mark-unread', label: t('notificationsModule.buttons.markUnread.title'), icon: 'mdi:email-outline', type: 'info' },
	{ key: 'dismiss', label: t('notificationsModule.buttons.dismiss.title'), icon: 'mdi:eye-off-outline', type: 'warning' },
	{ key: 'delete', label: t('application.bulkActions.delete'), icon: 'mdi:trash-can-outline', type: 'danger' },
]);

const formatFull = (date: Date): string => date.toISOString();

const onSelectionChange = (selected: INotification[]): void => {
	selectedIds.value = selected.map((notification) => notification.id);
};

const onRowClick = (row: INotification): void => {
	emit('detail', row.id);
};

const onBulkAction = (action: string): void => {
	emit('bulk-action', action, selectedIds.value);
};
</script>

<style scoped>
.list-notifications {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.list-notifications__table :deep(.el-table__row) {
	cursor: pointer;
}

.list-notifications__load-more {
	display: flex;
	justify-content: center;
	padding: 0.75rem 0;
}
</style>
