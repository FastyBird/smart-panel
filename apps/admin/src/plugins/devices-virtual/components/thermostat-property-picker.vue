<template>
	<div class="flex flex-wrap gap-2 items-center">
		<el-select v-model="deviceId" filterable clearable placeholder="Device" class="w-52" @change="onDevice">
			<el-option v-for="device in devices" :key="device.id" :label="device.name" :value="device.id" />
		</el-select>
		<el-select v-model="channelId" filterable clearable placeholder="Channel" class="w-48" :disabled="!deviceId" @change="onChannel">
			<el-option v-for="channel in channels" :key="channel.id" :label="channel.name" :value="channel.id" />
		</el-select>
		<el-select :model-value="modelValue" filterable clearable placeholder="Property" class="w-56" :disabled="!channelId" @change="onProperty">
			<el-option v-for="property in properties" :key="property.id" :label="property.name ?? property.category" :value="property.id" />
		</el-select>
		<el-text v-if="modelValue && !properties.some((property) => property.id === modelValue)" type="warning" size="small">
			Missing or unloaded property: {{ modelValue }}
		</el-text>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { ElOption, ElSelect, ElText } from 'element-plus';

import { injectStoresManager } from '../../../common';
import type { IChannel, IChannelProperty, IDevice } from '../../../modules/devices';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';

const props = defineProps<{ modelValue: string | null; ownerDeviceId?: string; kind: 'ambient' | 'floor' | 'contact' | 'actuator' | 'setting' }>();
const emit = defineEmits<{ (event: 'update:modelValue', value: string | null): void }>();
const stores = injectStoresManager();
const devicesStore = stores.getStore(devicesStoreKey);
const channelsStore = stores.getStore(channelsStoreKey);
const propertiesStore = stores.getStore(channelsPropertiesStoreKey);
const deviceId = ref<string | null>(props.ownerDeviceId ?? null);
const channelId = ref<string | null>(null);

const devices = computed<IDevice[]>(() => props.ownerDeviceId
	? devicesStore.findAll().filter((device) => device.id === props.ownerDeviceId)
	: devicesStore.findAll().filter((device) => device.id !== props.ownerDeviceId));
const channels = computed<IChannel[]>(() => deviceId.value ? channelsStore.findForDevice(deviceId.value) : []);
const properties = computed<IChannelProperty[]>(() => channelId.value
	? propertiesStore.findForChannel(channelId.value).filter((property) => {
		if (props.kind === 'setting') return true;
		if (props.kind === 'actuator') return property.dataType === 'bool';
		if (props.kind === 'contact') return ['bool', 'string', 'enum', 'uchar', 'int'].includes(property.dataType);
		return property.category === 'temperature' && ['float', 'int', 'uchar'].includes(property.dataType);
	})
	: []);

const onDevice = (value: string | null): void => {
	deviceId.value = value;
	channelId.value = null;
	emit('update:modelValue', null);
	if (value) void channelsStore.fetch({ deviceId: value });
};
const onChannel = (value: string | null): void => {
	channelId.value = value;
	emit('update:modelValue', null);
	if (value) void propertiesStore.fetch({ channelId: value });
};
const onProperty = (value: string | null): void => emit('update:modelValue', value);

const resolveCurrent = async (): Promise<void> => {
	if (!props.modelValue) return;
	let property = propertiesStore.findById(props.modelValue);
	if (!property) {
		// Configuration only retains the property UUID. Rehydrate its device/channel
		// path so existing cross-device bindings remain visible when the editor opens.
		const candidates = props.ownerDeviceId
			? devicesStore.findAll().filter((device) => device.id === props.ownerDeviceId)
			: devicesStore.findAll().filter((device) => device.id !== props.ownerDeviceId);
		for (const device of candidates) {
			await channelsStore.fetch({ deviceId: device.id });
			for (const channel of channelsStore.findForDevice(device.id)) {
				await propertiesStore.fetch({ channelId: channel.id });
				property = propertiesStore.findById(props.modelValue);
				if (property) break;
			}
			if (property) break;
		}
	}
	if (!property) return;
	const channel = channelsStore.findById(property.channel);
	if (!channel) return;
	deviceId.value = channel.device;
	channelId.value = channel.id;
	await propertiesStore.fetch({ channelId: channel.id });
};

onMounted(async () => {
	if (!devicesStore.firstLoadFinished()) await devicesStore.fetch();
	if (props.ownerDeviceId) await channelsStore.fetch({ deviceId: props.ownerDeviceId });
	await resolveCurrent();
});
watch(() => props.modelValue, () => { void resolveCurrent(); });
</script>
