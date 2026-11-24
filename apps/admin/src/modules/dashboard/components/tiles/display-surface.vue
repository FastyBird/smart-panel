<template>
	<!-- Admin spec §7 `tilePreview`: inside, tiles are drawn in the wall display's tokens for that display's theme -->
	<div
		class="display-surface"
		:data-display-theme="props.dark ? 'dark' : 'light'"
		data-test-id="display-surface"
	>
		<slot />
	</div>
</template>

<script setup lang="ts">
import type { DisplaySurfaceProps } from './display-surface.types';

defineOptions({
	name: 'DisplaySurface',
});

const props = withDefaults(defineProps<DisplaySurfaceProps>(), {
	dark: false,
});
</script>

<style lang="scss">
@use '../../../../assets/styles/display.scss';
</style>
