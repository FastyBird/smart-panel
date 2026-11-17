<template>
	<native-thermostat-wizard
		v-if="native"
		@created="onCreated"
		@busy="busy = $event"
	/>
	<virtual-thermostat-editor
		v-else
		create
		@created="onCreated"
		@busy="busy = $event"
	/>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { RouteNames as DeviceRouteNames } from '../../../modules/devices';
import { useDeviceWizardComplete } from '../../../modules/devices/components/wizard/device-wizard-flow';
import NativeThermostatWizard from '../components/native-thermostat-wizard.vue';
import VirtualThermostatEditor from '../components/virtual-thermostat-editor.vue';

defineOptions({
	name: 'ViewVirtualThermostatWizard',
});

defineProps<{ native?: boolean }>();
const router = useRouter();
const busy = ref(false);
const complete = useDeviceWizardComplete();
const onCreated = (id: string) => {
	complete();
	return router.push({ name: DeviceRouteNames.DEVICE, params: { id } });
};
</script>
