<template>
	<el-scrollbar view-class="h-full">
		<el-menu
			:collapse="props.collapsed"
			:default-active="activeIndex"
			:class="[ns.b(), ns.is('collapsed', props.collapsed), ns.is('desktop', isMDDevice), ns.is('phone', !isMDDevice), { 'h-full': isMDDevice }]"
			class="md:pt-5 xs:pt-4"
			router
		>
			<template v-for="(item, index) in mainMenuItems">
				<el-sub-menu
					v-if="Object.entries(item.children).length"
					:key="`${index}-children`"
					:index="item.name as string"
					:class="[ns.e('group'), ns.is('desktop', isMDDevice), ns.is('phone', !isMDDevice)]"
				>
					<template #title>
						<el-icon
							v-if="item.meta?.icon && typeof item.meta?.icon === 'string'"
							:size="18"
						>
							<icon :icon="item.meta.icon" />
						</el-icon>
						<span>{{ typeof item.meta?.title === 'function' ? item.meta?.title() : item.meta?.title }}</span>
					</template>

					<el-menu-item
						v-for="(subItem, subIndex) in item.children"
						:key="subIndex"
						:index="subItem.name as string"
						:route="{ name: subItem.name }"
						@click="emit('click')"
					>
						<el-icon
							v-if="subItem.meta?.icon && typeof subItem.meta?.icon === 'string'"
							:size="18"
						>
							<icon :icon="subItem.meta.icon" />
						</el-icon>
						<template #title>
							{{ typeof subItem.meta?.title === 'function' ? subItem.meta?.title() : subItem.meta?.title }}
						</template>
					</el-menu-item>
				</el-sub-menu>

				<el-menu-item
					v-else
					:key="`${index}-item`"
					:index="`main-${index}`"
					:route="{ name: item.name }"
					@click="emit('click')"
				>
					<el-icon
						v-if="item.meta?.icon && typeof item.meta?.icon === 'string'"
						:size="18"
					>
						<icon :icon="item.meta.icon" />
					</el-icon>
					<span>{{ typeof item.meta?.title === 'function' ? item.meta?.title() : item.meta?.title }}</span>
				</el-menu-item>
			</template>

			<el-menu-item-group
				v-if="!isMDDevice"
				:class="[ns.e('group'), ns.is('phone', !isMDDevice)]"
				class="mt-5"
			>
				<template
					v-if="!props.collapsed"
					#title
				>
					{{ t('application.menu.user') }}
				</template>

				<el-menu-item
					v-for="(item, index) in userMenuItems"
					:key="index"
					:index="item.route"
					:route="{ name: item.route }"
					@click="emit('click')"
				>
					<el-icon>
						<icon :icon="item.icon" />
					</el-icon>
					<template #title>
						{{ item.title }}
					</template>
				</el-menu-item>
			</el-menu-item-group>
		</el-menu>

		<el-menu
			v-if="!isMDDevice"
			:collapse="props.collapsed"
			:default-active="activeIndex"
			:class="[ns.b(), ns.is('collapsed', props.collapsed), ns.is('desktop', isMDDevice), ns.is('phone', !isMDDevice)]"
			class="md:pt-5 xs:pt-4"
		>
			<el-menu-item-group :class="[ns.e('group'), ns.is('phone', !isMDDevice)]">
				<el-menu-item
					index="3-1"
					data-test-id="navigation-sign-out"
					@click="onSignOut"
				>
					<el-icon>
						<icon icon="mdi:logout" />
					</el-icon>
					<template #title>
						{{ t('application.userMenu.signOut') }}
					</template>
				</el-menu-item>
			</el-menu-item-group>
		</el-menu>
	</el-scrollbar>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { ElIcon, ElMenu, ElMenuItem, ElMenuItemGroup, ElScrollbar, ElSubMenu, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';

import { RouteNames, sessionStoreKey } from '../../modules/auth-module';
import { useBreakpoints, useMenu } from '../composables';
import { injectStoresManager } from '../services';

import type { AppNavigationProps } from './app-navigation.types';

defineOptions({
	name: 'AppNavigation',
});

const props = withDefaults(defineProps<AppNavigationProps>(), {
	collapsed: false,
});

const emit = defineEmits<{
	(e: 'click'): void;
}>();

const router = useRouter();
const route = useRoute();

const { t } = useI18n();
const ns = useNamespace('app-navigation');

const { isMDDevice } = useBreakpoints();
const { mainMenuItems } = useMenu();

const storesManager = injectStoresManager();

const sessionStore = storesManager.getStore(sessionStoreKey);

const userMenuItems = [
	{
		title: t('application.userMenu.profileGeneralSettings'),
		icon: 'mdi:user-edit',
		route: RouteNames.PROFILE_GENERAL,
	},
	{
		title: t('application.userMenu.profileSecuritySettings'),
		icon: 'mdi:user-lock',
		route: RouteNames.PROFILE_SECURITY,
	},
];

const activeIndex = computed<string | undefined>((): string | undefined => {
	for (const name of Object.keys(mainMenuItems)) {
		if (route.matched.find((matched) => matched.name === name) !== undefined) {
			if (mainMenuItems[name].children) {
				for (const subName of Object.keys(mainMenuItems[name].children)) {
					if (route.matched.find((matched) => matched.name === subName) !== undefined) {
						return `child-${name}-${subName}`;
					}
				}
			}

			return `main-${name}`;
		}
	}

	return undefined;
});

const onSignOut = (): void => {
	sessionStore.clear();

	router.push({ name: RouteNames.SIGN_IN });
};
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'app-navigation.scss';
</style>
