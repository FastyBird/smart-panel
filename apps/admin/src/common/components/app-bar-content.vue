<template>
	<template v-if="props.teleport">
		<teleport
			v-if="mounted"
			:to="`#${teleportTarget}`"
		>
			<slot />
		</teleport>
	</template>
	<template v-else>
		<slot />
	</template>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import type { AppBarContentProps } from './app-bar-content.types';

defineOptions({
	name: 'AppBarContent',
});

const props = withDefaults(defineProps<AppBarContentProps>(), {
	teleport: false,
});

const mounted = ref<boolean>(false);

const teleportTarget = 'fb-app-bar-content';

onMounted((): void => {
	if (props.teleport) {
		const target: HTMLElement | null = document.getElementById(teleportTarget);

		if (target !== null) {
			target.childNodes.forEach((node) => {
				if (node instanceof HTMLElement) {
					node.style.display = 'none';
				}
			});
		}
	}

	mounted.value = true;
});

onBeforeUnmount((): void => {
	if (props.teleport) {
		const target: HTMLElement | null = document.getElementById(teleportTarget);

		if (target !== null) {
			target.childNodes.forEach((node) => {
				if (node instanceof HTMLElement && node.style.display === 'none') {
					node.style.display = '';
				}
			});
		}
	}
});
</script>
