<template>
	<!-- Admin spec §7 `tilePreview`: the host draws the cell (the grid sets its place, size and resize handles, the
	     editor its selection ring); the plugin draws what is inside the tile, in the display's tokens -->
	<div
		class="display-tile w-full h-full"
		:data-test-id="`tile-preview-${props.tile.id}`"
	>
		<component
			:is="previewComponent"
			v-if="previewComponent"
			:tile="props.tile"
		/>

		<div
			v-else
			class="flex flex-col items-center justify-center gap-1 h-full w-full p-2 box-border"
		>
			<icon
				icon="mdi:puzzle-outline"
				width="20"
				height="20"
				class="display-icon"
				aria-hidden="true"
			/>
			<span class="display-text-caption truncate max-w-full text-center">
				{{ element?.name ?? props.tile.type }}
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { type Component, computed } from 'vue';

import { Icon } from '@iconify/vue';

import { useTilesPlugins } from '../../../modules/dashboard';

import type { ITilesPreviewProps } from './tile-preview.types';

defineOptions({
	name: 'TilePreview',
});

const props = defineProps<ITilesPreviewProps>();

const { getElement } = useTilesPlugins();

const element = computed(() => getElement(props.tile.type));

const previewComponent = computed<Component | undefined>((): Component | undefined => {
	return element.value?.components?.tilePreview as Component | undefined;
});
</script>
