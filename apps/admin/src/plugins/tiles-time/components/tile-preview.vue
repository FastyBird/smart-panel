<template>
	<div class="flex flex-col items-start justify-center h-full w-full p-2 overflow-hidden">
		<el-text
			class="font-mono font-bold leading-none"
			style="font-size: clamp(14px, 2.5vw, 28px)"
		>
			{{ currentTime }}
		</el-text>
		<el-text
			class="font-mono mt-1"
			type="info"
			size="small"
		>
			{{ currentDate }}
		</el-text>
	</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { ElText } from 'element-plus';

import type { ITilePreviewProps } from './tile-preview.types';

defineOptions({
	name: 'TimeTilePreview',
});

defineProps<ITilePreviewProps>();

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
