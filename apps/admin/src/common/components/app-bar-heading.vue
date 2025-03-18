<template>
	<template v-if="props.teleport">
		<teleport
			v-if="mounted"
			:to="`#${teleportTarget}`"
		>
			<div
				v-if="'prepend' in $slots || 'icon' in $slots || props.icon"
				:class="[ns.e('prepend')]"
				class="mr-2"
			>
				<slot name="prepend">
					<el-icon
						v-if="'icon' in $slots || props.icon"
						:class="[ns.e('icon')]"
					>
						<slot name="icon">
							<component
								:is="props.icon"
								v-if="props.icon"
							/>
						</slot>
					</el-icon>
				</slot>
			</div>

			<h1 :class="[ns.e('title'), ns.em('title', `align-${props.align}`)]">
				<el-text truncated>
					<slot name="title" />
				</el-text>
				<el-text
					v-if="'subtitle' in $slots"
					truncated
				>
					<slot name="subtitle" />
				</el-text>
			</h1>

			<div
				v-if="'append' in $slots"
				:class="[ns.e('append')]"
			>
				<slot name="append" />
			</div>
		</teleport>
	</template>
	<template v-else>
		<div
			v-if="'prepend' in $slots || 'icon' in $slots || props.icon"
			:class="[ns.e('prepend')]"
			class="mr-2"
		>
			<slot name="prepend">
				<el-icon
					v-if="'icon' in $slots || props.icon"
					:class="[ns.e('icon')]"
				>
					<slot name="icon">
						<component
							:is="props.icon"
							v-if="props.icon"
						/>
					</slot>
				</el-icon>
			</slot>
		</div>

		<h1 :class="[ns.e('title'), ns.em('title', `align-${props.align}`)]">
			<template v-if="'subtitle' in $slots">
				<span><slot name="title" /></span>
				<small><slot name="subtitle" /></small>
			</template>
			<template v-else>
				<slot name="title" />
			</template>
		</h1>

		<div
			v-if="'append' in $slots"
			:class="[ns.e('append')]"
		>
			<slot name="append" />
		</div>
	</template>
</template>

<script setup lang="ts">
import { getCurrentInstance, onBeforeUnmount, onMounted, ref } from 'vue';

import { ElIcon, ElText, useNamespace } from 'element-plus';

import { AppBarHeadingAlign, type AppBarHeadingProps } from './app-bar-heading.types';

defineOptions({
	name: 'AppBarHeading',
});

const props = withDefaults(defineProps<AppBarHeadingProps>(), {
	align: AppBarHeadingAlign.LEFT,
	teleport: false,
});

const ns = useNamespace('app-bar-heading');

const mounted = ref<boolean>(false);

const teleportTarget = 'app-bar-heading';

const instance = getCurrentInstance();

onMounted((): void => {
	if (props.teleport) {
		const target: HTMLElement | null = document.getElementById(teleportTarget);

		if (target !== null) {
			target.childNodes.forEach((node) => {
				if (node instanceof HTMLElement && node.style.display !== 'none') {
					node.style.display = 'none';
					node.dataset.componentKey = String(instance?.uid);
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
				if (node instanceof HTMLElement && node.style.display === 'none' && node.dataset.componentKey === String(instance?.uid)) {
					node.style.display = '';
				}
			});
		}
	}
});
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'app-bar-heading.scss';
</style>
