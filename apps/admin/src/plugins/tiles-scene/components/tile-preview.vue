<template>
	<div class="flex flex-col items-center justify-center h-full w-full p-2 gap-1 overflow-hidden">
		<el-icon
			:size="iconSize"
			color="var(--el-color-primary)"
		>
			<icon :icon="sceneIcon" />
		</el-icon>
		<el-text
			v-if="props.tile.rowSpan > 1 || props.tile.colSpan > 1"
			size="small"
			class="truncate max-w-full text-center"
		>
			{{ sceneName }}
		</el-text>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';

import { ElIcon, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useScene, useSceneIcon } from '../../../modules/scenes';

import type { ITilePreviewProps } from './tile-preview.types';

defineOptions({
	name: 'SceneTilePreview',
});

const props = defineProps<ITilePreviewProps>();

const sceneId = computed<string | null>((): string | null => {
	return (props.tile as { scene?: string }).scene ?? null;
});

const { scene, fetchScene } = useScene({ id: sceneId.value ?? '' });
const { icon: categoryIcon } = useSceneIcon({ id: sceneId.value ?? '' });

const tileIcon = computed<string | null>((): string | null => {
	return (props.tile as { icon?: string | null }).icon ?? null;
});

const sceneIcon = computed<string>((): string => {
	return tileIcon.value ?? categoryIcon.value ?? 'mdi:movie-open-outline';
});

const sceneName = computed<string>((): string => {
	return scene.value?.name ?? 'Scene';
});

const iconSize = computed<number>((): number => {
	return props.tile.rowSpan >= 2 ? 32 : 22;
});

onBeforeMount((): void => {
	if (sceneId.value) {
		fetchScene().catch((): void => {
			// Silently fail - preview will show fallback
		});
	}
});
</script>
