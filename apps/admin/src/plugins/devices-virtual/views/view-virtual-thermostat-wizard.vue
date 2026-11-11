<template>
	<virtual-wizard-shell :busy="busy">
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
	</virtual-wizard-shell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { RouteNames as DeviceRouteNames } from '../../../modules/devices';
import NativeThermostatWizard from '../components/native-thermostat-wizard.vue';
import VirtualThermostatEditor from '../components/virtual-thermostat-editor.vue';
import VirtualWizardShell from '../components/wizard/virtual-wizard-shell.vue';

defineOptions({
	name: 'ViewVirtualThermostatWizard',
});

// Two thermostats are created here, and the chooser on the Devices list says which before the
// wizard starts: one built from relays and sensors that Smart Panel regulates itself, and a
// controller put on top of a thermostat that already exists as a device (`?strategy=native_unit`).
const router = useRouter(),
	route = useRoute();
const busy = ref(false);
const native = computed<boolean>(() => route.query.strategy === 'native_unit');
const onCreated = (id: string) => router.push({ name: DeviceRouteNames.DEVICE, params: { id } });
</script>
