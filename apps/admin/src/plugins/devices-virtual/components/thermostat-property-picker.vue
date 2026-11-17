<template>
	<div class="thermostat-property-picker">
		<div class="thermostat-property-picker__field">
			<label
				:for="`${pickerId}-device`"
				class="thermostat-property-picker__label"
			>
				{{ t('devicesVirtualPlugin.thermostat.picker.device') }}
			</label>
			<el-select
				:id="`${pickerId}-device`"
				v-model="deviceId"
				:aria-label="t('devicesVirtualPlugin.thermostat.picker.device')"
				filterable
				clearable
				:placeholder="t('devicesVirtualPlugin.thermostat.picker.device')"
				class="w-full"
				@change="onDevice"
			>
				<el-option-group
					v-for="group in deviceGroups"
					:key="group.id"
					:label="group.label"
				>
					<el-option
						v-for="device in group.items"
						:key="device.id"
						:label="device.name"
						:value="device.id"
					/>
				</el-option-group>
			</el-select>
		</div>
		<div class="thermostat-property-picker__field">
			<label
				:for="`${pickerId}-channel`"
				class="thermostat-property-picker__label"
			>
				{{ t('devicesVirtualPlugin.thermostat.picker.channel') }}
			</label>
			<el-select
				:id="`${pickerId}-channel`"
				v-model="channelId"
				:aria-label="t('devicesVirtualPlugin.thermostat.picker.channel')"
				filterable
				clearable
				:placeholder="t('devicesVirtualPlugin.thermostat.picker.channel')"
				class="w-full"
				:disabled="!deviceId"
				@change="onChannel"
			>
				<el-option
					v-for="channel in sortedChannels"
					:key="channel.id"
					:label="channel.name"
					:value="channel.id"
				/>
			</el-select>
		</div>
		<div class="thermostat-property-picker__field">
			<label
				:for="`${pickerId}-property`"
				class="thermostat-property-picker__label"
			>
				{{ t('devicesVirtualPlugin.thermostat.picker.property') }}
			</label>
			<el-select
				:id="`${pickerId}-property`"
				:aria-label="t('devicesVirtualPlugin.thermostat.picker.property')"
				:model-value="modelValue"
				filterable
				clearable
				:placeholder="t('devicesVirtualPlugin.thermostat.picker.property')"
				class="w-full"
				:disabled="!channelId"
				@change="onProperty"
			>
				<el-option
					v-for="property in sortedProperties"
					:key="property.id"
					:label="property.name ?? property.category"
					:value="property.id"
				/>
			</el-select>
		</div>
		<el-text
			v-if="kind === 'actuator' && !ownerDeviceId && !devices.length"
			class="thermostat-property-picker__message"
			size="small"
		>
			{{ t('devicesVirtualPlugin.thermostat.picker.noActuator') }}
		</el-text>
		<el-text
			v-if="modelValue && !properties.some((property) => property.id === modelValue)"
			class="thermostat-property-picker__message"
			type="warning"
			size="small"
		>
			{{ t('devicesVirtualPlugin.thermostat.picker.missing', { id: modelValue }) }}
		</el-text>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElOption, ElOptionGroup, ElSelect, ElText } from 'element-plus';
import { orderBy } from 'natural-orderby';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { injectStoresManager, useBackend } from '../../../common';
import type { IChannel, IChannelProperty, IDevice } from '../../../modules/devices';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import { DEVICES_SHELLY_NG_TYPE } from '../../devices-shelly-ng/devices-shelly-ng.constants';
import { useVirtualWizardSourceGroups } from '../composables/use-virtual-wizard-placement';
import { DEVICES_VIRTUAL_PLUGIN_PREFIX } from '../devices-virtual.constants';

const props = defineProps<{ modelValue: string | null; ownerDeviceId?: string; kind: 'ambient' | 'floor' | 'contact' | 'actuator' | 'setting' }>();
const emit = defineEmits<{ (event: 'update:modelValue', value: string | null): void }>();
const { t } = useI18n();
const pickerId = useId();
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
const groupSources = useVirtualWizardSourceGroups();
const deviceGroups = computed(() => groupSources(orderBy(devices.value, [(device) => device.name], ['asc']), (device) => device));
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

const sortedChannels = computed(() => orderBy(channels.value, [(channel) => channel.name], ['asc']));
const sortedProperties = computed(() => orderBy(properties.value, [(property) => property.name ?? property.category], ['asc']));

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
	(current, previous) => {
		// Only an unchanged owner makes the empty value the picker's own echo: a new owner has to be
		// resolved even while the value stays empty, or the previous owner's selection would remain.
		const own = clearedLocally && !props.modelValue && current[1] === previous[1];
		clearedLocally = false;
		if (own) return;
		void resolveCurrent();
	}
);
onBeforeUnmount(() => {
	resolveGeneration++;
});
</script>

<style scoped>
.thermostat-property-picker {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
	gap: 12px;
	width: 100%;
}
.thermostat-property-picker__field {
	min-width: 0;
}
.thermostat-property-picker__label {
	display: block;
	margin-bottom: 6px;
	font-size: 12px;
	font-weight: 600;
	line-height: 20px;
}
.thermostat-property-picker__message {
	grid-column: 1 / -1;
}
</style>
