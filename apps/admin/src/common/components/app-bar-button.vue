<template>
	<template v-if="props.teleport">
		<teleport
			v-if="mounted && props.align !== AppBarButtonAlign.NONE"
			:to="`#${teleportTarget}`"
		>
			<el-button
				v-bind="props"
				:size="props.small ? 'small' : 'large'"
				:disabled="props.disabled"
				:circle="'icon' in $slots"
				:class="[ns.b(), ns.m(`align-${props.align}`), ...(props.classes ?? [])]"
				class="ml-0!"
				type="primary"
				@click="emit('click', $event)"
			>
				<template v-if="'icon' in $slots">
					<slot name="icon" />
				</template>

				<slot />
			</el-button>
		</teleport>
	</template>
	<template v-else>
		<el-button
			v-bind="props"
			:size="props.small ? 'small' : 'large'"
			:disabled="props.disabled"
			:circle="'icon' in $slots"
			:class="[ns.b(), ns.m(`align-${props.align}`), ...(props.classes ?? [])]"
			class="ml-0!"
			type="primary"
			@click="emit('click', $event)"
		>
			<template v-if="'icon' in $slots">
				<slot name="icon" />
			</template>

			<slot />
		</el-button>
	</template>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { ElButton, useNamespace } from 'element-plus';
import { buttonEmits } from 'element-plus';

import { AppBarButtonAlign, type AppBarButtonProps } from './app-bar-button.types';

defineOptions({
	name: 'AppBarButton',
});

const props = withDefaults(defineProps<AppBarButtonProps>(), {
	align: AppBarButtonAlign.NONE,
	small: false,
	teleport: false,
	disabled: false,
});

const emit = defineEmits(buttonEmits);

const ns = useNamespace('app-bar-button');

const mounted = ref<boolean>(false);

let teleportTarget = 'app-bar-button';

if (props.small) {
	teleportTarget = `${teleportTarget}-small-${props.align}`;
} else {
	teleportTarget = `${teleportTarget}-${props.align}`;
}

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

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'app-bar-button.scss';
</style>
