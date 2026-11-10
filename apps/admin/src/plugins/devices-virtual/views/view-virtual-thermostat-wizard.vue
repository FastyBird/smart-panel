<template>
	<virtual-wizard-shell :mode="DevicesVirtualPluginDeviceMode.climate_controller">
		<el-radio-group
			v-model="strategy"
			class="mb-2"
			:aria-label="t('devicesVirtualPlugin.nativeThermostat.strategy')"
		>
			<el-radio-button value="guarded_branches">{{ t('devicesVirtualPlugin.nativeThermostat.guarded') }}</el-radio-button>
			<el-radio-button value="native_unit">{{ t('devicesVirtualPlugin.nativeThermostat.title') }}</el-radio-button>
		</el-radio-group>
		<virtual-thermostat-editor
			v-show="strategy === 'guarded_branches'"
			create
			@created="onCreated"
		/>
		<native-thermostat-editor
			v-show="strategy === 'native_unit'"
			create
			@created="onCreated"
		/>
	</virtual-wizard-shell>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElRadioButton, ElRadioGroup } from 'element-plus';

import { RouteNames as DeviceRouteNames } from '../../../modules/devices';
import { DevicesVirtualPluginDeviceMode } from '../../../openapi.constants';
import NativeThermostatEditor from '../components/NativeThermostatEditor.vue';
import VirtualThermostatEditor from '../components/virtual-thermostat-editor.vue';
import VirtualWizardShell from '../components/wizard/virtual-wizard-shell.vue';

defineOptions({
	name: 'ViewVirtualThermostatWizard',
});

const router = useRouter();
const { t } = useI18n();
const strategy = ref<'guarded_branches' | 'native_unit'>('guarded_branches');
const onCreated = (id: string) => router.push({ name: DeviceRouteNames.DEVICE, params: { id } });
</script>
