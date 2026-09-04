<template>
	<el-table
		v-loading="props.loading"
		:element-loading-text="t('notificationsModule.texts.notifications.loading')"
		:data="props.items"
		table-layout="fixed"
		row-key="id"
		class="flex-grow"
		:style="{ maxHeight: props.tableHeight + 'px' }"
		:max-height="props.tableHeight"
		@selection-change="onSelectionChange"
		@row-click="onRowClick"
	>
		<template #empty>
			<div
				v-if="props.loading"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:bell-outline" />
							</template>
							<template #secondary>
								<icon icon="mdi:database-refresh" />
							</template>
						</icon-with-child>
					</template>
				</el-result>
			</div>

			<div
				v-else-if="props.filtersActive"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:bell-outline" />
							</template>
							<template #secondary>
								<icon icon="mdi:filter-multiple" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						<el-text class="block">
							{{ t('notificationsModule.texts.notifications.noFilteredNotifications') }}
						</el-text>

						<el-button
							type="primary"
							plain
							class="mt-4"
							data-test-id="reset-notifications-filters-empty"
							@click="emit('reset-filters')"
						>
							<template #icon>
								<icon icon="mdi:filter-off" />
							</template>

							{{ t('notificationsModule.buttons.resetFilters.title') }}
						</el-button>
					</template>
				</el-result>
			</div>

			<div
				v-else
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:bell-outline" />
							</template>
							<template #secondary>
								<icon icon="mdi:information" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('notificationsModule.texts.notifications.noNotifications') }}
					</template>
				</el-result>
			</div>
		</template>

		<el-table-column
			v-if="isMDDevice"
			type="selection"
			fixed
			:width="30"
		/>

		<el-table-column
			:width="60"
			align="center"
		>
			<template #default="scope">
				<el-avatar
					:size="32"
					:class="['notifications-table__icon', `notifications-table__icon--${(scope.row as INotification).severity}`]"
				>
					<icon
						:icon="SEVERITY_ICONS[(scope.row as INotification).severity]"
						class="w-[20px] h-[20px]"
					/>
				</el-avatar>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('notificationsModule.table.columns.severity.title')"
			prop="severity"
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
			class-name="py-0!"
		>
			<template #default="scope">
				<template v-if="(scope.row as INotification).message">
					<strong class="block">
						<span
							v-if="(scope.row as INotification).readAt === null"
							class="notifications-table__unread"
							:title="t('notificationsModule.fields.notifications.readAt.no')"
						/>
						{{ (scope.row as INotification).title }}
					</strong>
					<el-text
						size="small"
						class="block leading-4"
						truncated
					>
						{{ (scope.row as INotification).message }}
					</el-text>
				</template>
				<template v-else>
					<span
						v-if="(scope.row as INotification).readAt === null"
						class="notifications-table__unread"
						:title="t('notificationsModule.fields.notifications.readAt.no')"
					/>
					{{ (scope.row as INotification).title }}
				</template>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('notificationsModule.table.columns.source.title')"
			prop="source"
			:width="200"
		>
			<template #default="scope">
				<el-link
					:type="innerFilters.source === (scope.row as INotification).source ? 'danger' : undefined"
					underline="never"
					class="font-400! overflow-hidden"
					@click.stop="onFilterBySource((scope.row as INotification).source)"
				>
					<el-icon class="el-icon--left">
						<icon
							v-if="innerFilters.source === (scope.row as INotification).source"
							icon="mdi:filter-minus"
						/>
						<icon
							v-else
							icon="mdi:filter-plus"
						/>
					</el-icon>

					<el-text
						class="block leading-4 max-w-[80%]!"
						truncated
					>
						{{ (scope.row as INotification).source }}
					</el-text>
				</el-link>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('notificationsModule.table.columns.occurrences.title')"
			prop="occurrences"
			:width="90"
			align="center"
		>
			<template #default="scope">
				{{ (scope.row as INotification).occurrences }}
			</template>
		</el-table-column>

		<el-table-column
			:label="t('notificationsModule.table.columns.time.title')"
			prop="createdAt"
			:width="150"
		>
			<template #default="scope">
				<el-tooltip
					:content="formatFull((scope.row as INotification).createdAt)"
					placement="top"
					:show-after="500"
				>
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

		<el-table-column
			:width="190"
			align="right"
		>
			<template #default="scope">
				<div @click.stop>
					<el-button
						size="small"
						plain
						data-test-id="detail-notification"
						@click="emit('detail', (scope.row as INotification).id)"
					>
						<template #icon>
							<icon icon="mdi:file-search-outline" />
						</template>

						{{ t('notificationsModule.buttons.detail.title') }}
					</el-button>
					<el-button
						v-if="(scope.row as INotification).dismissedAt === null"
						size="small"
						plain
						class="ml-1!"
						:aria-label="t('notificationsModule.buttons.dismiss.title')"
						data-test-id="dismiss-notification"
						@click="emit('dismiss', (scope.row as INotification).id)"
					>
						<template #icon>
							<icon icon="mdi:eye-off-outline" />
						</template>
					</el-button>
					<el-button
						size="small"
						type="warning"
						plain
						class="ml-1!"
						:aria-label="t('application.bulkActions.delete')"
						data-test-id="remove-notification"
						@click="emit('remove', (scope.row as INotification).id)"
					>
						<template #icon>
							<icon icon="mdi:trash" />
						</template>
					</el-button>
				</div>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElAvatar, ElButton, ElIcon, ElLink, ElResult, ElTable, ElTableColumn, ElText, ElTooltip, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';
