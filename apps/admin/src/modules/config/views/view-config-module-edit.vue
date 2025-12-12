<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:package-variant"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ moduleName }}
		</template>

		<template #subtitle>
			{{ t('configModule.subHeadings.configModule') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="() => (remoteFormChanged ? onDiscard() : onClose())"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onSave"
	>
		<span class="uppercase">{{ t('configModule.buttons.save.title') }}</span>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<div
		v-loading="isLoading || (!configModule && !loadError)"
		:element-loading-text="t('configModule.texts.loadingModuleConfig')"
		class="flex flex-col overflow-hidden h-full"
	>
		<div
			v-if="loadError"
			class="flex flex-col items-center justify-center h-full p-4"
		>
			<el-result
				icon="error"
				:title="t('configModule.messages.loadError', 'Failed to load configuration')"
			>
				<template #extra>
					<el-button
						type="primary"
						@click="onRetry"
					>
						{{ t('configModule.buttons.retry.title', 'Retry') }}
					</el-button>
				</template>
			</el-result>
		</div>
		<el-scrollbar
			v-else-if="configModule"
			class="grow-1 p-2 md:px-4"
		>
			<component
				:is="element?.components?.moduleConfigEditForm"
				v-if="configModule && element?.components?.moduleConfigEditForm"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:config="configModule"
			/>
			<div
				v-else
				class="p-4"
			>
				<p v-if="!configModule">Loading config...</p>
				<p v-else-if="!moduleComposable.value.module.value">
					Module "{{ moduleType }}" not found in modules list.
				</p>
				<p v-else-if="!element">
					Module "{{ moduleType }}" does not have a config element (type: module) registered.
				</p>
				<p v-else-if="!element?.components">
					Module "{{ moduleType }}" config element does not have components.
				</p>
				<p v-else-if="!element?.components?.moduleConfigEditForm">
					Module "{{ moduleType }}" does not have a configuration form component registered.
					Available components: {{ Object.keys(element.components || {}) }}
				</p>
			</div>
		</el-scrollbar>

		<div
			v-if="isMDDevice"
			class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
			style="background-color: var(--el-drawer-bg-color)"
		>
			<div class="p-2">
				<el-button
					v-if="remoteFormChanged"
					link
					class="mr-2"
					@click="onDiscard"
				>
					{{ t('configModule.buttons.discard.title') }}
				</el-button>
				<el-button
					v-if="!remoteFormChanged"
					link
					class="mr-2"
					@click="onClose"
				>
					{{ t('configModule.buttons.close.title') }}
				</el-button>

				<div
					:id="SUBMIT_FORM_SM"
					class="order-2 inline-block [&>*:first-child:not(:only-child)]:hidden"
				>
					<el-button
						:loading="remoteFormResult === FormResult.WORKING"
						:disabled="isLoading || remoteFormResult !== FormResult.NONE"
						type="primary"
						@click="onSave"
					>
						<template
							v-if="remoteFormResult === FormResult.OK || remoteFormResult === FormResult.ERROR"
							#icon
						>
							<icon
								v-if="remoteFormResult === FormResult.OK"
								icon="mdi:check-circle"
							/>
							<icon
								v-else-if="remoteFormResult === FormResult.ERROR"
								icon="mdi:cross-circle"
							/>
						</template>
						{{ t('configModule.buttons.save.title') }}
					</el-button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElIcon, ElMessageBox, ElResult, ElScrollbar, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	SUBMIT_FORM_SM,
	useBreakpoints,
} from '../../../common';
import { ConfigModule } from '../components/components';
import { useConfigModule } from '../composables/useConfigModule';
import { useModule } from '../composables/useModule';
import { FormResult, RouteNames } from '../config.constants';

import type { IViewConfigModuleEditProps } from './view-config-module-edit.types';

defineOptions({
	name: 'ViewConfigModuleEdit',
	inheritAttrs: false,
});

const props = withDefaults(defineProps<IViewConfigModuleEditProps>(), {
	remoteFormSubmit: false,
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
});

const emit = defineEmits<{
	(e: 'update:remoteFormSubmit', remoteFormSubmit: boolean): void;
	(e: 'update:remoteFormResult', remoteFormResult: FormResult): void;
	(e: 'update:remoteFormReset', remoteFormReset: boolean): void;
	(e: 'update:remoteFormChanged', formChanged: boolean): void;
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { meta } = useMeta({});

const { isMDDevice, isLGDevice } = useBreakpoints();

const remoteFormSubmit = ref<boolean>(props.remoteFormSubmit);
const remoteFormResult = ref<FormResult>(props.remoteFormResult);
const remoteFormReset = ref<boolean>(props.remoteFormReset);
const remoteFormChanged = ref<boolean>(false);
const loadError = ref<boolean>(false);

const moduleType = computed<string>((): string => {
	const moduleParam = route.params.module;
	return (Array.isArray(moduleParam) ? moduleParam[0] : moduleParam) || '';
});

// Use a ref to track the current module type and update it when route changes
const currentModuleType = ref<string>(moduleType.value || '');
watch(
	(): string => moduleType.value,
	(val: string): void => {
		if (val) {
			currentModuleType.value = val;
		}
	},
	{ immediate: true }
);

const moduleComposable = computed(() => {
	// Re-create composable when module type changes
	return useModule({ name: currentModuleType.value });
});

const moduleName = computed<string>((): string => {
	return moduleComposable.value.module.value?.name || moduleType.value;
});

// Create composable reactively based on module type
const configModuleComposable = computed(() => {
	if (!currentModuleType.value) {
		// Return a dummy composable if no module type
		return {
			configModule: computed(() => null),
			isLoading: computed(() => false),
			fetchConfigModule: async (): Promise<void> => {
				throw new Error('Module type is required');
			},
		};
	}
	return useConfigModule({ type: currentModuleType.value });
});
const configModule = computed(() => configModuleComposable.value.configModule.value);
const isLoading = computed(() => configModuleComposable.value.isLoading.value);
const fetchConfigModule = (): Promise<void> => {
	if (!currentModuleType.value) {
		return Promise.reject(new Error('Module type is required'));
	}
	return configModuleComposable.value.fetchConfigModule();
};
const element = computed(() => moduleComposable.value.element.value);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		const items = [
			{
				label: t('configModule.breadcrumbs.config'),
				route: router.resolve({ name: RouteNames.CONFIG }),
			},
			{
				label: t('configModule.breadcrumbs.configModules'),
				route: router.resolve({ name: RouteNames.CONFIG_MODULES }),
			},
		];

		if (moduleName.value) {
			items.push({
				label: moduleName.value,
				route: router.resolve({ name: RouteNames.CONFIG_MODULE_EDIT, params: { module: moduleType.value } }),
			});
		}

		return items;
	}
);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('configModule.texts.misc.confirmDiscard'), t('configModule.headings.misc.discard'), {
		confirmButtonText: t('configModule.buttons.yes.title'),
		cancelButtonText: t('configModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.CONFIG_MODULES });
			} else {
				router.push({ name: RouteNames.CONFIG_MODULES });
			}
		})
		.catch((): void => {
			// Just ignore it
		});
};

