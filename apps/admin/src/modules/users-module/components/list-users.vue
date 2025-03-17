<template>
	<div
		class="h-full w-full flex flex-col"
		:class="[ns.b()]"
	>
		<el-card
			shadow="never"
			class="px-1 py-2 mt-2"
			:class="[ns.e('filter-card')]"
		>
			<users-filter
				v-model:filters="innerFilters"
				v-model:remote-form-reset="remoteFiltersReset"
			/>
		</el-card>

		<el-card
			shadow="never"
			class="mt-2"
			:class="[ns.e('table-card')]"
		>
			<users-table
				v-model:sort-by="sortBy"
				v-model:sort-dir="sortDir"
				:items="props.items"
				:total-rows="props.totalRows"
				:loading="props.loading"
				@edit="onEdit"
				@remove="onRemove"
				@reset-filters="onResetFilters"
			/>
			<div class="flex justify-center w-full py-4">
				<el-pagination
					v-model:current-page="paginatePage"
					v-model:page-size="paginateSize"
					:layout="isMDDevice ? 'total, sizes, prev, pager, next, jumper' : 'total, sizes, prev, pager, next'"
					:total="props.allItems.length"
					@size-change="onPaginatePageSize"
					@current-change="onPaginatePage"
				/>
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

import { ElCard, ElPagination, useNamespace } from 'element-plus';

import { useBreakpoints } from '../../../common';

import { type IListUsersFilterFields, type IListUsersProps } from './list-users.types';
import UsersFilter from './users-filter.vue';
import UsersTable from './users-table.vue';

defineOptions({
	name: 'ListUsers',
});

const props = defineProps<IListUsersProps>();

const emit = defineEmits<{
	(e: 'edit', id: string): void;
	(e: 'remove', id: string): void;
	(e: 'reset-filters'): void;
	(e: 'update:filters', filters: IListUsersFilterFields): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', dir: 'username' | 'firstName' | 'lastName' | 'email' | 'role'): void;
	(e: 'update:sort-dir', dir: 'ascending' | 'descending' | null): void;
}>();

const ns = useNamespace('list-users');

const { isMDDevice } = useBreakpoints();

const innerFilters = ref<{ search: string; role: string }>({
	search: props.filters.search || '',
	role: props.filters.role || '',
});

const remoteFiltersReset = ref<boolean>(false);

const sortBy = ref<'username' | 'firstName' | 'lastName' | 'email' | 'role'>(props.sortBy);

const sortDir = ref<'ascending' | 'descending' | null>(props.sortDir);

const paginatePage = ref<number>(props.paginatePage);

const paginateSize = ref<number>(props.paginateSize);

const onEdit = (id: string): void => {
	emit('edit', id);
};

const onRemove = (id: string): void => {
	emit('remove', id);
};

const onResetFilters = (): void => {
	remoteFiltersReset.value = true;

	emit('reset-filters');
};

const onPaginatePageSize = (size: number): void => {
	emit('update:paginate-size', size);
};

const onPaginatePage = (page: number): void => {
	emit('update:paginate-page', page);
};

watch(
	(): { search: string; role: string } => innerFilters.value,
	(val: { search: string; role: string }): void => {
		emit('update:filters', { ...props.filters, ...val } as IListUsersFilterFields);
	}
);

watch(
	(): 'username' | 'firstName' | 'lastName' | 'email' | 'role' => sortBy.value,
	(val: 'username' | 'firstName' | 'lastName' | 'email' | 'role'): void => {
		emit('update:sort-by', val);
	}
);

watch(
	(): 'ascending' | 'descending' | null => sortDir.value,
	(val: 'ascending' | 'descending' | null): void => {
		emit('update:sort-dir', val);
	}
);

watch(
	(): IListUsersFilterFields => props.filters,
	(val: IListUsersFilterFields): void => {
		innerFilters.value = { search: val.search || '', role: val.role || '' };
	},
	{ deep: true }
);

watch(
	(): 'ascending' | 'descending' | null => props.sortDir,
	(val: 'ascending' | 'descending' | null): void => {
		sortDir.value = val;
	}
);

watch(
	(): 'username' | 'firstName' | 'lastName' | 'email' | 'role' => props.sortBy,
	(val: 'username' | 'firstName' | 'lastName' | 'email' | 'role'): void => {
		sortBy.value = val;
	}
);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'list-users.scss';
</style>
