<template>
	<div class="flex flex-col items-center justify-center h-full w-full p-2 gap-1 overflow-hidden">
		<span
			class="display-icon-tile"
			:style="{ width: `${iconSize + 12}px`, height: `${iconSize + 12}px` }"
		>
			<icon
				:icon="sceneIcon"
				:width="iconSize"
				:height="iconSize"
				aria-hidden="true"
			/>
		</span>
		<span
			v-if="props.tile.rowSpan > 1 || props.tile.colSpan > 1"
			class="display-text-body truncate max-w-full text-center"
		>
			{{ sceneName }}
		</span>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';

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
