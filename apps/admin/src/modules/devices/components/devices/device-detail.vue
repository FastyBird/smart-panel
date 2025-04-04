<template>
	<dl class="grid m-0">
		<dt
			class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('devicesModule.texts.devices.channels') }}
		</dt>
		<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
			<el-text>
				<i18n-t
					keypath="devicesModule.texts.devices.channelsCount"
					:plural="channels.length"
				>
					<template #count>
						<strong>{{ channels.length }}</strong>
					</template>
				</i18n-t>
			</el-text>
		</dd>
		<dt
			class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('devicesModule.texts.devices.status') }}
		</dt>
		<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
			<el-text>
				<el-tag
					:type="stateColor"
					size="small"
				>
					{{ t(`devicesModule.states.${deviceState.toLowerCase()}`) }}
				</el-tag>
			</el-text>
		</dd>
		<device-detail-description
			v-if="deviceInfoChannel"
			:device="device"
			:channel="deviceInfoChannel"
		/>
		<dt
			class="b-r b-r-solid py-1 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('devicesModule.texts.devices.alerts') }}
		</dt>
		<dd class="col-start-2 m-0 p-2 flex items-center min-w-[8rem]">
			<el-text>
				<el-tag
					size="small"
					:type="alerts.length === 0 ? 'success' : 'danger'"
				>
					<i18n-t
						keypath="devicesModule.texts.devices.alertsCount"
						:plural="alerts.length"
					>
						<template #count>
							<strong>{{ alerts.length }}</strong>
						</template>
					</i18n-t>
				</el-tag>
			</el-text>
		</dd>
	</dl>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { I18nT, useI18n } from 'vue-i18n';

import { ElTag, ElText } from 'element-plus';

import { DevicesChannelCategory } from '../../../../openapi';
import { useChannels, useDeviceState } from '../../composables';
import { ConnectionState, type StateColor } from '../../devices.constants';
import type { IChannel } from '../../store';

import DeviceDetailDescription from './device-detail-description.vue';
import type { IDeviceDetailProps } from './device-detail.types';

defineOptions({
	name: 'DeviceDetail',
});

const props = defineProps<IDeviceDetailProps>();

const { t } = useI18n();

const { state: deviceState } = useDeviceState({ device: props.device });
const { channels } = useChannels({ deviceId: props.device.id });

const alerts: string[] = [];

const deviceInfoChannel = computed<IChannel | undefined>((): IChannel | undefined => {
	return channels.value.find((channel) => channel.category === DevicesChannelCategory.device_information);
});

const stateColor = computed<StateColor>((): StateColor => {
	if ([ConnectionState.UNKNOWN].includes(deviceState.value)) {
		return undefined;
	}

	if ([ConnectionState.CONNECTED, ConnectionState.READY, ConnectionState.RUNNING].includes(deviceState.value)) {
		return 'success';
	} else if ([ConnectionState.INIT].includes(deviceState.value)) {
		return 'info';
	} else if ([ConnectionState.DISCONNECTED, ConnectionState.STOPPED, ConnectionState.SLEEPING].includes(deviceState.value)) {
		return 'warning';
	}

	return 'danger';
});
</script>
