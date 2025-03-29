<template>
	<el-header
		:class="ns.b()"
		class="flex flex-row items-center justify-between px-2 h-[56px]"
	>
		<div class="flex flex-row items-center gap-5">
			<el-button
				type="primary"
				circle
				link
				@click="onToggleMenu"
			>
				<template #icon>
					<icon icon="mdi:hamburger-menu" />
				</template>
			</el-button>

			<div :id="BREADCRUMBS_TARGET" />
		</div>

		<div class="flex flex-row items-center gap-5">
			<div @click.stop="onSwitchTheme">
				<el-switch
					v-model="darkMode"
					:before-change="beforeThemeChange"
				>
					<template #active-action>
						<icon
							icon="mdi:moon-and-stars"
							class="dark-icon"
						/>
					</template>
					<template #inactive-action>
						<icon
							icon="mdi:weather-sunny"
							class="dark-icon"
						/>
					</template>
				</el-switch>
			</div>

			<el-dropdown trigger="click">
				<div class="flex items-center cursor-pointer">
					<user-avatar
						:size="32"
						:email="profile?.email"
						class="w-[32px] rounded-[50%]"
					/>

					<span class="text-14px pl-[5px]">{{ name }}</span>
				</div>

				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item :icon="h(Icon, { icon: 'mdi:lock' })">
							<div @click="onLock">
								{{ t('application.userMenu.lockScreen') }}
							</div>
						</el-dropdown-item>
						<el-dropdown-item
							:icon="h(Icon, { icon: 'mdi:logout' })"
							divided
						>
							<div @click="onSignOut">
								{{ t('application.userMenu.signOut') }}
							</div>
						</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>
		</div>
	</el-header>
</template>

<script setup lang="ts">
import { computed, h, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElHeader, ElSwitch, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';

import { RouteNames, sessionStoreKey } from '../../modules/auth';
import type { IUser } from '../../modules/users';
import { UserAvatar } from '../components';
import { useDarkMode } from '../composables';
import { injectStoresManager } from '../services';

import { type AppTopBarProps, BREADCRUMBS_TARGET } from './app-top-bar.types';

defineOptions({
	name: 'TopBar',
});

const props = withDefaults(defineProps<AppTopBarProps>(), {
	menuCollapsed: false,
});

const emit = defineEmits<{
	(e: 'update:menuCollapsed', menuCollapsed: boolean): void;
}>();

const router = useRouter();
const { t } = useI18n();
const ns = useNamespace('app-top-bar');

const { isDark, toggleDark } = useDarkMode();

const storesManager = injectStoresManager();

const sessionStore = storesManager.getStore(sessionStoreKey);

const profile = computed<IUser | null>((): IUser | null => {
	return sessionStore.profile;
});

const name = computed<string | null>((): string | null => {
	return sessionStore.profile?.firstName && sessionStore.profile?.lastName
		? `${sessionStore.profile?.firstName} ${sessionStore.profile?.lastName}`
		: sessionStore.profile?.username || 'user';
});

const darkMode = ref<boolean>(isDark.value);

let resolveFn: (value: boolean | PromiseLike<boolean>) => void;

const beforeThemeChange = (): Promise<boolean> => {
	return new Promise((resolve) => {
		resolveFn = resolve;
	});
};

const onSwitchTheme = (event: MouseEvent): void => {
	const isAppearanceTransition =
		// @ts-expect-error ts just fails here
		document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	if (!isAppearanceTransition || !event) {
		resolveFn(true);

		return;
	}

	const x = event.clientX;
	const y = event.clientY;
	const endRadius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

	const transition = document.startViewTransition(async () => {
		resolveFn(true);

		await nextTick();
	});

	transition.ready.then(() => {
		const clipPath = [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`];

		document.documentElement.animate(
			{
				clipPath: darkMode.value ? [...clipPath].reverse() : clipPath,
			},
			{
				duration: 500,
				easing: 'ease-in',
				pseudoElement: darkMode.value ? '::view-transition-old(root)' : '::view-transition-new(root)',
			}
		);
	});
};

const onToggleMenu = (): void => {
	emit('update:menuCollapsed', !props.menuCollapsed);
};

const onSignOut = (): void => {
	sessionStore.clear();

	router.push({ name: RouteNames.SIGN_IN });
};

const onLock = (): void => {
	// Handle lock
};

watch(
	(): boolean => darkMode.value,
	(): void => {
		toggleDark();
	}
);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'app-top-bar.scss';
</style>
