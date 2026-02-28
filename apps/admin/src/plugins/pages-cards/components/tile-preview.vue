<template>
	<div class="tile-preview b-1 b-solid rounded-2 grow-1 relative overflow-hidden">
		<component
			:is="previewComponent"
			v-if="previewComponent"
			:tile="props.tile"
		/>
		<div
			v-else
			class="flex flex-col items-center justify-center h-full w-full p-2"
		>
			<el-icon
				:size="20"
				color="var(--el-text-color-secondary)"
			>
				<icon icon="mdi:puzzle-outline" />
			</el-icon>
			<el-text
				type="info"
				size="small"
				class="mt-1 truncate max-w-full text-center"
			>
				{{ props.tile.type }}
			</el-text>
		</div>

		<div class="tile-preview__overlay">
			<el-button
				size="small"
				circle
				@click="emit('detail', props.tile.id)"
			>
				<template #icon>
					<icon icon="mdi:file-search-outline" />
				</template>
			</el-button>
			<el-button
				size="small"
				type="primary"
				circle
				class="ml-1!"
				@click="emit('edit', props.tile.id)"
			>
				<template #icon>
					<icon icon="mdi:pencil" />
				</template>
			</el-button>
			<el-button
				size="small"
				type="danger"
				circle
				class="ml-1!"
				@click="emit('remove', props.tile.id)"
			>
				<template #icon>
					<icon icon="mdi:trash-can-outline" />
				</template>
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { type Component, computed } from 'vue';

import { ElButton, ElIcon, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { type ITile, useTilesPlugins } from '../../../modules/dashboard';

import type { ITilesPreviewProps } from './tile-preview.types';

defineOptions({
	name: 'CardTilePreview',
});

const props = defineProps<ITilesPreviewProps>();

const emit = defineEmits<{
	(e: 'detail', id: ITile['id']): void;
	(e: 'edit', id: ITile['id']): void;
	(e: 'remove', id: ITile['id']): void;
}>();

const { getElement } = useTilesPlugins();

const previewComponent = computed<Component | undefined>((): Component | undefined => {
	const element = getElement(props.tile.type);

	return element?.components?.tilePreview as Component | undefined;
});
</script>

<style scoped lang="scss">
.tile-preview {
	border-color: var(--el-border-color-light);
	background-color: var(--el-bg-color);
	transition: border-color 0.2s;

	&:hover {
		border-color: var(--el-color-primary-light-5);
	}

	&__overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: rgb(0 0 0 / 50%);
		opacity: 0;
		transition: opacity 0.2s;
		pointer-events: none;
	}

	&:hover &__overlay {
		opacity: 1;
		pointer-events: auto;
	}
}
</style>
