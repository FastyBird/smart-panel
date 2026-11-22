<template>
	<device-wizard-shell
		v-if="!choosing"
		:key="`${type}:${variant?.id ?? ''}`"
		:title="title"
		:subtitle="plugin?.description"
		:back-route="backRoute"
	>
		<el-alert
			v-if="loadError"
			:title="t('devicesModule.wizard.loadFailed')"
			type="error"
			:closable="false"
		>
			<el-button @click="load">{{ t('devicesModule.wizard.retry') }}</el-button>
		</el-alert>
		<div
			v-else-if="!loaded"
			v-loading="true"
			class="h-30"
		/>
		<component
			:is="content"
			v-else-if="content && enabled(type)"
			v-bind="contentProps"
		/>
		<entity-not-found
			v-else
			icon="mdi:wizard-hat"
			:message="t('devicesModule.texts.devices.noWizardForDevicePlugin', { type })"
			:button-label="t('devicesModule.buttons.back.title')"
			@back="router.push({ name: RouteNames.DEVICES_WIZARD_SELECT })"
		/>
	</device-wizard-shell>
</template>
<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { ElAlert, ElButton, vLoading } from 'element-plus';

import { EntityNotFound } from '../../../common';
import { useConfigPlugins } from '../../config';
import DeviceWizardShell from '../components/wizard/device-wizard-shell.vue';
import { useDevicesPlugins } from '../composables/useDevicesPlugins';
import { RouteNames } from '../devices.constants';

const props = defineProps<{ type: string }>();
const route = useRoute(),
	router = useRouter();
const { t } = useI18n();
const { getByPluginType, getWizard } = useDevicesPlugins();
const { enabled, loaded, fetchConfigPlugins } = useConfigPlugins();
const loadError = ref(false);
const load = async () => {
	loadError.value = false;
	try {
		await fetchConfigPlugins();
	} catch {
		loadError.value = true;
	}
};
onBeforeMount(load);
const plugin = computed(() => getByPluginType(props.type));
const definition = computed(() => getWizard(props.type));
const variantId = computed(() =>
	typeof route.query.variant === 'string'
		? route.query.variant
		: definition.value?.variants?.length === 1
			? definition.value.variants[0]?.id
			: undefined
);
const variant = computed(() => definition.value?.variants?.find((item) => item.id === variantId.value));
const content = computed(() => (variantId.value ? variant.value?.component : definition.value?.component));
const contentProps = computed(() => variant.value?.props ?? definition.value?.props ?? {});
// A plugin with several wizards and none chosen goes back to the picker, which lists each of them
const choosing = computed(() => enabled(props.type) && !!definition.value?.variants?.length && !variantId.value);
watch(
	[choosing, loaded],
	([value, isLoaded]) => {
		if (value && isLoaded) void router.replace({ name: RouteNames.DEVICES_WIZARD_SELECT });
	},
	{ immediate: true }
);
const title = computed(() => (variant.value ? t(variant.value.label) : (plugin.value?.name ?? t('devicesModule.wizard.selection.title'))));
const backRoute = { name: RouteNames.DEVICES_WIZARD_SELECT };
</script>
