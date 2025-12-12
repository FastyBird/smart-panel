<template>
	<div
		v-if="isPluginsListRoute || isLGDevice"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden"
	>
		<el-scrollbar class="grow-1">
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
			<el-card
				v-for="plugin in plugins"
				:key="String(plugin.type)"
				shadow="never"
				class="config-plugin-card"
				@click="onPluginEdit(plugin.type)"
			>
					<div class="flex flex-col items-center justify-center p-6 text-center">
						<el-icon
							:size="48"
							class="mb-4 text-gray-600"
						>
							<icon icon="mdi:toy-brick" />
						</el-icon>
						<div class="text-lg font-semibold mb-2">
							{{ plugin.name }}
						</div>
						<div
							v-if="plugin.description"
							class="text-sm text-gray-500"
						>
							{{ plugin.description }}
						</div>
					</div>
				</el-card>
			</div>
		</el-scrollbar>
	</div>

	<router-view
		v-else
		:key="typeof route.params.plugin === 'string' ? route.params.plugin : String(route.params.plugin || '')"
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>

	<el-drawer
		v-if="isLGDevice"
		v-model="showDrawer"
		:show-close="false"
		:size="'40%'"
		:with-header="false"
		:before-close="onCloseDrawer"
	>
		<div class="flex flex-col h-full">
			<app-bar menu-button-hidden>
				<template #button-right>
					<app-bar-button
						:align="AppBarButtonAlign.RIGHT"
						class="mr-2"
						@click="() => onCloseDrawer()"
					>
						<template #icon>
							<el-icon>
								<icon icon="mdi:close" />
							</el-icon>
						</template>
					</app-bar-button>
				</template>
			</app-bar>

			<template v-if="showDrawer">
				<view-error>
					<template #icon>
						<icon icon="mdi:toy-brick" />
					</template>
					<template #message>
						{{ t('configModule.messages.loadError') }}
					</template>

					<suspense>
						<router-view
							:key="typeof route.params.plugin === 'string' ? route.params.plugin : String(route.params.plugin)"
							v-slot="{ Component }"
						>
						<component
							:is="Component"
							v-model:remote-form-submit="remoteFormSubmit"
							v-model:remote-form-result="remoteFormResult"
							v-model:remote-form-changed="remoteFormChanged"
						/>
						</router-view>
					</suspense>
				</view-error>
			</template>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { useRoute, useRouter } from 'vue-router';

import { ElCard, ElDrawer, ElIcon, ElMessageBox, ElScrollbar } from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBar,
	AppBarButton,
	AppBarButtonAlign,
	ViewError,
	useBreakpoints,
} from '../../../common';
import { type IPlugin } from '../../../common';
import { usePlugins } from '../composables/usePlugins';
import { FormResult, RouteNames } from '../config.constants';

import type { ViewConfigPluginsProps } from './view-config-plugins.types';

defineOptions({
	name: 'ViewConfigPlugins',
});

const props = defineProps<ViewConfigPluginsProps>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const { isLGDevice } = useBreakpoints();

const { plugins } = usePlugins();

const showDrawer = ref<boolean>(false);
const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResult>(FormResult.NONE);
const remoteFormChanged = ref<boolean>(false);

const isPluginsListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.CONFIG_PLUGINS;
});

const onPluginEdit = (pluginType: IPlugin['type']): void => {
	const pluginParam = typeof pluginType === 'string' ? pluginType : String(pluginType);
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.CONFIG_PLUGIN_EDIT,
			params: {
				plugin: pluginParam,
			},
		});
	} else {
		router.push({
			name: RouteNames.CONFIG_PLUGIN_EDIT,
			params: {
				plugin: pluginParam,
			},
		});
	}
};

const onCloseDrawer = (done?: () => void): void => {
	if (remoteFormChanged.value) {
		ElMessageBox.confirm(t('configModule.texts.misc.confirmDiscard'), t('configModule.headings.misc.discard'), {
			confirmButtonText: t('configModule.buttons.yes.title'),
			cancelButtonText: t('configModule.buttons.no.title'),
			type: 'warning',
		})
			.then((): void => {
				if (isLGDevice.value) {
					router.replace({
						name: RouteNames.CONFIG_PLUGINS,
					});
				} else {
					router.push({
						name: RouteNames.CONFIG_PLUGINS,
					});
				}

				done?.();
			})
			.catch((): void => {
				// Just ignore it
			});
	} else {
		if (isLGDevice.value) {
			router.replace({
				name: RouteNames.CONFIG_PLUGINS,
			});
		} else {
			router.push({
				name: RouteNames.CONFIG_PLUGINS,
			});
		}

		done?.();
	}
};

watch(
	(): string | string[] | undefined => route.params.plugin,
	(plugin: string | string[] | undefined): void => {
		const pluginParam = Array.isArray(plugin) ? plugin[0] : plugin;
		if (isLGDevice.value && pluginParam && typeof pluginParam === 'string') {
			showDrawer.value = true;
		} else {
			showDrawer.value = false;
		}
	},
	{ immediate: true }
);

watch(
	(): boolean => props.remoteFormSubmit,
	(val: boolean): void => {
		remoteFormSubmit.value = val;
	}
);

onMounted((): void => {
	if (route.params.plugin && isLGDevice.value) {
		showDrawer.value = true;
	}
});

useMeta({
	title: t('configModule.meta.configPlugins.title'),
});
</script>

<style scoped lang="scss">
:deep(.config-plugin-card) {
	border: 1px solid var(--el-border-color);
	border-radius: var(--el-border-radius-base);
	background-color: var(--el-bg-color);
	cursor: pointer;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	box-shadow: none;

	&:hover {
		border-color: var(--el-text-color-regular);
		background-color: var(--el-fill-color-light);
		box-shadow: 0 0 0 1px var(--el-text-color-regular) inset,
			0 2px 4px 0 rgba(0, 0, 0, 0.12),
			0 0 6px 0 rgba(0, 0, 0, 0.04);
	}

	&:active {
		border-color: var(--el-color-primary);
		background-color: var(--el-fill-color);
		box-shadow: 0 0 0 1px var(--el-color-primary) inset,
			0 2px 4px 0 rgba(0, 0, 0, 0.12),
			0 0 6px 0 rgba(0, 0, 0, 0.04);
	}

	.el-card__body {
		padding: var(--el-card-padding);
	}
}
</style>