const onSave = (): void => {
	remoteFormSubmit.value = true;
};

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.CONFIG_MODULES });
	} else {
		router.push({ name: RouteNames.CONFIG_MODULES });
	}
};

const onRetry = async (): Promise<void> => {
	loadError.value = false;
	await fetchConfigModule().catch((error: unknown): void => {
		const err = error as Error;

		loadError.value = true;
		console.error('Failed to fetch config module:', err);
	});
};

// Watch for route changes and refetch config
watch(
	(): string => moduleType.value,
	async (val: string): Promise<void> => {
		if (!val) {
			return;
		}
		
		loadError.value = false;
		await fetchConfigModule().catch((error: unknown): void => {
			const err = error as Error;

			loadError.value = true;
			console.error('Failed to fetch config module:', err);
		});
	},
	{ immediate: true }
);

onMounted((): void => {
	emit('update:remoteFormChanged', remoteFormChanged.value);
});

watch(
	(): string => moduleName.value,
	(name: string): void => {
		meta.title = t('configModule.meta.configModuleEdit.title', { module: name });
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
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		remoteFormReset.value = val;
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

watch(
	(): boolean => remoteFormReset.value,
	(val: boolean): void => {
		emit('update:remoteFormReset', val);
	}
);

watch(
	(): boolean => remoteFormChanged.value,
	(val: boolean): void => {
		emit('update:remoteFormChanged', val);
	}
);
</script>
