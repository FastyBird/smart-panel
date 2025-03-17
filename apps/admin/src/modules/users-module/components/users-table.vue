<template>
	<el-table
		:data="props.items"
		:default-sort="{ prop: props.sortBy, order: props.sortDir || 'ascending' }"
		table-layout="fixed"
		class="flex-grow"
		@sort-change="onSortData"
		@selection-change="onSelectionChange"
		@row-click="onRowClick"
	>
		<template #empty>
			<div
				v-if="noResults && !props.loading"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:users-group" />
							</template>
							<template #secondary>
								<icon icon="mdi:information" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('usersModule.texts.misc.noUsers') }}
					</template>
				</el-result>
			</div>

			<div
				v-else-if="noFilteredResults && !props.loading"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:users-group" />
							</template>
							<template #secondary>
								<icon icon="mdi:filter-multiple" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						<el-text class="block">
							{{ t('usersModule.texts.misc.noFilteredUsers') }}
						</el-text>

						<el-button
							type="primary"
							class="mt-4"
							@click="emit('reset-filters')"
						>
							<template #icon>
								<icon icon="mdi:filter-off" />
							</template>

							{{ t('usersModule.buttons.resetFilters.title') }}
						</el-button>
					</template>
				</el-result>
			</div>
		</template>

		<el-table-column
			v-if="isMDDevice"
			type="selection"
			:width="30"
		/>

		<el-table-column
			:width="60"
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
			:min-width="150"
		>
			<template #default="scope">
				{{ scope.row.username }}
			</template>
		</el-table-column>

		<el-table-column
			:label="t('usersModule.table.columns.firstName.title')"
			prop="firstName"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="150"
		>
			<template #default="scope">
				{{ scope.row.firstName }}
			</template>
		</el-table-column>

		<el-table-column
			:label="t('usersModule.table.columns.lastName.title')"
			prop="lastName"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="150"
		>
			<template #default="scope">
				{{ scope.row.lastName }}
			</template>
		</el-table-column>

		<el-table-column
			:label="t('usersModule.table.columns.email.title')"
			prop="email"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="150"
		>
			<template #default="scope">
				{{ scope.row.email }}
			</template>
		</el-table-column>

		<el-table-column
			:label="t('usersModule.table.columns.role.title')"
			prop="role"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
		>
			<template #default="scope">
				{{ t(`usersModule.role.${scope.row.role}`) }}
			</template>
		</el-table-column>

		<el-table-column
			:width="200"
			align="right"
		>
			<template #default="scope">
				<el-button-group>
					<el-button
						size="small"
						data-test-id="edit-user"
						@click="emit('edit', scope.row.id)"
					>
						{{ t('usersModule.buttons.edit.title') }}
					</el-button>
					<el-button
						size="small"
						type="danger"
						data-test-id="remove-user"
						@click="emit('remove', scope.row.id)"
					>
						{{ t('usersModule.buttons.remove.title') }}
					</el-button>
				</el-button-group>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElButtonGroup, ElResult, ElTable, ElTableColumn, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { IconWithChild, UserAvatar, useBreakpoints } from '../../../common';
import type { IUser } from '../store';

import type { IUsersTableProps } from './users-table.types';

defineOptions({
	name: 'UsersTable',
});

const props = defineProps<IUsersTableProps>();

const emit = defineEmits<{
	(e: 'edit', id: string): void;
	(e: 'remove', id: string): void;
	(e: 'reset-filters'): void;
	(e: 'selected-changes', selected: IUser[]): void;
	(e: 'update:sort-dir', dir: 'ascending' | 'descending' | null): void;
}>();

const { t } = useI18n();

const { isMDDevice } = useBreakpoints();

const noResults = computed<boolean>((): boolean => props.totalRows === 0);

const noFilteredResults = computed<boolean>((): boolean => props.totalRows > 0 && props.items.length === 0);

const onSortData = ({ order }: { order: 'ascending' | 'descending' | null }): void => {
	emit('update:sort-dir', order);
};

const onSelectionChange = (selected: IUser[]): void => {
	emit('selected-changes', selected);
};

const onRowClick = (row: IUser): void => {
	emit('edit', row.id);
};
</script>
