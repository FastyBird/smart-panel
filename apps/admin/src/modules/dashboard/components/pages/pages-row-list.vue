<template>
	<pages-empty
		v-if="props.items.length === 0"
		:loading="props.loading"
		:filters-active="props.filtersActive"
		@reset-filters="emit('reset-filters')"
	/>

	<ul
		v-else
		class="m-0 p-0 list-none"
		data-test-id="pages-row-list"
	>
		<!-- Phone (template 1): a list of rows instead of the table; a row opens the page -->
		<li
			v-for="page in props.items"
			:key="page.id"
			class="flex items-center gap-2 min-h-14 px-3 py-2 border-b border-b-solid border-light last:border-b-0"
		>
			<button
				class="flex items-center gap-3 flex-1 min-w-0 p-0 border-0 bg-transparent text-left font-inherit text-inherit cursor-pointer"
				type="button"
				data-test-id="pages-row"
				@click="emit('detail', page.id)"
			>
				<pages-table-column-icon :page="page" />
				<span class="flex flex-col items-start gap-0.5 flex-1 min-w-0">
					<span class="max-w-full text-card-title truncate">{{ page.title }}</span>
					<pages-table-column-plugin
						:page="page"
						class="max-w-full text-help!"
					/>
				</span>
			</button>

			<pages-row-actions
				:page="page"
				@configure="(to: string | RouteLocationRaw) => emit('configure', to)"
				@detail="(id: IPage['id']) => emit('detail', id)"
				@edit="(id: IPage['id']) => emit('edit', id)"
				@remove="(id: IPage['id']) => emit('remove', id)"
			/>
		</li>
	</ul>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';

import type { IPage } from '../../store/pages.store.types';

import PagesEmpty from './pages-empty.vue';
import PagesRowActions from './pages-row-actions.vue';
import PagesTableColumnIcon from './pages-table-column-icon.vue';
import PagesTableColumnPlugin from './pages-table-column-plugin.vue';

defineOptions({
	name: 'PagesRowList',
});

const props = defineProps<{
	items: IPage[];
	loading: boolean;
	filtersActive: boolean;
}>();

const emit = defineEmits<{
	(e: 'configure', to: string | RouteLocationRaw): void;
	(e: 'detail', id: IPage['id']): void;
	(e: 'edit', id: IPage['id']): void;
	(e: 'remove', id: IPage['id']): void;
	(e: 'reset-filters'): void;
}>();
</script>
