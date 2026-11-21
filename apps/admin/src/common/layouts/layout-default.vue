<template>
	<div class="h-full min-h-full max-h-full w-full min-w-full max-w-full">
		<el-container
			v-if="isPhone"
			direction="vertical"
			:class="[ns.b()]"
			class="h-full min-h-full max-h-full w-full min-w-full max-w-full"
		>
			<!-- The screen's view-header fills this bar (title, back or close, actions); before one mounts it shows the logo -->
			<app-bar
				:title="phoneHeading?.title"
				:subtitle="phoneHeading?.subtitle"
				:left="phoneHeading?.left ?? 'menu'"
				:actions="phoneHeading?.actions"
				:primary="phoneHeading?.primary"
				@left="onPhoneLeft"
			>
				<template
					v-if="phoneHeading === null"
					#title
				>
					<router-link
						:to="{ name: RouteNames.ROOT }"
						:aria-label="t('application.buttons.home.title')"
						class="flex items-center"
					>
						<logo class="fill-white h-[30px]" />
					</router-link>
				</template>

				<template
					v-if="(phoneHeading?.left ?? 'menu') === 'menu'"
					#end
				>
					<notification-bell />
				</template>
			</app-bar>

			<el-main class="flex-1">
				<router-view />
			</el-main>
		</el-container>

		<el-container
			v-else
			direction="horizontal"
			:class="[ns.b()]"
			class="h-full min-h-full max-h-full w-full min-w-full max-w-full"
		>
			<el-aside
				v-if="!isTabletPortrait"
				:class="[ns.e('aside'), { [ns.em('aside', 'collapsed')]: railOnly }]"
				data-test-id="layout-aside"
			>
				<app-sidebar :menu-collapsed="railOnly" />
			</el-aside>

			<el-container
				direction="vertical"
				class="flex-1 overflow-hidden"
			>
				<app-top-bar
					v-model:menu-collapsed="mainMenuCollapsed"
					:menu-button="menuButton"
					@open-menu="onOpenMenu"
				/>

				<el-main class="flex-1">
					<div class="flex flex-col overflow-hidden h-full">
						<router-view />
					</div>
				</el-main>
			</el-container>
		</el-container>

		<!-- One modal menu drawer for phone, tablet portrait ("Open menu") and tablet landscape ("Expand menu") -->
		<el-drawer
			v-model="menuState"
			:with-header="false"
			:title="t('application.navigation.label')"
			:class="[ns.e('menu-drawer')]"
			direction="ltr"
			size="280px"
			append-to-body
			data-test-id="layout-menu-drawer"
		>
			<app-sidebar
				:account-actions="isPhone"
				@navigate="onCloseMenu"
			/>
		</el-drawer>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAside, ElContainer, ElDrawer, ElMain, useNamespace } from 'element-plus';

import { RouteNames } from '../../app.constants';
import Logo from '../../assets/images/fb_row.svg?component';
// See the identical import in `app-top-bar.vue` for why this bypasses the module's
// `components/components` barrel.
import NotificationBell from '../../modules/notifications/components/notification-bell.vue';
import type { AppTopBarMenuButton } from '../components/app-top-bar.types';
import { AppBar, AppSidebar, AppTopBar } from '../components/components';
import { provideAppBarHost } from '../composables/useAppBarHost';
import { useSizeClass } from '../composables/useSizeClass';

defineOptions({
	name: 'LayoutDefault',
});

const ns = useNamespace('app-layout-default');
const { t } = useI18n();
const { sizeClass, isPhone, isTabletPortrait, isTabletLandscape, isDesktop } = useSizeClass();

// The modal menu drawer
const menuState = ref<boolean>(false);

// Every view-header below draws into the phone app bar instead of rendering the page header
const { heading: phoneHeading } = provideAppBarHost((): boolean => isPhone.value);

const onPhoneLeft = (): void => {
	if (phoneHeading.value === null || phoneHeading.value.left === 'menu') {
		menuState.value = true;
	} else {
		phoneHeading.value.onLeft?.();
	}
};

// Desktop and wide: the user can collapse the 220 px sidebar to the 64 px rail
const mainMenuCollapsed = ref<boolean>(false);

// Tablet landscape always shows the rail; its button opens the full menu in the drawer
const railOnly = computed<boolean>((): boolean => isTabletLandscape.value || (isDesktop.value && mainMenuCollapsed.value));

const menuButton = computed<AppTopBarMenuButton>((): AppTopBarMenuButton => {
	if (isTabletPortrait.value) {
		return 'open';
	}

	return isTabletLandscape.value ? 'expand' : 'collapse';
});

const onOpenMenu = (): void => {
	menuState.value = true;
};

const onCloseMenu = (): void => {
	menuState.value = false;
};

// Desktop has no menu drawer; a drawer left open while the window grows closes with it
watch(
	(): string => sizeClass.value,
	(): void => {
		if (isDesktop.value) {
			menuState.value = false;
		}
	}
);
</script>

<style rel="stylesheet/scss" lang="scss">
@use 'layout-default.scss';
</style>
