<template>
	<!-- Phone (template 1): a list of rows instead of the table; a row opens the space -->
	<spaces-empty
		v-if="props.items.length === 0"
		:loading="props.loading"
		:filters-active="props.filtersActive"
		@reset-filters="emit('reset-filters')"
	/>

	<ul
		v-else
		class="m-0 p-0 list-none"
		data-test-id="spaces-row-list"
	>
		<li
			v-for="space in props.items"
			:key="space.id"
			class="flex items-center gap-2 min-h-14 px-3 py-2 border-b border-b-solid border-light last:border-b-0"
		>
			<button
				class="flex items-center gap-3 flex-1 min-w-0 p-0 border-0 bg-transparent text-left font-inherit text-inherit cursor-pointer"
				type="button"
				data-test-id="spaces-row"
				@click="emit('edit', space.id)"
			>
				<span
					class="flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-fill-light text-regular"
					aria-hidden="true"
				>
					<icon
						:icon="space.icon || (space.type === SpaceType.ROOM ? 'mdi:door' : 'mdi:home-floor-1')"
						width="20"
						height="20"
					/>
				</span>
				<span class="flex flex-col flex-1 min-w-0">
					<span class="text-card-title truncate">{{ space.name }}</span>
					<spaces-table-column-plugin
						:space="space"
						class="text-help!"
					/>
				</span>
			</button>

			<spaces-table-column-actions
				:space="space"
				@edit="(id: ISpace['id']) => emit('edit', id)"
				@remove="(id: ISpace['id']) => emit('remove', id)"
			/>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';

import { SpaceType } from '../spaces.constants';
import type { ISpace } from '../store/spaces.store.types';

import SpacesEmpty from './spaces-empty.vue';
import SpacesTableColumnActions from './spaces-table-column-actions.vue';
import SpacesTableColumnPlugin from './spaces-table-column-plugin.vue';

defineOptions({
	name: 'SpacesRowList',
});

const props = defineProps<{ items: ISpace[]; loading: boolean; filtersActive: boolean }>();

const emit = defineEmits<{
	(e: 'edit', id: ISpace['id']): void;
	(e: 'remove', id: ISpace['id']): void;
	(e: 'reset-filters'): void;
}>();
</script>
