<template>
	<div
		ref="root"
		class="camera-tile"
		role="button"
		tabindex="0"
		:aria-label="camera.name"
		data-test-id="camera-tile"
		@click.capture.stop="emit('open', camera.deviceId)"
		@keydown.enter.self.prevent="emit('open', camera.deviceId)"
	>
		<camera-player
			:key="camera.deviceId"
			:device-id="camera.deviceId"
			variant="tile"
			:snapshot-active="visible"
		/>

		<div class="camera-tile__caption">
			<strong class="camera-tile__name">{{ camera.name }}</strong>

			<span
				v-if="roomName"
				class="camera-tile__room"
				data-test-id="camera-tile-room"
			>
				{{ roomName }}
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import CameraPlayer from './camera-player.vue';
import type { ICameraTileProps } from './camera-tile.types';

defineOptions({
	name: 'CameraTile',
});

defineProps<ICameraTileProps>();

const emit = defineEmits<{
	(e: 'open', deviceId: string): void;
}>();

const root = ref<HTMLElement | null>(null);
// Assumed on screen until the observer says otherwise, so browsers without it keep refreshing.
const visible = ref(true);

let observer: IntersectionObserver | null = null;

onMounted(() => {
	if (root.value === null || typeof IntersectionObserver === 'undefined') {
		return;
	}

	observer = new IntersectionObserver((entries) => {
		const latest = entries[entries.length - 1];

		if (latest) {
			visible.value = latest.isIntersecting;
		}
	});

	observer.observe(root.value);
});

onBeforeUnmount(() => {
	observer?.disconnect();
	observer = null;
});
</script>

<style scoped>
.camera-tile {
	display: flex;
	flex-direction: column;
	gap: 6px;
	cursor: pointer;
	border-radius: var(--el-border-radius-base);
}

.camera-tile:focus-visible {
	outline: 2px solid var(--el-color-primary);
	outline-offset: 2px;
}

.camera-tile__caption {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.camera-tile__name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.camera-tile__room {
	font-size: var(--el-font-size-small);
	color: var(--el-text-color-secondary);
}
</style>
