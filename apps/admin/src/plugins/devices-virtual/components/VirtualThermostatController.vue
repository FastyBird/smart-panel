<template>
	<native-thermostat-editor
		v-if="!guarded"
		:key="deviceId"
		:device-id="deviceId"
		@absent="guarded = true"
	/>
	<virtual-thermostat-editor
		v-else
		:device-id="deviceId"
	/>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

import NativeThermostatEditor from './NativeThermostatEditor.vue';
import VirtualThermostatEditor from './virtual-thermostat-editor.vue';

const props = defineProps<{ deviceId: string }>();
const guarded = ref(false);
watch(
	() => props.deviceId,
	() => {
		guarded.value = false;
	},
	{ flush: 'sync' }
);
</script>
