<template>
	<!-- The status section cards of the system info page: hardware, power and temperature, the operating system and the
	     network -->
	<settings-section
		id="hardware"
		:title="t('systemModule.headings.system.hardware')"
		icon="mdi:chip"
	>
		<kv-grid
			:items="hardware"
			:cols="2"
		/>
	</settings-section>

	<settings-section
		id="power"
		:title="t('systemModule.headings.system.power')"
		:description="t('systemModule.subHeadings.power')"
		icon="mdi:flash-alert-outline"
	>
		<ul
			class="flex flex-col m-0 p-0 list-none"
			data-test-id="system-info-power"
		>
			<li
				v-for="(flag, index) in THROTTLE_FLAGS"
				:key="flag"
				:class="['flex items-center justify-between gap-4 py-2.5', index > 0 ? 'border-t border-t-solid border-light' : '']"
				:data-flag="flag"
			>
				<span class="text-body">{{ t(`systemModule.systemInfo.${flag}`) }}</span>
				<status-tag
					v-if="props.throttleStatus"
					:status="props.throttleStatus[flag] ? 'danger' : 'ok'"
					:label="props.throttleStatus[flag] ? t('systemModule.states.error') : t('systemModule.states.ok')"
				/>
				<span
					v-else
					class="text-secondary"
				>
					{{ t('application.value.notAvailable') }}
				</span>
			</li>
		</ul>
	</settings-section>

	<settings-section
		id="os"
		:title="t('systemModule.headings.system.os')"
		icon="mdi:server-outline"
	>
		<kv-grid
			:items="os"
			:cols="2"
		/>
	</settings-section>

	<settings-section
		id="network"
		:title="t('systemModule.headings.system.network')"
		icon="mdi:local-area-network"
	>
		<kv-grid
			:items="network"
			:cols="2"
		/>
	</settings-section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { KvGrid, type KvGridItem, SettingsSection, StatusTag, useNumberFormat } from '../../../../common';
import type { IThrottleStatus } from '../../store/throttle-status.store.types';
import { formatUptime } from '../../utils/system.utils';

import type { ISystemInfoDetailProps } from './system-info-detail.types';

defineOptions({
	name: 'SystemInfoDetail',
});

const props = defineProps<ISystemInfoDetailProps>();

const { t } = useI18n();
const { format } = useNumberFormat();

const THROTTLE_FLAGS: (keyof IThrottleStatus)[] = ['undervoltage', 'frequencyCapping', 'throttling', 'softTempLimit'];

const megabytes = (bytes: number): string => `${format(bytes / 1024 / 1024, { maximumFractionDigits: 0 })} MB`;

const temperature = (value: number | null | undefined): string | null =>
	value === null || value === undefined ? null : `${format(value, { maximumFractionDigits: 1 })} °C`;

const hardware = computed<KvGridItem[]>(() => {
	const info = props.systemInfo;

	return [
		{
			label: t('systemModule.systemInfo.cpuLoad'),
			value: info ? `${format(info.cpuLoad, { maximumFractionDigits: 2 })} %` : null,
		},
		{
			label: t('systemModule.systemInfo.memoryUsage'),
			value: info ? `${megabytes(info.memory.used)} / ${megabytes(info.memory.total)}` : null,
		},
		{ label: t('systemModule.systemInfo.cpuTemperature'), value: temperature(info?.temperature.cpu) },
		{ label: t('systemModule.systemInfo.gpuTemperature'), value: temperature(info?.temperature.gpu) },
	];
});

const os = computed<KvGridItem[]>(() => [
	{ label: t('systemModule.systemInfo.osPlatform'), value: props.systemInfo?.os.platform },
	{ label: t('systemModule.systemInfo.osDistro'), value: props.systemInfo?.os.distro },
	{ label: t('systemModule.systemInfo.osRelease'), value: props.systemInfo?.os.release, mono: true },
	{ label: t('systemModule.systemInfo.uptime'), value: formatUptime(props.systemInfo?.os.uptime), mono: true },
]);

const network = computed<KvGridItem[]>(() => [
	{ label: t('systemModule.systemInfo.networkInterface'), value: props.systemInfo?.defaultNetwork.interface, mono: true },
	{ label: t('systemModule.systemInfo.ip4Address'), value: props.systemInfo?.defaultNetwork.ip4, mono: true },
	{ label: t('systemModule.systemInfo.ip6Address'), value: props.systemInfo?.defaultNetwork.ip6, mono: true },
	{ label: t('systemModule.systemInfo.macAddress'), value: props.systemInfo?.defaultNetwork.mac, mono: true },
]);
</script>
