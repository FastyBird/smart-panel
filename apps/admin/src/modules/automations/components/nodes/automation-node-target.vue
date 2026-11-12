<template>
	<device-property-picker
		:device-id="props.deviceId"
		:channel-id="props.channelId"
		:property-id="props.propertyId"
		:access="props.access"
		:property-filter="props.propertyFilter"
		:device-prop="`${props.prefix}device_id`"
		:channel-prop="`${props.prefix}channel_id`"
		:property-prop="`${props.prefix}property_id`"
		@update:device-id="onDevice"
		@update:channel-id="onChannel"
		@update:property-id="onProperty"
	/>

	<el-text
		v-for="(error, index) in props.errors"
		:key="index"
		tag="div"
		type="danger"
		size="small"
		class="leading-4! mt--2 mb-3"
		data-test-id="target-error"
	>
		{{ error }}
	</el-text>
</template>

<script setup lang="ts">
/*
 * The device, channel and property a card points at, picked with the picker the scene actions use. The
 * three ids are stored together (ADR 0003, decision 17). A change is reported once, as the fields it
 * sets: picking another device clears the channel and the property, picking another channel clears the
 * property - the picker reports those as separate updates, which would each start from the old ids.
 */
import { ElText } from 'element-plus';

import DevicePropertyPicker from '../../../devices/components/devices/device-property-picker.vue';

import type { IAutomationNodeTargetProps } from './automation-node-target.types';

defineOptions({
	name: 'AutomationNodeTarget',
});

const props = withDefaults(defineProps<IAutomationNodeTargetProps>(), {
	access: undefined,
	propertyFilter: undefined,
	prefix: '',
	errors: () => [],
});

const emit = defineEmits<{
	(e: 'change', patch: { device_id?: string; channel_id?: string; property_id?: string }, field: 'device' | 'channel' | 'property'): void;
}>();

const onDevice = (deviceId: string): void => {
	if (deviceId !== props.deviceId) {
		emit('change', { device_id: deviceId, channel_id: undefined, property_id: undefined }, 'device');
	}
};

// Null is the picker clearing what lies below a new choice, already done above
const onChannel = (channelId: string | null): void => {
	if (channelId !== null && channelId !== props.channelId) {
		emit('change', { channel_id: channelId, property_id: undefined }, 'channel');
	}
};

const onProperty = (propertyId: string | null): void => {
	if (propertyId !== null && propertyId !== props.propertyId) {
		emit('change', { property_id: propertyId }, 'property');
	}
};
</script>
