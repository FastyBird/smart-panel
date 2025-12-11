<template>
	<div
		v-if="isModulesListRoute || isLGDevice"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden"
	>
		<el-scrollbar class="grow-1">
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
			<el-card
				v-for="module in modules"
				:key="String(module.type)"
				shadow="hover"
				class="cursor-pointer transition-all hover:shadow-lg"
				@click="onModuleEdit(module.type)"
			>
					<div class="flex flex-col items-center justify-center p-6 text-center">
						<el-icon
							:size="48"
							class="mb-4 text-gray-600"
						>
							<icon icon="mdi:package-variant" />
						</el-icon>
						<div class="text-lg font-semibold mb-2">
							{{ module.name }}
						</div>
						<div
							v-if="module.description"
							class="text-sm text-gray-500"
						>
							{{ module.description }}
						</div>
					</div>
				</el-card>
			</div>
		</el-scrollbar>
	</div>

	<router-view
		v-else
		:key="typeof route.params.module === 'string' ? route.params.module : String(route.params.module || '')"
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
						<icon icon="mdi:package-variant" />
					</template>
					<template #message>
						{{ t('configModule.messages.loadError') }}
					</template>

					<suspense>
						<router-view
							:key="typeof route.params.module === 'string' ? route.params.module : String(route.params.module)"
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
	AppBarHeading,
	ViewError,
	useBreakpoints,
} from '../../../common';
import { type IModule } from '../../../common';
import { useModules } from '../composables/useModules';
import { FormResult, RouteNames } from '../config.constants';

import type { ViewConfigModulesProps } from './view-config-modules.types';

defineOptions({
	name: 'ViewConfigModules',
});

const props = withDefaults(defineProps<ViewConfigModulesProps>(), {
	remoteFormSubmit: false,
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
});

const emit = defineEmits<{
	(e: 'update:remoteFormSubmit', remoteFormSubmit: boolean): void;
	(e: 'update:remoteFormResult', remoteFormResult: FormResult): void;
	(e: 'update:remoteFormReset', remoteFormReset: boolean): void;
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const { isLGDevice } = useBreakpoints();

const { modules } = useModules();

const showDrawer = ref<boolean>(false);
const remoteFormSubmit = ref<boolean>(props.remoteFormSubmit);
const remoteFormResult = ref<FormResult>(props.remoteFormResult);
const remoteFormChanged = ref<boolean>(false);

const isModulesListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.CONFIG_MODULES;
});

const currentModuleType = computed<string>((): string => {
	const moduleParam = route.params.module;
	return (Array.isArray(moduleParam) ? moduleParam[0] : moduleParam) || '';
});

const currentModule = computed<IModule | undefined>((): IModule | undefined => {
	if (!currentModuleType.value) {
		return undefined;
	}
	return modules.value.find((m) => m.type === currentModuleType.value);
});

const currentModuleName = computed<string>((): string => {
	return currentModule.value?.name || currentModuleType.value;
});

const onModuleEdit = (moduleType: IModule['type']): void => {
	const moduleParam = typeof moduleType === 'string' ? moduleType : String(moduleType);
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.CONFIG_MODULE_EDIT,
			params: {
				module: moduleParam,
			},
		});
	} else {
		router.push({
			name: RouteNames.CONFIG_MODULE_EDIT,
			params: {
				module: moduleParam,
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
						name: RouteNames.CONFIG_MODULES,
					});
				} else {
					router.push({
						name: RouteNames.CONFIG_MODULES,
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
				name: RouteNames.CONFIG_MODULES,
			});
		} else {
			router.push({
				name: RouteNames.CONFIG_MODULES,
			});
		}

		done?.();
	}
};

watch(
	(): string | string[] | undefined => route.params.module,
	(module: string | string[] | undefined): void => {
		const moduleParam = Array.isArray(module) ? module[0] : module;
		if (isLGDevice.value && moduleParam && typeof moduleParam === 'string') {
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

watch(
	(): FormResult => props.remoteFormResult,
	(val: FormResult): void => {
		remoteFormResult.value = val;
	}
);

watch(
	(): boolean => remoteFormSubmit.value,
	(val: boolean): void => {
		emit('update:remoteFormSubmit', val);
	}
);

watch(
	(): FormResult => remoteFormResult.value,
	(val: FormResult): void => {
		emit('update:remoteFormResult', val);
	}
);

onMounted((): void => {
	if (route.params.module && isLGDevice.value) {
		showDrawer.value = true;
	}
});

useMeta({
	title: t('configModule.meta.configModules.title'),
});
</script>
