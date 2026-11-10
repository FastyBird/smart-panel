<template>
	<div class="overflow-x-auto">
		<el-radio-group
			class="flex-nowrap!"
			:model-value="mode"
			:disabled="disabled"
			:aria-label="t('devicesVirtualPlugin.measurement.mode')"
			data-test-id="virtual-wizard-mode"
			@change="onMode"
		>
			<el-radio-button :value="DevicesVirtualPluginDeviceMode.projection">
				{{ t('devicesVirtualPlugin.measurement.projection') }}
			</el-radio-button>
			<el-radio-button :value="DevicesVirtualPluginDeviceMode.sensor_aggregate">
				{{ t('devicesVirtualPlugin.measurement.aggregate') }}
			</el-radio-button>
			<el-radio-button :value="DevicesVirtualPluginDeviceMode.sensor_transform">
				{{ t('devicesVirtualPlugin.measurement.transform') }}
			</el-radio-button>
			<el-radio-button :value="DevicesVirtualPluginDeviceMode.actuator_group">
				{{ t('devicesVirtualPlugin.measurement.group') }}
			</el-radio-button>
			<el-radio-button :value="DevicesVirtualPluginDeviceMode.climate_controller">
				{{ t('devicesVirtualPlugin.measurement.thermostat') }}
			</el-radio-button>
		</el-radio-group>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { type RouteLocationRaw, useRouter } from 'vue-router';

import { ElRadioButton, ElRadioGroup } from 'element-plus';

import { DevicesVirtualPluginDeviceMode } from '../../../../openapi.constants';
import { RouteNames } from '../../devices-virtual.constants';

defineOptions({
	name: 'VirtualWizardModeSelector',
});

// Every kind of virtual device is authored on its own route, but they are one wizard to the user: the
// same header, the same selector with the current kind highlighted, and Cancel always in the same
// place. This selector is the only thing that moves between those routes, and it is rendered by each
// of them, so choosing a kind never leaves the wizard.
const props = defineProps<{ mode: DevicesVirtualPluginDeviceMode; disabled?: boolean }>();

const { t } = useI18n();
const router = useRouter();

const target = (mode: unknown): RouteLocationRaw | null => {
	switch (mode) {
		case DevicesVirtualPluginDeviceMode.projection:
			return { name: RouteNames.WIZARD };
		case DevicesVirtualPluginDeviceMode.sensor_aggregate:
		case DevicesVirtualPluginDeviceMode.sensor_transform:
			return { name: RouteNames.MEASUREMENT_WIZARD, query: { mode } };
		case DevicesVirtualPluginDeviceMode.actuator_group:
			return { name: RouteNames.LIGHT_GROUP_WIZARD };
		case DevicesVirtualPluginDeviceMode.climate_controller:
			return { name: RouteNames.THERMOSTAT_WIZARD };
		default:
			return null;
	}
};

const onMode = (mode: unknown): void => {
	if (props.disabled || mode === props.mode) {
		return;
	}

	const location = target(mode);

	if (location !== null) {
		void router.push(location);
	}
};
</script>
