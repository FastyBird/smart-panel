<template>
	<div
		:class="[ns.b(), ns.is('collapsed', props.menuCollapsed)]"
		class="flex flex-col h-full"
	>
		<div
			:class="ns.e('logo')"
			class="flex flex-row items-center shrink-0"
		>
			<router-link
				:to="{ name: RouteNames.ROOT }"
				:aria-label="t('application.buttons.home.title')"
				class="flex flex-row items-center gap-2 overflow-hidden"
				@click="emit('navigate')"
			>
				<logo-bird
					class="fill-white w-[40px] shrink-0"
					aria-hidden="true"
				/>

				<logo-fasty-bird
					v-if="!props.menuCollapsed"
					class="fill-white w-[120px] mt-1"
					aria-hidden="true"
				/>
			</router-link>
		</div>

		<app-navigation
			:collapsed="props.menuCollapsed"
			:account-actions="props.accountActions"
			class="flex-1 min-h-0"
			@click="emit('navigate')"
		/>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { useNamespace } from 'element-plus';

import { RouteNames } from '../../app.constants';
import LogoBird from '../../assets/images/fb_bird.svg?component';
import LogoFastyBird from '../../assets/images/fb_smartpanel.svg?component';

import AppNavigation from './app-navigation.vue';
import type { AppSidebarProps } from './app-sidebar.types';

defineOptions({
	name: 'AppSidebar',
});

const props = withDefaults(defineProps<AppSidebarProps>(), {
	menuCollapsed: false,
	accountActions: false,
});

const emit = defineEmits<{
	(e: 'navigate'): void;
}>();

const { t } = useI18n();

const ns = useNamespace('app-sidebar');
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'app-sidebar.scss';
</style>
