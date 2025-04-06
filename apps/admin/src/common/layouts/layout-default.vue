<template>
	<el-container
		v-if="!isMDDevice"
		direction="vertical"
		:class="[ns.b()]"
		class="h-full min-h-full max-h-full w-full min-w-full max-w-full"
	>
		<app-bar @toggle-menu="onToggleMenu">
			<template #logo>
				<router-link :to="{ name: RouteNames.ROOT }">
					<logo class="fill-white h-[30px]" />
				</router-link>
			</template>
		</app-bar>

		<el-main class="flex-1">
			<router-view />
		</el-main>

		<el-drawer
			v-model="menuState"
			:size="'80%'"
			:class="[ns.e('mobile-menu')]"
		>
			<app-navigation
				:collapsed="mobileMenuCollapsed"
				@click="onToggleMenu"
			/>
		</el-drawer>
	</el-container>

	<el-container
		v-else
		direction="horizontal"
		:class="[ns.b()]"
		class="h-full min-h-full max-h-full w-full min-w-full max-w-full"
	>
		<el-aside
			:class="[ns.e('aside'), { [ns.em('aside', 'collapsed')]: mainMenuCollapsed }]"
			class="bg-menu-background"
		>
			<app-sidebar :menu-collapsed="mainMenuCollapsed" />
		</el-aside>

		<el-container
			direction="vertical"
			class="flex-1 overflow-hidden"
		>
			<app-top-bar v-model:menu-collapsed="mainMenuCollapsed" />

			<el-main class="flex-1">
				<div class="flex flex-col overflow-hidden h-full">
					<router-view />
				</div>
			</el-main>
		</el-container>
	</el-container>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

import { ElAside, ElContainer, ElDrawer, ElMain, useNamespace } from 'element-plus';

import { RouteNames } from '../../app.constants';
// @ts-expect-error imported SVG files are without TS
import Logo from '../../assets/images/fb_row.svg?component';
import { AppBar, AppNavigation, AppSidebar, AppTopBar } from '../components/components';
import { useBreakpoints } from '../composables/useBreakpoints';

defineOptions({
	name: 'LayoutDefault',
});

const ns = useNamespace('app-layout-default');
const { isMDDevice, isXLDevice } = useBreakpoints();

const menuState = ref<boolean>(false);
const mobileMenuCollapsed = ref<boolean>(isXLDevice.value);
const mainMenuCollapsed = ref<boolean>(!isXLDevice.value);

const onToggleMenu = (): void => {
	menuState.value = !menuState.value;
};

watch(
	(): boolean => isXLDevice.value,
	(val: boolean): void => {
		mainMenuCollapsed.value = !val;
	}
);
</script>

<style rel="stylesheet/scss" lang="scss">
@use 'layout-default.scss';
</style>
