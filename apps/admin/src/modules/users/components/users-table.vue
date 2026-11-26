<template>
	<el-table
		ref="tableEl"
		v-loading="props.loading && props.items.length > 0"
		:element-loading-text="t('usersModule.texts.misc.loadingUsers')"
		:data="props.items"
		:default-sort="props.sortDir !== null ? { prop: props.sortBy, order: props.sortDir } : undefined"
		table-layout="fixed"
		row-key="id"
		class="flex-grow"
		:style="{ maxHeight: props.tableHeight + 'px' }"
		:max-height="props.tableHeight"
		@sort-change="onSortData"
		@selection-change="onSelectionChange"
		@row-click="onRowClick"
	>
		<template #empty>
			<users-empty
				:loading="props.loading"
				:filters-active="props.filtersActive"
				@reset-filters="emit('reset-filters')"
			/>
		</template>

		<el-table-column
			type="selection"
			fixed="left"
			:width="40"
			:selectable="isSelectable"
		/>

		<el-table-column
			:width="56"
			align="center"
		>
			<template #default="scope">
				<user-avatar
					:email="scope.row.email"
					:size="32"
				/>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('usersModule.table.columns.username.title')"
			prop="username"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="160"
		>
			<template #default="scope">
				<span class="block text-card-title truncate">{{ scope.row.username }}</span>
			</template>
		</el-table-column>

		<!-- Tablet portrait keeps the username, the email and the role; the names stay in the editor -->
		<el-table-column
			v-if="!isTabletPortrait"
			:label="t('usersModule.table.columns.firstName.title')"
			prop="firstName"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="140"
		>
			<template #default="scope">
				<span class="block text-body truncate">{{ scope.row.firstName ?? '—' }}</span>
			</template>
		</el-table-column>

		<el-table-column
			v-if="!isTabletPortrait"
			:label="t('usersModule.table.columns.lastName.title')"
			prop="lastName"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="140"
		>
			<template #default="scope">
				<span class="block text-body truncate">{{ scope.row.lastName ?? '—' }}</span>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('usersModule.table.columns.email.title')"
			prop="email"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="200"
		>
			<template #default="scope">
				<span class="block text-body truncate">{{ scope.row.email ?? '—' }}</span>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('usersModule.table.columns.role.title')"
			prop="role"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="120"
		>
			<template #default="scope">
				<status-tag
					:status="roleStatus(scope.row.role)"
					:label="t(`usersModule.role.${scope.row.role}`)"
				/>
			</template>
		</el-table-column>

		<!-- Wide enough for Edit and More side by side at the touch size (40 px each, spec section 6) -->
		<el-table-column
			:width="112"
			align="right"
			fixed="right"
		>
			<template #default="scope">
				<users-row-actions
					:user="scope.row"
					:removable="isSelectable(scope.row)"
					@edit="(id: IUser['id']) => emit('edit', id)"
					@remove="(id: IUser['id']) => emit('remove', id)"
				/>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElTable, ElTableColumn, vLoading } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { StatusTag, UserAvatar, useSizeClass } from '../../../common';
import type { IUsersFilter } from '../composables/types';
import type { IUser } from '../store/users.store.types';

import UsersEmpty from './users-empty.vue';
import UsersRowActions from './users-row-actions.vue';
import type { IUsersTableProps } from './users-table.types';
import { canRemoveUser, roleStatus } from './users.utils';

defineOptions({
	name: 'UsersTable',
});

const props = defineProps<IUsersTableProps>();

const emit = defineEmits<{
	(e: 'edit', id: IUser['id']): void;
	(e: 'remove', id: IUser['id']): void;
	(e: 'reset-filters'): void;
	(e: 'selected-changes', selected: IUser[]): void;
	(e: 'update:filters', filters: IUsersFilter): void;
	(e: 'update:sort-by', by: 'username' | 'firstName' | 'lastName' | 'email' | 'role'): void;
	(e: 'update:sort-dir', dir: 'ascending' | 'descending' | null): void;
}>();

const { t } = useI18n();

const { isTabletPortrait } = useSizeClass();

const tableEl = ref<InstanceType<typeof ElTable> | null>(null);

// The owner and the operator's own account cannot be removed, so they cannot be picked for a bulk delete either
const isSelectable = (row: IUser): boolean => canRemoveUser(row, props.currentUserId);

useVModel(props, 'filters', emit);

const onSortData = ({
	prop,
	order,
}: {
	prop: 'username' | 'firstName' | 'lastName' | 'email' | 'role';
	order: 'ascending' | 'descending' | null;
}): void => {
	emit('update:sort-by', prop);
	emit('update:sort-dir', order);
};

const onSelectionChange = (selected: IUser[]): void => {
	emit('selected-changes', selected);
};

const onRowClick = (row: IUser): void => {
	emit('edit', row.id);
};

// The filter bar's Clear selection
const clearSelection = (): void => {
	tableEl.value?.clearSelection();
};

defineExpose({ clearSelection });
</script>
