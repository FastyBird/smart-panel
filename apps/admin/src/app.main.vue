<template>
	<metainfo>
		<template #title="{ content }">
			{{ content ? `${content} | FastyBird SmartPanel` : 'FastyBird SmartPanel' }}
		</template>
	</metainfo>

	<router-view v-loading="loadingOverlay" />
</template>

<script setup lang="ts">
import { onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { useMeta } from 'vue-meta';

import { vLoading } from 'element-plus';

import { description } from './../package.json';
import { useEventBus } from './common';

defineOptions({
	name: 'AppMain',
});

const eventBus = useEventBus();

const loadingOverlay = ref<boolean>(false);

let overlayTimer: number;

const hideOverlay = (): void => {
	loadingOverlay.value = false;

	window.clearInterval(overlayTimer);
};

const overlayLoadingListener = (status?: unknown): void => {
	if (typeof status === 'number') {
		overlayTimer = window.setInterval(hideOverlay, status * 1000);
		loadingOverlay.value = true;
	} else if (typeof status === 'boolean') {
		window.clearInterval(overlayTimer);

		loadingOverlay.value = status;
	} else {
		loadingOverlay.value = !loadingOverlay.value;
	}
};

onBeforeMount((): void => {
	eventBus.register('loadingOverlay', overlayLoadingListener);
});

onBeforeUnmount((): void => {
	eventBus.unregister('loadingOverlay', overlayLoadingListener);
});

useMeta({
	title: 'SmartPanel',
	meta: [
		{ charset: 'utf-8' },
		{
			name: 'viewport',
			content: 'width=device-width,initial-scale=1.0',
		},
		{
			hid: 'description',
			name: 'description',
			content: description ?? '',
		},
	],
	link: [
		{
			rel: 'icon',
			type: 'image/x-icon',
			href: '/favicon.ico',
		},
	],
	htmlAttrs: {
		lang: 'en',
	},
});
</script>