import { formatTimeAgo, useVModel } from '@vueuse/core';

import { IconWithChild, useBreakpoints } from '../../../common';
import { SEVERITY_ICONS } from '../notifications.constants';
import type { INotificationsFilter } from '../schemas/list.schemas';
import type { INotification } from '../store/notifications.store.schemas';

import NotificationActions from './notification-actions.vue';
import NotificationSeverityTag from './notification-severity-tag.vue';

defineOptions({
	name: 'NotificationsTable',
});

const props = defineProps<{
	items: INotification[];
	filters: INotificationsFilter;
	loading: boolean;
	filtersActive: boolean;
	tableHeight: number;
}>();

const emit = defineEmits<{
	(e: 'detail', id: INotification['id']): void;
	(e: 'dismiss', id: INotification['id']): void;
	(e: 'remove', id: INotification['id']): void;
	(e: 'reset-filters'): void;
	(e: 'selected-changes', selected: INotification[]): void;
	(e: 'update:filters', filters: INotificationsFilter): void;
}>();

const { t } = useI18n();

const { isMDDevice } = useBreakpoints();

const innerFilters = useVModel(props, 'filters', emit);

const formatFull = (date: Date): string => date.toLocaleString();

const onSelectionChange = (selected: INotification[]): void => {
	emit('selected-changes', selected);
};

const onRowClick = (row: INotification): void => {
	emit('detail', row.id);
};

// The same toggle the devices table offers on its plugin column: clicking a source narrows the
// list to that source, clicking it again lifts the constraint.
const onFilterBySource = (source: INotification['source']): void => {
	innerFilters.value.source = innerFilters.value.source === source ? undefined : source;
};
</script>

<style scoped>
.notifications-table__icon--warning {
	--el-avatar-bg-color: var(--el-color-warning);
}

.notifications-table__icon--error,
.notifications-table__icon--critical {
	--el-avatar-bg-color: var(--el-color-danger);
}

.notifications-table__unread {
	display: inline-block;
	width: 0.5rem;
	height: 0.5rem;
	margin-right: 0.375rem;
	border-radius: 50%;
	background-color: var(--el-color-primary);
	vertical-align: middle;
}
</style>
