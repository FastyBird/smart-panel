<template>
	<div
		:class="ns.b()"
		class="flex flex-col h-full"
	>
		<div
			:class="ns.e('logo')"
			class="dark:bg-menu-background bg-brand-primary flex flex-row justify-center"
		>
			<router-link
				:to="{ name: RouteNames.ROOT }"
				class="flex flex-row justify-center items-center overflow-hidden"
			>
				<logo-bird class="fill-white dark:fill-brand-primary w-[55px]" />

				<logo-fasty-bird
					v-if="!props.menuCollapsed"
					class="fill-white dark:fill-brand-primary w-[125px] ml-2 mt-2"
				/>
			</router-link>
		</div>

		<app-navigation :collapsed="props.menuCollapsed" />
	</div>
</template>

<script setup lang="ts">
import { useNamespace } from 'element-plus';

import { RouteNames } from '../../app.constants';
// @ts-expect-error imported SVG files are without TS
import LogoBird from '../../assets/images/fb_bird.svg?component';
// @ts-expect-error imported SVG files are without TS
import LogoFastyBird from '../../assets/images/fb_smartpanel.svg?component';

import AppNavigation from './app-navigation.vue';
import type { AppSidebarProps } from './app-sidebar.types';

defineOptions({
	name: 'AppSidebar',
});

const props = withDefaults(defineProps<AppSidebarProps>(), {
	menuCollapsed: false,
});

const ns = useNamespace('app-sidebar');
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'app-sidebar.scss';
</style>
