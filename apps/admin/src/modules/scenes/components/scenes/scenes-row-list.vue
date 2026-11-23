<template>
	<scenes-empty
		v-if="props.items.length === 0"
		:loading="props.loading"
		:filters-active="props.filtersActive"
		@reset-filters="emit('reset-filters')"
	/>

	<ul
		v-else
		class="m-0 p-0 list-none"
		data-test-id="scenes-row-list"
	>
		<!-- Phone (template 1): a list of rows instead of the table; a row opens the scene. The state tag sits under the
		     name, so the row keeps its width for the actions -->
		<li
			v-for="scene in props.items"
			:key="scene.id"
			class="flex items-center gap-2 min-h-14 px-3 py-2 border-b border-b-solid border-light last:border-b-0"
		>
			<button
				:disabled="!scene.editable"
				class="flex items-center gap-3 flex-1 min-w-0 p-0 border-0 bg-transparent text-left font-inherit text-inherit cursor-pointer disabled:cursor-default"
				type="button"
				data-test-id="scenes-row"
				@click="emit('edit', scene.id)"
			>
				<scenes-table-column-icon :scene="scene" />
				<span class="flex flex-col items-start gap-0.5 flex-1 min-w-0">
					<span class="max-w-full text-card-title truncate">{{ scene.name }}</span>
					<span class="max-w-full text-help truncate">{{ props.spaceName(scene.primarySpaceId) }}</span>
					<status-tag
						v-if="!scene.enabled"
						status="warn"
						:label="t('scenes.filters.enabled.values.disabled')"
					/>
				</span>
			</button>

			<scenes-row-actions
				:scene="scene"
				:triggering="props.triggering.includes(scene.id)"
				@trigger="(id: IScene['id']) => emit('trigger', id)"
				@edit="(id: IScene['id']) => emit('edit', id)"
				@remove="(id: IScene['id']) => emit('remove', id)"
			/>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { StatusTag } from '../../../../common';
import type { IScene } from '../../store/scenes.store.types';

import ScenesEmpty from './scenes-empty.vue';
import ScenesRowActions from './scenes-row-actions.vue';
import ScenesTableColumnIcon from './scenes-table-column-icon.vue';

defineOptions({
	name: 'ScenesRowList',
});

const props = defineProps<{
	items: IScene[];
	loading: boolean;
	filtersActive: boolean;
	triggering: IScene['id'][];
	spaceName: (primarySpaceId: string | null | undefined) => string;
}>();

const emit = defineEmits<{
	(e: 'trigger', id: IScene['id']): void;
	(e: 'edit', id: IScene['id']): void;
	(e: 'remove', id: IScene['id']): void;
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();
</script>
