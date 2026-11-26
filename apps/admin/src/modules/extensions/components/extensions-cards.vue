<template>
	<extensions-empty
		v-if="props.items.length === 0"
		:loading="props.loading"
		:filters-active="props.filtersActive"
		@reset-filters="emit('reset-filters')"
	/>

	<!-- Template 2: the catalogue grid adds columns on wide screens rather than growing its cards; one column on phone -->
	<ul
		v-else
		class="grid grid-cols-1 tp:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 m-0 p-0 list-none"
		data-test-id="extensions-cards"
	>
		<li
			v-for="extension in sortedItems"
			:key="extension.type"
			class="min-w-0"
		>
			<extension-card
				:extension="extension"
				@toggle-enabled="onToggleEnabled"
				@detail="onDetail"
			/>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { IExtension } from '../store/extensions.store.types';

import ExtensionCard from './extension-card.vue';
import type { IExtensionsCardsProps } from './extensions-cards.types';
import ExtensionsEmpty from './extensions-empty.vue';

defineOptions({
	name: 'ExtensionsCards',
});

const props = withDefaults(defineProps<IExtensionsCardsProps>(), {
	loading: false,
	filtersActive: false,
});

const emit = defineEmits<{
	(e: 'toggle-enabled', type: IExtension['type'], enabled: boolean): void;
	(e: 'detail', type: IExtension['type']): void;
	(e: 'reset-filters'): void;
}>();

const sortedItems = computed<IExtension[]>(() => {
	return [...props.items].sort((a, b) => {
		// Core extensions first
		if (a.isCore && !b.isCore) return -1;
		if (!a.isCore && b.isCore) return 1;

		// Then alphabetically by name
		return a.name.localeCompare(b.name);
	});
});

const onToggleEnabled = (type: IExtension['type'], enabled: boolean): void => {
	emit('toggle-enabled', type, enabled);
};

const onDetail = (type: IExtension['type']): void => {
	emit('detail', type);
};
</script>
