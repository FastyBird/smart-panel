<template>
	<shelly-cover-recovery
		v-for="target in targets"
		:key="target.propertyId"
		v-bind="target"
		:connected="connected"
	/>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';

import { injectSockets, injectStoresManager } from '../../../common';
import type { IDevice } from '../../../modules/devices';
import { channelsPropertiesStoreKey, channelsStoreKey } from '../../../modules/devices/store/keys';

import { shellyCoverRecoveryTargets } from './shelly-cover-recovery-targets';
import ShellyCoverRecovery from './shelly-cover-recovery.vue';

const props = defineProps<{ device: IDevice }>();
const stores = injectStoresManager();
const channels = stores.getStore(channelsStoreKey),
	properties = stores.getStore(channelsPropertiesStoreKey);
const sockets = injectSockets();
const connected = ref(sockets.connected);
const connect = () => {
		connected.value = true;
	},
	disconnect = () => {
		connected.value = false;
	};
sockets.on('connect', connect);
sockets.on('disconnect', disconnect);
onBeforeUnmount(() => {
	sockets.off('connect', connect);
	sockets.off('disconnect', disconnect);
});
const targets = computed(() =>
	shellyCoverRecoveryTargets(props.device, channels.findForDevice(props.device.id), (id) => properties.findForChannel(id))
);
</script>
