<template>
	<el-table
		v-loading="props.loading"
		:element-loading-text="t('usersModule.texts.misc.loadingUsers')"
		:data="props.items"
		:default-sort="{ prop: props.sortBy, order: props.sortDir || 'ascending' }"
		table-layout="fixed"
		row-key="id"
		class="flex-grow"
		:style="{ maxHeight: tableHeight + 'px' }"
		:max-height="tableHeight"
		@sort-change="onSortData"
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
								<icon icon="mdi:users-group" />
							</template>
							<template #secondary>
								<icon icon="mdi:database-refresh" />
							</template>
						</icon-with-child>
					</template>
				</el-result>
			</div>

			<div
				v-else-if="noResults && !props.loading"
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
				v-else-if="props.filtersActive && !props.loading"
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
							plain
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
				<el-link
					:type="innerFilters.roles.includes(scope.row.role) ? 'danger' : undefined"
					underline="never"
					class="font-400!"
					@click.stop="onFilterBy('role', scope.row.role, !innerFilters.roles.includes(scope.row.role))"
				>
					<el-icon class="el-icon--left">
						<icon
							v-if="innerFilters.roles.includes(scope.row.role)"
							icon="mdi:filter-minus"
						/>
						<icon
							v-else
							icon="mdi:filter-plus"
						/>
					</el-icon>

					{{ t(`usersModule.role.${scope.row.role}`) }}
				</el-link>
			</template>
		</el-table-column>

		<el-table-column
			:width="120"
			align="right"
		>
			<template #default="scope">
				<div @click.stop>
					<el-button
						size="small"
						plain
						data-test-id="edit-user"
						@click="emit('edit', scope.row.id)"
					>
						<template #icon>
							<icon icon="mdi:pencil" />
						</template>
					</el-button>
					<el-button
						size="small"
						type="danger"
						plain
						class="ml-1!"
						data-test-id="remove-user"
						@click="emit('remove', scope.row.id)"
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
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElIcon, ElLink, ElResult, ElTable, ElTableColumn, ElText, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { IconWithChild, UserAvatar, useBreakpoints } from '../../../common';
import { UsersModuleUserRole } from '../../../openapi.constants';
import type { IUsersFilter } from '../composables/types';
import type { IUser } from '../store/users.store.types';

import type { IUsersTableProps } from './users-table.types';

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

const { isMDDevice } = useBreakpoints();

const noResults = computed<boolean>((): boolean => props.totalRows === 0);

const innerFilters = useVModel(props, 'filters', emit);

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

const onFilterBy = (column: string, data: string, add?: boolean): void => {
	if (column === 'role') {
		let filteredRoles = innerFilters.value.roles;

		if (add === true) {
			filteredRoles.push(data as UsersModuleUserRole);
		} else {
			filteredRoles = innerFilters.value.roles.filter((item) => item !== data);
		}

		innerFilters.value.roles = Array.from(new Set(filteredRoles));
	}
};
</script>
