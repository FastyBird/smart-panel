<template>
	<device-wizard-shell
		:key="id"
		:title="t('devicesModbusPlugin.wizard.edit.title')"
		:return-route="{ name: RouteNames.DEVICE, params: { id }, query: { tab: 'plugin:modbus' } }"
	>
		<view-modbus-wizard :id="id" />
	</device-wizard-shell>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import DeviceWizardShell from '../../../modules/devices/components/wizard/device-wizard-shell.vue';
import { RouteNames } from '../../../modules/devices/devices.constants';

import ViewModbusWizard from './view-modbus-wizard.vue';

defineProps<{ id: string }>();
const { t } = useI18n();
</script>
