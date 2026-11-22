<template>
	<view-header
		:title="t('devicesModule.headings.devices.add')"
		:subtitle="t('devicesModule.subHeadings.devices.add')"
		icon="mdi:devices"
		left="close"
		:primary="formHost.stepped.value ? undefined : { label: t('devicesModule.buttons.save.title'), handler: onSubmit }"
		@back="() => (remoteFormChanged ? onDiscard() : onClose())"
	/>

	<app-breadcrumbs :items="breadcrumbs" />

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 tp:px-4">
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

		<!-- Wherever the phone app bar is not there to carry Save: in a drawer, and on a page kept open past 720 px. A plugin
		     form with several steps runs them in its own wizard-shell, footer included -->
		<form-footer
			v-show="!formHost.stepped.value && (inDrawer || !isPhone)"
			:dirty="remoteFormChanged"
			:saving="remoteFormResult === FormResult.WORKING"
			@discard="onDiscard"
			@close="onClose"
		>
			<template #primary>
				<el-button
					:loading="remoteFormResult === FormResult.WORKING"
					:disabled="remoteFormResult !== FormResult.NONE"
					type="primary"
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
			</template>
		</form-footer>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElAlert, ElButton, ElDivider, ElMessageBox, ElScrollbar } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBreadcrumbs, FormFooter, type IPlugin, type IPluginElement, ViewHeader, useEditDrawer, useSizeClass, useUuid } from '../../../common';
import { DeviceAddForm } from '../components/components';
import SelectDevicePlugin from '../components/devices/select-device-plugin.vue';
import { provideDeviceFormHost, useDevicesPlugins } from '../composables/composables';
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

// Template 4: the form sits in a drawer from tablet portrait up and is its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

const newDeviceId = uuidGenerate();

const { plugins } = useDevicesPlugins();

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const selectedType = ref<IPluginElement['type'] | undefined>(undefined);

const plugin = computed<IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined>(() => {
	return plugins.value.find((plugin) => (plugin.elements ?? []).some((element) => element.type === selectedType.value));
});

const element = computed<IPluginElement<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined>(() => {
	return (plugin.value?.elements ?? []).find((element) => element.type === selectedType.value);
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
			if (inDrawer.value) {
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
	if (inDrawer.value) {
		router.replace({ name: RouteNames.DEVICES });
	} else {
		router.push({ name: RouteNames.DEVICES });
	}
};

// A plugin form with steps leaves through the host, the way Close and Discard do
const formHost = provideDeviceFormHost((): void => (remoteFormChanged.value ? onDiscard() : onClose()));

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			if (inDrawer.value) {
				router.replace({ name: RouteNames.DEVICES });
			} else {
				router.push({ name: RouteNames.DEVICES });
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
