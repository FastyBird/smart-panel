<template>
	<div
		v-if="isPluginsListRoute || isLGDevice"
		class="grow-1 flex flex-col lt-sm:mx-1 lt-sm:mb-1 sm:mb-2 overflow-hidden"
	>
		<el-scrollbar class="grow-1">
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				<el-card
					v-for="plugin in plugins"
					:key="String(plugin.type)"
					shadow="hover"
					class="config-plugin-card"
					body-class="p-4!"
					@click="onPluginEdit(plugin.type)"
				>
					<div class="flex items-start gap-3">
						<div class="config-plugin-card__icon">
							<icon icon="mdi:toy-brick" />
						</div>
						<div class="flex-1 min-w-0 config-plugin-card__content">
							<h3 class="config-plugin-card__title">
								{{ plugin.name }}
							</h3>
							<p class="config-plugin-card__description">
								{{ plugin.description || '&nbsp;' }}
							</p>
						</div>
						<div class="config-plugin-card__chevron">
							<icon icon="mdi:chevron-right" />
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
.config-plugin-card {
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover {
		.config-plugin-card__chevron {
			opacity: 1;
			transform: translateX(2px);
		}
	}
}

.config-plugin-card__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 2.5rem;
	height: 2.5rem;
	border-radius: var(--el-border-radius-base);
	background-color: var(--el-color-success-light-9);
	color: var(--el-color-success);
	font-size: 1.25rem;
	flex-shrink: 0;
}

.config-plugin-card__content {
	display: flex;
	flex-direction: column;
	height: 4.5rem;
}

.config-plugin-card__title {
	margin: 0 0 0.25rem 0;
	font-size: 0.9375rem;
	font-weight: 600;
	line-height: 1.3;
	color: var(--el-text-color-primary);
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.config-plugin-card__description {
	margin: 0;
	font-size: 0.8125rem;
	line-height: 1.4;
	color: var(--el-text-color-secondary);
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.config-plugin-card__chevron {
	display: flex;
	align-items: center;
	color: var(--el-text-color-placeholder);
	font-size: 1.25rem;
	opacity: 0.5;
	transition: all 0.2s ease;
	flex-shrink: 0;
	align-self: center;
}
</style>
