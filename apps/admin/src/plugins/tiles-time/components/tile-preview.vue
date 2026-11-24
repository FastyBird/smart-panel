<template>
	<div class="flex flex-col items-start justify-center h-full w-full p-2 overflow-hidden">
		<span
			class="display-text-value"
			:style="{ fontSize: props.tile.rowSpan >= 2 ? '28px' : '18px' }"
		>
			{{ currentTime }}
		</span>
		<span class="display-text-caption mt-1">
			{{ currentDate }}
		</span>
	</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import type { ITilePreviewProps } from './tile-preview.types';

defineOptions({
	name: 'TimeTilePreview',
});

const props = defineProps<ITilePreviewProps>();

const currentTime = ref<string>('');
const currentDate = ref<string>('');
let timer: ReturnType<typeof setInterval> | undefined;

const updateTime = (): void => {
	const now = new Date();
	currentTime.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	currentDate.value = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

onMounted((): void => {
	updateTime();
	timer = setInterval(updateTime, 1000);
});

onBeforeUnmount((): void => {
	if (timer) {
		clearInterval(timer);
	}
});
</script>
