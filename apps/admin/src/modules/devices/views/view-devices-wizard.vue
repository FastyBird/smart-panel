<template>
	<component
		:is="element?.components?.deviceWizard"
		v-if="element?.components?.deviceWizard"
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
import { useDevicesPlugins } from '../composables/composables';
import { DEVICES_MODULE_NAME, RouteNames } from '../devices.constants';

const props = defineProps<{
	type: string;
}>();

const { t } = useI18n();
const router = useRouter();
const { getByPluginType } = useDevicesPlugins();

const plugin = computed(() => getByPluginType(props.type));
const element = computed(() =>
	plugin.value?.elements.find((el) => (el.modules === undefined || el.modules.includes(DEVICES_MODULE_NAME)) && !!el.components?.deviceWizard)
);
</script>
