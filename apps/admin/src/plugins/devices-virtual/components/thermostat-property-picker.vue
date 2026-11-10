<template>
	<div class="flex flex-wrap gap-2 items-center">
		<el-select
			v-model="deviceId"
			filterable
			clearable
			:placeholder="t('devicesVirtualPlugin.thermostat.picker.device')"
			class="w-52"
			@change="onDevice"
		>
			<el-option
				v-for="device in devices"
				:key="device.id"
				:label="device.name"
				:value="device.id"
			/>
		</el-select>
		<el-select
			v-model="channelId"
			filterable
			clearable
			:placeholder="t('devicesVirtualPlugin.thermostat.picker.channel')"
			class="w-48"
			:disabled="!deviceId"
			@change="onChannel"
		>
			<el-option
				v-for="channel in channels"
				:key="channel.id"
				:label="channel.name"
				:value="channel.id"
			/>
		</el-select>
		<el-select
			:model-value="modelValue"
			filterable
			clearable
			:placeholder="t('devicesVirtualPlugin.thermostat.picker.property')"
			class="w-56"
			:disabled="!channelId"
			@change="onProperty"
		>
			<el-option
				v-for="property in properties"
				:key="property.id"
				:label="property.name ?? property.category"
				:value="property.id"
			/>
		</el-select>
		<el-text
			v-if="kind === 'actuator' && !ownerDeviceId && !devices.length"
			type="info"
			size="small"
		>
			{{ t('devicesVirtualPlugin.thermostat.picker.noActuator') }}
		</el-text>
		<el-text
			v-if="modelValue && !properties.some((property) => property.id === modelValue)"
			type="warning"
			size="small"
		>
			{{ t('devicesVirtualPlugin.thermostat.picker.missing', { id: modelValue }) }}
		</el-text>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElOption, ElSelect, ElText } from 'element-plus';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { injectStoresManager, useBackend } from '../../../common';
import type { IChannel, IChannelProperty, IDevice } from '../../../modules/devices';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import { DEVICES_SHELLY_NG_TYPE } from '../../devices-shelly-ng/devices-shelly-ng.constants';
import { DEVICES_VIRTUAL_PLUGIN_PREFIX } from '../devices-virtual.constants';

const props = defineProps<{ modelValue: string | null; ownerDeviceId?: string; kind: 'ambient' | 'floor' | 'contact' | 'actuator' | 'setting' }>();
const emit = defineEmits<{ (event: 'update:modelValue', value: string | null): void }>();
const { t } = useI18n();
const stores = injectStoresManager();
const backend = useBackend();
const devicesStore = stores.getStore(devicesStoreKey);
const channelsStore = stores.getStore(channelsStoreKey);
const propertiesStore = stores.getStore(channelsPropertiesStoreKey);
const deviceId = ref<string | null>(props.ownerDeviceId ?? null);
const channelId = ref<string | null>(null);

// What the backend accepts as a guarded actuator (`thermostatActuatorIdentity` and the config
// service's member check): the writable boolean output of a Shelly NG `switch:N` component, nothing
// else. Offering every boolean of every device let a member be assembled from, say, an over-current
// flag, which the preview then refused with a reason the form did not show.
const isActuatorChannel = (channel: IChannel): boolean => /^switch:\d+$/.test(channel.identifier ?? '');
const isActuatorProperty = (property: IChannelProperty): boolean =>
	property.dataType === 'bool' && property.category === 'on' && ['output', 'on'].includes(property.identifier ?? '');
