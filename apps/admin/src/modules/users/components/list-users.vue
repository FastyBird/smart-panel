<template>
	<!-- Template 1: one card with the filter bar, the table (a row list on phone) and the pagination -->
	<el-card
		shadow="never"
		class="flex flex-col flex-grow min-h-0 overflow-hidden"
		body-class="p-0! flex flex-col flex-grow min-h-0 overflow-hidden"
	>
		<list-filter-bar
			ref="filterBar"
			v-model:search="search"
			:search-placeholder="t('usersModule.fields.search.placeholder')"
			:active-count="activeCount"
			:selected-count="isPhone ? 0 : selectedItems.length"
			@reset="emit('reset-filters')"
			@clear-selection="onClearSelection"
		>
			<template #filters>
				<list-users-adjust v-model:filters="innerFilters" />
			</template>

			<template #bulk>
				<el-button
					type="danger"
					plain
					size="small"
					data-test-id="bulk-delete"
					@click="emit('bulk-action', 'delete', selectedItems)"
				>
					{{ t('application.bulkActions.delete') }}
				</el-button>
			</template>
		</list-filter-bar>

		<!-- The rows scroll inside the card, so the pagination below stays reachable -->
		<div
			v-if="isPhone"
			class="flex-grow min-h-0 overflow-y-auto"
			data-test-id="users-row-list-scroll"
		>
			<users-row-list
				:items="props.items"
				:loading="props.loading"
				:filters-active="props.filtersActive"
				:current-user-id="props.currentUserId"
				@edit="(id: IUser['id']) => emit('edit', id)"
				@remove="(id: IUser['id']) => emit('remove', id)"
				@reset-filters="emit('reset-filters')"
			/>
		</div>

		<div
			v-else
			ref="wrapper"
			class="flex-grow min-h-0 overflow-hidden"
		>
			<users-table
				ref="table"
				v-model:filters="innerFilters"
				v-model:sort-by="sortBy"
				v-model:sort-dir="sortDir"
				:items="props.items"
				:total-rows="props.totalRows"
				:loading="props.loading"
				:filters-active="props.filtersActive"
				:table-height="tableHeight"
				:current-user-id="props.currentUserId"
				@edit="(id: IUser['id']) => emit('edit', id)"
				@remove="(id: IUser['id']) => emit('remove', id)"
				@reset-filters="emit('reset-filters')"
				@selected-changes="(selected: IUser[]) => (selectedItems = selected)"
			/>
		</div>

		<div class="flex flex-wrap justify-end w-full box-border px-4 py-2.5 border-t border-t-solid border-light overflow-hidden">
			<el-pagination
				v-model:current-page="paginatePage"
				v-model:page-size="paginateSize"
				:layout="isPhone ? 'prev, pager, next' : 'total, sizes, prev, pager, next'"
				:total="props.allItems.length"
				@size-change="(size: number) => emit('update:paginate-size', size)"
				@current-change="(page: number) => emit('update:paginate-page', page)"
			/>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElPagination } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { ListFilterBar, useSizeClass } from '../../../common';
import type { IUsersFilter } from '../composables/types';
import type { IUser } from '../store/users.store.types';

import ListUsersAdjust from './list-users-adjust.vue';
import type { IListUsersProps } from './list-users.types';
import UsersRowList from './users-row-list.vue';
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
	(e: 'update:sort-by', by: 'username' | 'firstName' | 'lastName' | 'email' | 'role'): void;
	(e: 'update:sort-dir', dir: 'ascending' | 'descending' | null): void;
	(e: 'bulk-action', action: string, items: IUser[]): void;
}>();

const { t } = useI18n();
const { isPhone } = useSizeClass();

const innerFilters = useVModel(props, 'filters', emit);

const filterBar = ref<InstanceType<typeof ListFilterBar> | null>(null);
const table = ref<InstanceType<typeof UsersTable> | null>(null);
const wrapper = ref<HTMLElement | null>(null);

const selectedItems = ref<IUser[]>([]);

const sortBy = ref<'username' | 'firstName' | 'lastName' | 'email' | 'role'>(props.sortBy);
const sortDir = ref<'ascending' | 'descending' | null>(props.sortDir);
const paginatePage = ref<number>(props.paginatePage);
const paginateSize = ref<number>(props.paginateSize);

const tableHeight = ref<number>(250);

const search = computed<string>({
	get: (): string => innerFilters.value.search ?? '',
	set: (value: string): void => {
		innerFilters.value.search = value === '' ? undefined : value;
	},
});

// Active filters, the search excluded: it is visible in the bar on its own
const activeCount = computed<number>((): number => (innerFilters.value.roles.length > 0 ? 1 : 0));

const onClearSelection = (): void => {
	table.value?.clearSelection();
	selectedItems.value = [];
};

// The phone app bar's Search action moves focus to the search field
const focusSearch = (): void => {
	filterBar.value?.focusSearch();
};

defineExpose({ focusSearch });

// The table, and its checked rows, go away on phone; a selection kept here would act on rows nobody can see
watch(isPhone, (phone: boolean): void => {
	if (phone) {
		selectedItems.value = [];
	}
});

let observer: ResizeObserver | null = null;

const updateHeight = (): void => {
	if (wrapper.value) {
		tableHeight.value = wrapper.value.clientHeight;
	}
};

// The table is not rendered on phone, so the wrapper comes and goes with the size class
watch(
	wrapper,
	(element: HTMLElement | null, previous: HTMLElement | null | undefined): void => {
		if (observer && previous) {
			observer.unobserve(previous);
		}

		if (!element) {
			return;
		}

		if (observer === null && typeof window !== 'undefined' && 'ResizeObserver' in window) {
			observer = new ResizeObserver(updateHeight);
		}

		observer?.observe(element);

		updateHeight();
	},
	{ flush: 'post' }
);

onBeforeUnmount((): void => {
	observer?.disconnect();
	observer = null;
});

watch(sortBy, (val): void => emit('update:sort-by', val));
watch(sortDir, (val): void => emit('update:sort-dir', val));
watch(
	(): 'username' | 'firstName' | 'lastName' | 'email' | 'role' => props.sortBy,
	(val): void => {
		sortBy.value = val;
	}
);
watch(
	(): 'ascending' | 'descending' | null => props.sortDir,
	(val): void => {
		sortDir.value = val;
	}
);
watch(
	(): number => props.paginatePage,
	(val: number): void => {
		paginatePage.value = val;
	}
);
watch(
	(): number => props.paginateSize,
	(val: number): void => {
		paginateSize.value = val;
	}
);
</script>
