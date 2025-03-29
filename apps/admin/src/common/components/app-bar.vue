<template>
	<el-header :class="[ns.b()]">
		<div :class="[ns.e('buttons-small'), ns.is('expanded', hasSmallButtons)]">
			<div
				id="app-bar-button-small-left"
				ref="buttonSmallLeft"
			>
				<slot name="button-small-left" />
			</div>
			<div
				id="app-bar-button-small-right"
				ref="buttonSmallRight"
			>
				<slot name="button-small-right" />
			</div>
		</div>

		<div :class="[ns.e('header')]">
			<div
				id="app-bar-heading"
				:class="[ns.e('heading')]"
			>
				<slot name="heading">
					<slot name="logo" />
				</slot>
			</div>

			<div
				id="app-bar-button-back"
				:class="[ns.e('button-back')]"
			>
				<slot name="button-back" />
			</div>

			<div
				id="app-bar-button-left"
				:class="[ns.e('button-left')]"
			>
				<slot name="button-left" />
			</div>

			<div
				id="app-bar-button-right"
				:class="[ns.e('button-right')]"
			>
				<slot name="button-right">
					<el-button
						v-if="!props.menuButtonHidden"
						:icon="menuIcon"
						size="large"
						type="primary"
						circle
						@click.prevent="emit('toggleMenu', $event)"
					/>
				</slot>
			</div>
		</div>

		<div
			id="app-bar-content"
			ref="content"
			:class="[ns.e('content'), ns.is('expanded', hasContent)]"
		>
			<slot name="content" />
		</div>
	</el-header>
</template>

<script setup lang="ts">
import { type Component, computed, h, onMounted, onUnmounted, ref } from 'vue';

import { ElButton, ElHeader, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { AppBarProps } from './app-bar.types';

defineOptions({
	name: 'AppBar',
});

const props = withDefaults(defineProps<AppBarProps>(), {
	menuButtonHidden: false,
	menuCollapsed: true,
});

const emit = defineEmits<{
	(e: 'toggleMenu', event: UIEvent): void;
}>();

const ns = useNamespace('app-bar');

const menuIcon = computed<Component>((): Component => h(Icon, { icon: props.menuCollapsed ? 'mdi:menu' : 'mdi:close' }));

const newMutationObserver = (callback: () => void): MutationObserver | null => {
	// Skip this feature for browsers which
	// do not support ResizeObserver
	// https://caniuse.com/#search=mutationobserver
	if (typeof MutationObserver === 'undefined') {
		return null;
	}

	return new MutationObserver(callback);
};

const buttonSmallLeft = ref<HTMLElement | null>(null);
const buttonSmallRight = ref<HTMLElement | null>(null);
const content = ref<HTMLElement | null>(null);

const hasSmallButtons = ref<boolean>(false);
const hasContent = ref<boolean>(false);

let mutationObserver: MutationObserver | null = null;

const mutationObserverCallback = (): void => {
	hasSmallButtons.value =
		(buttonSmallLeft.value !== null && buttonSmallLeft.value?.children.length > 0) ||
		(buttonSmallRight.value !== null && buttonSmallRight.value?.children.length > 0);
	hasContent.value = content.value !== null && (content.value?.childElementCount > 0 || content.value.textContent !== '');
};

onMounted((): void => {
	hasSmallButtons.value =
		(buttonSmallLeft.value !== null && buttonSmallLeft.value?.children.length > 0) ||
		(buttonSmallRight.value !== null && buttonSmallRight.value?.children.length > 0);
	hasContent.value = content.value !== null && (content.value?.childElementCount > 0 || content.value.textContent !== '');

	mutationObserver = newMutationObserver(mutationObserverCallback);

	if (mutationObserver !== null && buttonSmallLeft.value !== null) {
		mutationObserver.observe(buttonSmallLeft.value as unknown as Node, { childList: true });
	}

	if (mutationObserver !== null && buttonSmallRight.value !== null) {
		mutationObserver.observe(buttonSmallRight.value as unknown as Node, { childList: true });
	}

	if (mutationObserver !== null && content.value !== null) {
		mutationObserver.observe(content.value as unknown as Node, { childList: true });
	}
});

onUnmounted((): void => {
	if (mutationObserver !== null) {
		mutationObserver.disconnect();
	}
});
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'app-bar.scss';
</style>
