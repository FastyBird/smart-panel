<template>
	<displays-empty
		v-if="props.items.length === 0"
		:loading="props.loading"
		:filters-active="props.filtersActive"
		@reset-filters="emit('reset-filters')"
	/>

	<ul
		v-else
		class="m-0 p-0 list-none"
		data-test-id="displays-row-list"
	>
		<!-- Phone (template 1): a list of rows instead of the table; a row opens the display. The state tag sits under
		     the name, so the row keeps its width for the actions -->
		<li
			v-for="display in props.items"
			:key="display.id"
			class="flex items-center gap-2 min-h-14 px-3 py-2 border-b border-b-solid border-light last:border-b-0"
		>
			<button
				class="flex items-center gap-3 flex-1 min-w-0 p-0 border-0 bg-transparent text-left font-inherit text-inherit cursor-pointer"
				type="button"
				data-test-id="displays-row"
				@click="emit('detail', display.id)"
			>
				<displays-table-column-icon :display="display" />
				<span class="flex flex-col items-start gap-0.5 flex-1 min-w-0">
					<span class="max-w-full text-card-title truncate">{{ display.name || display.macAddress }}</span>
					<span class="max-w-full text-help truncate">{{ display.screenWidth }}×{{ display.screenHeight }} · {{ display.version }}</span>
					<status-tag
						:status="DISPLAY_STATUS_TAG[displayStatus(display)]"
						:label="t(`displaysModule.states.${displayStatus(display)}`)"
					/>
				</span>
			</button>

			<displays-row-actions
				:display="display"
				@detail="(id: IDisplay['id']) => emit('detail', id)"
				@edit="(id: IDisplay['id']) => emit('edit', id)"
				@remove="(id: IDisplay['id']) => emit('remove', id)"
			/>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { StatusTag } from '../../../common';
import type { IDisplay } from '../store/displays.store.types';

import DisplaysEmpty from './displays-empty.vue';
import DisplaysRowActions from './displays-row-actions.vue';
import { DISPLAY_STATUS_TAG, displayStatus } from './displays-status';
import DisplaysTableColumnIcon from './displays-table-column-icon.vue';

defineOptions({
	name: 'DisplaysRowList',
});

const props = defineProps<{
	items: IDisplay[];
	loading: boolean;
	filtersActive: boolean;
}>();

const emit = defineEmits<{
	(e: 'detail', id: IDisplay['id']): void;
	(e: 'edit', id: IDisplay['id']): void;
	(e: 'remove', id: IDisplay['id']): void;
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();
</script>
