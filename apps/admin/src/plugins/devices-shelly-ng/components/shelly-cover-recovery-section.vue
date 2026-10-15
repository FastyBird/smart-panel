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

import ShellyCoverRecovery from './shelly-cover-recovery.vue';

const props = defineProps<{ device: IDevice }>();
const stores = injectStoresManager();
const channels = stores.getStore(channelsStoreKey),
	properties = stores.getStore(channelsPropertiesStoreKey);
const connected = ref(true);
const sockets = injectSockets();
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
	props.device.type !== 'devices-shelly-ng'
		? []
		: channels.findForDevice(props.device.id).flatMap((channel) => {
				if (channel.category !== 'window_covering' || !/^cover:\d+$/.test(channel.identifier ?? '')) return [];
				const command = properties.findForChannel(channel.id).find((property) => property.category === 'command');
				return command ? [{ deviceId: props.device.id, channelId: channel.id, propertyId: command.id }] : [];
			})
);
</script>
