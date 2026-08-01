<template>
	<device-wizard
		v-if="adapterFactory"
		:key="type"
		:adapter-factory="adapterFactory"
	/>

	<entity-not-found
		v-else
		icon="mdi:wizard-hat"
		:message="t('devicesModule.texts.devices.noWizardForDevicePlugin', { type })"
		:button-label="t('devicesModule.buttons.back.title')"
		@back="router.push({ name: RouteNames.DEVICES })"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { EntityNotFound } from '../../../common';
import { DeviceWizard } from '../components/components';
import type { IDeviceWizardAdapter } from '../components/wizard/device-wizard.types';
import { useDevicesPlugins } from '../composables/composables';
import { DEVICES_MODULE_NAME, RouteNames } from '../devices.constants';

const props = defineProps<{
	type: string;
}>();

const { t } = useI18n();
const router = useRouter();
const { getByPluginType } = useDevicesPlugins();

const plugin = computed(() => getByPluginType(props.type));

const eligibleElements = computed(() =>
	(plugin.value?.elements ?? []).filter((el) => el.modules === undefined || el.modules.includes(DEVICES_MODULE_NAME))
);

// Passing the factory rather than its result is deliberate: the adapter is a composable and
// must be instantiated inside the shell's setup(), not in this computed.
const adapterFactory = computed<(() => IDeviceWizardAdapter) | undefined>(
	() => eligibleElements.value.find((el) => !!el.components?.deviceWizardAdapter)?.components?.deviceWizardAdapter
);
</script>
