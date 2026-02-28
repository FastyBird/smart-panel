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
import { useI18n } from 'vue-i18n';

import { ElIcon, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useScene, useSceneIcon } from '../../../modules/scenes';

import type { ITilePreviewProps } from './tile-preview.types';

defineOptions({
	name: 'SceneTilePreview',
});

const props = defineProps<ITilePreviewProps>();

const { t } = useI18n();

const sceneId = (props.tile as { scene?: string }).scene ?? null;

const { scene, fetchScene } = useScene({ id: sceneId ?? '' });
const { icon: categoryIcon } = useSceneIcon({ id: sceneId ?? '' });

const tileIcon = computed<string | null>((): string | null => {
	return (props.tile as { icon?: string | null }).icon ?? null;
});

const sceneIcon = computed<string>((): string => {
	return tileIcon.value ?? categoryIcon.value ?? 'mdi:movie-open-outline';
});

const sceneName = computed<string>((): string => {
	return scene.value?.name ?? t('tilesScenePlugin.preview.defaultName');
});

const iconSize = computed<number>((): number => {
	return props.tile.rowSpan >= 2 ? 32 : 22;
});

onBeforeMount((): void => {
	if (sceneId) {
		fetchScene().catch((): void => {
			// Silently fail - preview will show fallback
		});
	}
});
</script>
