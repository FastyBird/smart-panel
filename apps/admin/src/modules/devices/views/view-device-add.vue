<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:power-plug"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('devicesModule.headings.devices.add') }}
		</template>

		<template #subtitle>
			{{ t('devicesModule.subHeadings.devices.add') }}
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
		@click="onSubmit"
	>
		<span class="uppercase">{{ t('devicesModule.buttons.save.title') }}</span>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 md:px-4">
			<select-device-plugin v-model="selectedType" />

			<el-divider />

			<template v-if="selectedType">
				<component
					:is="element?.components?.deviceAddForm"
					v-if="typeof element?.components?.deviceAddForm !== 'undefined'"
					:id="newDeviceId"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-reset="remoteFormReset"
					v-model:remote-form-changed="remoteFormChanged"
					:type="selectedType"
				/>

				<device-add-form
					v-else
					:id="newDeviceId"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-reset="remoteFormReset"
					v-model:remote-form-changed="remoteFormChanged"
					:type="selectedType"
				/>
			</template>

			<el-alert
				v-else
				:title="t('devicesModule.headings.devices.selectPlugin')"
				:description="t('devicesModule.texts.devices.selectPlugin')"
				:closable="false"
				show-icon
				type="info"
			/>
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
					{{ t('devicesModule.buttons.discard.title') }}
				</el-button>
				<el-button
					v-if="!remoteFormChanged"
					link
					class="mr-2"
					@click="onClose"
				>
					{{ t('devicesModule.buttons.close.title') }}
				</el-button>

				<el-button
					:loading="remoteFormResult === FormResult.WORKING"
					:disabled="remoteFormResult !== FormResult.NONE"
					type="primary"
					class="order-2"
					@click="onSubmit"
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
					{{ t('devicesModule.buttons.save.title') }}
				</el-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElAlert, ElButton, ElDivider, ElIcon, ElMessageBox, ElScrollbar } from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	type IPlugin,
	type IPluginElement,
	useBreakpoints,
	useUuid,
} from '../../../common';
import { DeviceAddForm } from '../components/components';
import SelectDevicePlugin from '../components/devices/select-device-plugin.vue';
import { useDevicesPlugins } from '../composables/composables';
import { FormResult, type FormResultType, RouteNames } from '../devices.constants';
import type { IDevicePluginsComponents, IDevicePluginsSchemas } from '../devices.types';

import type { IViewDeviceAddProps } from './view-device-add.types';

defineOptions({
	name: 'ViewDeviceAdd',
});

defineProps<IViewDeviceAddProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('devicesModule.meta.devices.add.title'),
});

const { generate: uuidGenerate } = useUuid();

const { isMDDevice, isLGDevice } = useBreakpoints();

const newDeviceId = uuidGenerate();

const { plugins } = useDevicesPlugins();

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const selectedType = ref<IPluginElement['type'] | undefined>(undefined);

const plugin = computed<IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined>(() => {
	return plugins.value.find((plugin) => plugin.type === selectedType.value);
});

const element = computed<IPluginElement<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined>(() => {
	return plugin.value?.elements.find((element) => element.type === selectedType.value);
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('devicesModule.breadcrumbs.devices.list'),
				route: router.resolve({ name: RouteNames.DEVICES }),
			},
			{
				label: t('devicesModule.breadcrumbs.devices.add'),
				route: router.resolve({ name: RouteNames.DEVICES_ADD }),
			},
		];
	}
);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('devicesModule.texts.misc.confirmDiscard'), t('devicesModule.headings.misc.discard'), {
		confirmButtonText: t('devicesModule.buttons.yes.title'),
		cancelButtonText: t('devicesModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.DEVICES });
			} else {
				router.push({ name: RouteNames.DEVICES });
			}
		})
		.catch((): void => {
			// Just ignore it
		});
};

const onSubmit = (): void => {
	remoteFormSubmit.value = true;
};

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.DEVICES });
	} else {
		router.push({ name: RouteNames.DEVICES });
	}
};

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.DEVICES_EDIT, params: { id: newDeviceId } });
			} else {
				router.push({ name: RouteNames.DEVICES_EDIT, params: { id: newDeviceId } });
			}
		}
	}
);

watch(
	(): boolean => remoteFormChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>
