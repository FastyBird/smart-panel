<template>
	<div class="flex flex-row items-center justify-center h-full w-full p-2 gap-2 overflow-hidden">
		<icon
			icon="mdi:weather-sunny"
			:width="iconSize"
			:height="iconSize"
			class="display-icon-warning shrink-0"
			aria-hidden="true"
		/>
		<div class="flex flex-col min-w-0">
			<span
				class="display-text-value"
				:style="{ fontSize: props.tile.rowSpan >= 2 ? '28px' : '18px' }"
			>
				{{ t('tilesWeatherPlugin.preview.day.temperature') }}
			</span>
			<span class="display-text-caption truncate">
				{{ t('tilesWeatherPlugin.preview.day.condition') }}
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';

import type { ITilePreviewProps } from './tile-preview.types';

defineOptions({
	name: 'DayWeatherTilePreview',
});

const props = defineProps<ITilePreviewProps>();

const { t } = useI18n();

const iconSize = computed<number>((): number => {
	return props.tile.rowSpan >= 2 ? 36 : 24;
});
</script>
