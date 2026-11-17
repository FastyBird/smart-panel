<template>
	<virtual-measurement-editor
		:key="`${mode}:${dewPoint}`"
		:mode="mode"
		:dew-point="dewPoint"
		wizard
		@created="onCreated"
		@busy="busy = $event"
	/>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { RouteNames } from '../../../modules/devices';
import { useDeviceWizardComplete } from '../../../modules/devices/components/wizard/device-wizard-flow';
import { DevicesVirtualPluginDeviceMode } from '../../../openapi.constants';
import VirtualMeasurementEditor from '../components/virtual-measurement-editor.vue';
import type { MeasurementMode } from '../utils/measurement-authoring.utils';

defineOptions({
	name: 'ViewVirtualMeasurementWizard',
});

const props = withDefaults(defineProps<{ mode?: MeasurementMode; dewPoint?: boolean }>(), {
	mode: DevicesVirtualPluginDeviceMode.sensor_aggregate,
	dewPoint: false,
});
const mode = computed(() => props.mode);
const dewPoint = computed(() => props.dewPoint);
const busy = ref(false);
const router = useRouter();
const complete = useDeviceWizardComplete();
const onCreated = (id: string) => {
	complete();
	return router.push({ name: RouteNames.DEVICE, params: { id } });
};
</script>
