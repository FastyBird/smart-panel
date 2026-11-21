<template>
	<metainfo>
		<template #title="{ content }">
			{{ content ? `${content} | FastyBird SmartPanel` : 'FastyBird SmartPanel' }}
		</template>
	</metainfo>

	<!-- Touch screens get the large control size everywhere (docs/admin-ui-design-spec.md, section 6) -->
	<el-config-provider :size="isTouch ? 'large' : 'default'">
		<router-view v-loading="loadingOverlay" />
	</el-config-provider>
</template>

<script setup lang="ts">
import { onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { useMeta } from 'vue-meta';

import { ElConfigProvider, vLoading } from 'element-plus';

import { description } from './../package.json';
import { useEventBus } from './common';
import { useDarkMode } from './common/composables/useDarkMode';
import { useSizeClass } from './common/composables/useSizeClass';

defineOptions({
	name: 'AppMain',
});

const eventBus = useEventBus();

const { isTouch } = useSizeClass();

// Applies the saved theme on every screen size: only the top bar (tablet and up) offered the switch, so a phone used
// to stay light until the window grew
useDarkMode();

const loadingOverlay = ref<boolean>(false);

let overlayTimer: number | undefined;

const hideOverlay = (): void => {
	loadingOverlay.value = false;

	window.clearTimeout(overlayTimer);

	overlayTimer = undefined;
};

const overlayLoadingListener = (status?: unknown): void => {
	if (typeof status === 'number') {
		window.clearTimeout(overlayTimer);

		overlayTimer = window.setTimeout(hideOverlay, status * 1000);

		loadingOverlay.value = true;
	} else if (typeof status === 'boolean') {
		window.clearTimeout(overlayTimer);

		overlayTimer = undefined;

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

	window.clearTimeout(overlayTimer);
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
