<template>
	<el-scrollbar
		class="h-full"
	>
		<el-skeleton
			v-if="loading && items.length === 0"
			:rows="5"
			animated
		/>

		<el-empty
			v-else-if="items.length === 0"
			:description="emptyMessage"
		/>

		<div
			v-else
			class="extensions-grid"
		>
			<extension-card
				v-for="extension in sortedItems"
				:key="extension.type"
				:extension="extension"
				@toggle-enabled="onToggleEnabled"
				@detail="onDetail"
			/>
		</div>
	</el-scrollbar>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElEmpty, ElScrollbar, ElSkeleton } from 'element-plus';

import type { IExtension } from '../store/extensions.store.types';

import ExtensionCard from './extension-card.vue';
import type { IExtensionsCardsProps } from './extensions-cards.types';

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

const { t } = useI18n();

const sortedItems = computed<IExtension[]>(() => {
	return [...props.items].sort((a, b) => {
		// Core extensions first
		if (a.isCore && !b.isCore) return -1;
		if (!a.isCore && b.isCore) return 1;

		// Then alphabetically by name
		return a.name.localeCompare(b.name);
	});
});

const emptyMessage = computed<string>(() => {
	return props.filtersActive
		? t('extensionsModule.messages.noMatchingExtensions')
		: t('extensionsModule.messages.noExtensions');
});

const onToggleEnabled = (type: IExtension['type'], enabled: boolean): void => {
	emit('toggle-enabled', type, enabled);
};

const onDetail = (type: IExtension['type']): void => {
	emit('detail', type);
};
</script>

<style scoped>
.extensions-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
	gap: 1rem;
}

@media (max-width: 640px) {
	.extensions-grid {
		grid-template-columns: 1fr;
	}
}
</style>