const devices = computed<IDevice[]>(() =>
	props.ownerDeviceId
		? devicesStore.findAll().filter((device) => device.id === props.ownerDeviceId)
		: devicesStore
				.findAll()
				.filter((device) => device.id !== props.ownerDeviceId && (props.kind !== 'actuator' || device.type === DEVICES_SHELLY_NG_TYPE))
);
const channels = computed<IChannel[]>(() =>
	deviceId.value ? channelsStore.findForDevice(deviceId.value).filter((channel) => props.kind !== 'actuator' || isActuatorChannel(channel)) : []
);
const properties = computed<IChannelProperty[]>(() =>
	channelId.value
		? propertiesStore.findForChannel(channelId.value).filter((property) => {
				if (props.kind === 'setting') return true;
				if (props.kind === 'actuator') return isActuatorProperty(property);
				if (props.kind === 'contact') return ['bool', 'string', 'enum', 'uchar', 'int'].includes(property.dataType);
				return property.category === 'temperature' && ['float', 'int', 'uchar'].includes(property.dataType);
			})
		: []
);

// Choosing a device or channel clears the bound property, and the parent echoes that back as a
// `modelValue` change. Left to the watcher below, that echo re-resolved "no property" and reset the
// device the user had just picked — every time for actuator members, whose empty value is `''` rather
// than `null`, and on any second pick for the other kinds. The picker therefore remembers that the
// empty value is its own and leaves its in-progress device/channel selection alone.
let clearedLocally = false;
const clearProperty = (): void => {
	clearedLocally = true;
	emit('update:modelValue', null);
};
// The devices list already embeds every channel and property and cascades them into these stores,
// so the handlers only fetch when a store genuinely has nothing for the selection.
const onDevice = (value: string | null): void => {
	resolveGeneration++;
	deviceId.value = value;
	channelId.value = null;
	clearProperty();
	if (value && !channelsStore.findForDevice(value).length) void channelsStore.fetch({ deviceId: value });
};
const onChannel = (value: string | null): void => {
	resolveGeneration++;
	channelId.value = value;
	clearProperty();
	if (value && !propertiesStore.findForChannel(value).length) void propertiesStore.fetch({ channelId: value });
};
const onProperty = (value: string | null): void => emit('update:modelValue', value);

let resolveGeneration = 0;
const resolveCurrent = async (): Promise<void> => {
	const generation = ++resolveGeneration;
	const id = props.modelValue;
	const ownerDeviceId = props.ownerDeviceId;
	const current = () => generation === resolveGeneration && props.modelValue === id && props.ownerDeviceId === ownerDeviceId;
	if (!id) {
		deviceId.value = ownerDeviceId ?? null;
		channelId.value = null;
		return;
	}
	try {
		const { data } = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_VIRTUAL_PLUGIN_PREFIX}/producers/thermostats/binding-properties/{id}`, {
			params: { path: { id } },
		});
		if (!current()) return;
		if (!data || data.data.property !== id) throw new Error('Binding property is unavailable.');
		const binding = data.data;
		if (ownerDeviceId && binding.device !== ownerDeviceId) return;
		const channel = channelsStore.findById(binding.channel) ?? (await channelsStore.get({ id: binding.channel }));
		if (!current() || channel.device !== binding.device) return;
		const property = propertiesStore.findById(id) ?? (await propertiesStore.get({ id, channelId: channel.id }));
		if (!current() || property.channel !== channel.id) return;
		deviceId.value = channel.device;
		channelId.value = channel.id;
		await Promise.all([
			channelsStore.fetch({ deviceId: channel.device }).catch(() => undefined),
			propertiesStore.fetch({ channelId: channel.id }).catch(() => undefined),
		]);
	} catch {
		if (!current()) return;
		deviceId.value = ownerDeviceId ?? null;
		channelId.value = null;
	}
};

onMounted(async () => {
	if (!devicesStore.firstLoadFinished()) await devicesStore.fetch();
	if (props.ownerDeviceId && !channelsStore.findForDevice(props.ownerDeviceId).length) await channelsStore.fetch({ deviceId: props.ownerDeviceId });
	await resolveCurrent();
});
watch(
	() => [props.modelValue, props.ownerDeviceId],
	() => {
		const own = clearedLocally && !props.modelValue;
		clearedLocally = false;
		if (own) return;
		void resolveCurrent();
	}
);
onBeforeUnmount(() => {
	resolveGeneration++;
});
</script>
