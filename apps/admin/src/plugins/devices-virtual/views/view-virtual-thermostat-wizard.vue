<template>
	<virtual-wizard-shell :busy="busy">
		<virtual-thermostat-editor
			create
			@created="onCreated"
			@busy="busy = $event"
		/>
	</virtual-wizard-shell>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { RouteNames as DeviceRouteNames } from '../../../modules/devices';
import VirtualThermostatEditor from '../components/virtual-thermostat-editor.vue';
import VirtualWizardShell from '../components/wizard/virtual-wizard-shell.vue';

defineOptions({
	name: 'ViewVirtualThermostatWizard',
});

// Only the guarded-relay thermostat is created here. Binding a controller to a device that already
// is a thermostat (a Home Assistant or Zigbee2MQTT climate unit) was offered as a second strategy on
// this page; it produced a second thermostat for hardware that is already adopted and controllable,
// so it is no longer offered. Controllers created that way earlier keep their editor on the device
// detail page.
const router = useRouter();
const busy = ref(false);
const onCreated = (id: string) => router.push({ name: DeviceRouteNames.DEVICE, params: { id } });
</script>
