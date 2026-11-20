<template>
	<div class="h-full min-h-full max-h-full w-full min-w-full max-w-full">
		<el-container
			v-if="isPhone"
			direction="vertical"
			:class="[ns.b()]"
			class="h-full min-h-full max-h-full w-full min-w-full max-w-full"
		>
			<app-bar @toggle-menu="onOpenMenu">
				<template #logo>
					<router-link :to="{ name: RouteNames.ROOT }">
						<logo class="fill-white h-[30px]" />
					</router-link>
				</template>

				<template #button-right>
					<div class="flex flex-row items-center gap-2">
						<notification-bell />

						<el-button
							size="large"
							type="primary"
							circle
							:aria-label="t('application.buttons.openMenu.title')"
							data-test-id="layout-open-menu"
							@click.prevent="onOpenMenu"
						>
							<template #icon>
								<icon icon="mdi:menu" />
							</template>
						</el-button>
					</div>
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

import { ElAside, ElButton, ElContainer, ElDrawer, ElMain, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';

import { RouteNames } from '../../app.constants';
import Logo from '../../assets/images/fb_row.svg?component';
// See the identical import in `app-top-bar.vue` for why this bypasses the module's
// `components/components` barrel.
import NotificationBell from '../../modules/notifications/components/notification-bell.vue';
import type { AppTopBarMenuButton } from '../components/app-top-bar.types';
import { AppBar, AppSidebar, AppTopBar } from '../components/components';
import { useSizeClass } from '../composables/useSizeClass';

defineOptions({
	name: 'LayoutDefault',
});

const ns = useNamespace('app-layout-default');
const { t } = useI18n();
const { sizeClass, isPhone, isTabletPortrait, isTabletLandscape, isDesktop } = useSizeClass();

// The modal menu drawer
const menuState = ref<boolean>(false);

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
