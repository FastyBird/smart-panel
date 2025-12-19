<template>
	<el-card
		shadow="never"
		class="px-1 py-2 mt-2 shrink-0"
		body-class="p-0!"
	>
		<users-filter
			v-model:filters="innerFilters"
			:filters-active="props.filtersActive"
			@reset-filters="emit('reset-filters')"
		/>
	</el-card>

	<div
		ref="wrapper"
		class="flex-grow overflow-hidden"
	>
		<el-card
			shadow="never"
			class="mt-2 max-h-full"
			body-class="p-0! max-h-full overflow-hidden flex flex-col"
		>
			<users-table
				v-model:filters="innerFilters"
				v-model:sort-by="sortBy"
				v-model:sort-dir="sortDir"
				:items="props.items"
				:total-rows="props.totalRows"
				:loading="props.loading"
				:filters-active="props.filtersActive"
				:table-height="tableHeight"
				@edit="onEdit"
				@remove="onRemove"
				@reset-filters="onResetFilters"
			/>

			<div
				ref="paginator"
				class="flex justify-center w-full py-4"
			>
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
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { ElCard, ElPagination } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { useBreakpoints } from '../../../common';
import type { IUsersFilter } from '../composables/types';
import type { IUser } from '../store/users.store.types';

import { type IListUsersProps } from './list-users.types';
import UsersFilter from './users-filter.vue';
import UsersTable from './users-table.vue';

defineOptions({
	name: 'ListUsers',
});

const props = defineProps<IListUsersProps>();

const emit = defineEmits<{
	(e: 'edit', id: IUser['id']): void;
	(e: 'remove', id: IUser['id']): void;
	(e: 'reset-filters'): void;
	(e: 'update:filters', filters: IUsersFilter): void;
	(e: 'update:paginate-size', size: number): void;
	(e: 'update:paginate-page', page: number): void;
	(e: 'update:sort-by', dir: 'username' | 'firstName' | 'lastName' | 'email' | 'role'): void;
	(e: 'update:sort-dir', dir: 'ascending' | 'descending' | null): void;
}>();

const { isMDDevice } = useBreakpoints();

let observer: ResizeObserver | null = null;

const wrapper = ref<HTMLElement | null>(null);
const paginator = ref<HTMLElement | null>(null);

const innerFilters = useVModel(props, 'filters', emit);

const remoteFiltersReset = ref<boolean>(false);

const sortBy = ref<'username' | 'firstName' | 'lastName' | 'email' | 'role'>(props.sortBy);

const sortDir = ref<'ascending' | 'descending' | null>(props.sortDir);

const paginatePage = ref<number>(props.paginatePage);

const paginateSize = ref<number>(props.paginateSize);

const tableHeight = ref<number>(250);

const onEdit = (id: IUser['id']): void => {
	emit('edit', id);
};

const onRemove = (id: IUser['id']): void => {
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

onMounted((): void => {
	if (!wrapper.value) {
		return;
	}

	const updateHeight = () => {
		tableHeight.value = wrapper.value!.clientHeight - paginator.value!.clientHeight;
	};

	if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
		observer = new ResizeObserver(updateHeight);
		observer.observe(wrapper.value);
	}

	updateHeight();
});

onBeforeUnmount((): void => {
	if (observer && wrapper.value) {
		observer.unobserve(wrapper.value);
	}
});

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
