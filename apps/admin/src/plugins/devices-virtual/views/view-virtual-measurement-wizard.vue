<template>
	<virtual-wizard-shell :busy="busy">
		<virtual-measurement-editor
			:key="`${mode}:${dewPoint}`"
			:mode="mode"
			:dew-point="dewPoint"
			wizard
			@created="onCreated"
			@busy="busy = $event"
		/>
	</virtual-wizard-shell>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { RouteNames } from '../../../modules/devices';
import { DevicesVirtualPluginDeviceMode } from '../../../openapi.constants';
import VirtualMeasurementEditor from '../components/virtual-measurement-editor.vue';
import VirtualWizardShell from '../components/wizard/virtual-wizard-shell.vue';

defineOptions({
	name: 'ViewVirtualMeasurementWizard',
});

const router = useRouter(),
	route = useRoute();
const busy = ref(false);
const mode = computed(() =>
	route.query.mode === DevicesVirtualPluginDeviceMode.sensor_transform
		? DevicesVirtualPluginDeviceMode.sensor_transform
		: DevicesVirtualPluginDeviceMode.sensor_aggregate
);
const dewPoint = computed(() => mode.value === DevicesVirtualPluginDeviceMode.sensor_transform && route.query.kind === 'dew_point');
const onCreated = (id: string) => router.push({ name: RouteNames.DEVICE, params: { id } });
</script>
