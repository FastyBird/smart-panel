<template>
	<template v-if="hasClimateDevices">
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('spacesModule.detail.climateOverrides.title') }}
		</dt>
		<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center gap-2 flex-wrap min-w-[8rem]">
			<el-popover
				placement="bottom"
				:width="400"
				trigger="click"
			>
				<template #reference>
					<div class="flex items-center gap-2 cursor-pointer hover:opacity-70">
						<el-text class="text-sm">
							{{ summaryText }}
						</el-text>
						<el-icon class="text-gray-400">
							<icon icon="mdi:chevron-down" />
						</el-icon>
					</div>
				</template>
				<div class="space-y-3">
					<el-alert
						type="info"
						:closable="false"
						show-icon
						class="mb-3!"
					>
						<template #title>
							{{ t('spacesModule.detail.climateOverrides.popoverTitle') }}
						</template>
						{{ t('spacesModule.detail.climateOverrides.popoverDescription') }}
					</el-alert>

					<div class="space-y-2">
						<!-- Primary Thermostat -->
						<div v-if="thermostatDevices.length > 0" class="flex items-start gap-3 py-2 border-b border-gray-100">
							<el-icon :size="20" class="text-gray-500 mt-0.5">
								<icon icon="mdi:thermostat" />
							</el-icon>
							<div class="flex-1">
								<div class="text-sm font-medium text-gray-700">
									{{ t('spacesModule.detail.climateOverrides.primaryThermostat') }}
								</div>
								<div class="text-sm text-gray-600">
									{{ thermostatDisplayName }}
								</div>
							</div>
						</div>

						<!-- Temperature Sensor -->
						<div v-if="temperatureSensorDevices.length > 0" class="flex items-start gap-3 py-2">
							<el-icon :size="20" class="text-gray-500 mt-0.5">
								<icon icon="mdi:thermometer" />
							</el-icon>
							<div class="flex-1">
								<div class="text-sm font-medium text-gray-700">
									{{ t('spacesModule.detail.climateOverrides.temperatureSensor') }}
								</div>
								<div class="text-sm text-gray-600">
									{{ temperatureSensorDisplayName }}
								</div>
							</div>
						</div>
					</div>
				</div>
			</el-popover>
		</dd>
	</template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { Icon } from '@iconify/vue';
import { ElAlert, ElIcon, ElPopover, ElText } from 'element-plus';
import { useI18n } from 'vue-i18n';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { DevicesModuleChannelCategory, DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_MODULE_PREFIX } from '../../devices/devices.constants';
import { SPACES_MODULE_PREFIX } from '../spaces.constants';

import type { IClimateDevice, IDeviceChannel, ISpaceClimateOverridesSummaryProps } from './space-climate-overrides-summary.types';

defineOptions({
	name: 'SpaceClimateOverridesSummary',
});

const props = defineProps<ISpaceClimateOverridesSummaryProps>();

const { t } = useI18n();
const backend = useBackend();

const loading = ref(false);
const spaceDevices = ref<IClimateDevice[]>([]);

// Helper to sort devices by createdAt (oldest first)
const sortByCreatedAt = (devices: IClimateDevice[]): IClimateDevice[] =>
	[...devices].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

// Filter devices by category (same logic as space-edit-form), sorted by createdAt
const thermostatDevices = computed(() =>
	sortByCreatedAt(spaceDevices.value.filter(d => d.category === DevicesModuleDeviceCategory.thermostat))
);

const sensorDevices = computed(() =>
	sortByCreatedAt(spaceDevices.value.filter(d => d.category === DevicesModuleDeviceCategory.sensor))
);

// Temperature sensor devices: thermostats (always have temp) OR sensors with temperature channel, sorted by createdAt
const temperatureSensorDevices = computed(() => {
	const thermostats = thermostatDevices.value;
	const sensorsWithTemp = sensorDevices.value.filter(d =>
		d.channels.some(ch => ch.category === DevicesModuleChannelCategory.temperature)
	);
	return sortByCreatedAt([...thermostats, ...sensorsWithTemp]);
});

// All climate-capable devices (for showing/hiding the section) - same as space-edit-form
const climateDevices = computed(() =>
	[...thermostatDevices.value, ...sensorDevices.value]
);

// Check if there are any climate devices in the space
const hasClimateDevices = computed<boolean>(() => climateDevices.value.length > 0);

// Get configured thermostat or first available
const selectedThermostat = computed<IClimateDevice | null>(() => {
	if (props.space?.primaryThermostatId) {
		return thermostatDevices.value.find(d => d.id === props.space.primaryThermostatId) ?? null;
	}
	return thermostatDevices.value[0] ?? null;
});

// Get configured temperature sensor or first available (with temperature channel)
const selectedTemperatureSensor = computed<IClimateDevice | null>(() => {
	if (props.space?.primaryTemperatureSensorId) {
		return temperatureSensorDevices.value.find(d => d.id === props.space.primaryTemperatureSensorId) ?? null;
	}
	return temperatureSensorDevices.value[0] ?? null;
});

// Display name for thermostat (shows "Auto-detected" if not explicitly configured)
const thermostatDisplayName = computed<string>(() => {
	if (props.space?.primaryThermostatId && selectedThermostat.value) {
		return selectedThermostat.value.name;
	}
	if (selectedThermostat.value) {
		return `${t('spacesModule.detail.climateOverrides.autoDetected')} (${selectedThermostat.value.name})`;
	}
	return t('spacesModule.detail.climateOverrides.notConfigured');
});

// Display name for temperature sensor (shows "Auto-detected" if not explicitly configured)
const temperatureSensorDisplayName = computed<string>(() => {
	if (props.space?.primaryTemperatureSensorId && selectedTemperatureSensor.value) {
		return selectedTemperatureSensor.value.name;
	}
	if (selectedTemperatureSensor.value) {
		return `${t('spacesModule.detail.climateOverrides.autoDetected')} (${selectedTemperatureSensor.value.name})`;
	}
	return t('spacesModule.detail.climateOverrides.notConfigured');
});

// Generate summary text for the inline display
const summaryText = computed<string>(() => {
	const parts: string[] = [];

	if (thermostatDevices.value.length > 0) {
		const name = props.space?.primaryThermostatId && selectedThermostat.value
			? selectedThermostat.value.name
			: t('spacesModule.detail.climateOverrides.autoDetected');
		parts.push(`${t('spacesModule.detail.climateOverrides.primaryThermostat')}: ${name}`);
	}

	if (temperatureSensorDevices.value.length > 0) {
		const name = props.space?.primaryTemperatureSensorId && selectedTemperatureSensor.value
			? selectedTemperatureSensor.value.name
			: t('spacesModule.detail.climateOverrides.autoDetected');
		parts.push(`${t('spacesModule.detail.climateOverrides.temperatureSensor')}: ${name}`);
	}

	return parts.join(' · ');
});

// Load channels for a specific device
const loadDeviceChannels = async (deviceId: string): Promise<IDeviceChannel[]> => {
	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/{deviceId}/channels`,
			{ params: { path: { deviceId } } }
		);

		if (error || !responseData) {
			return [];
		}

		return (responseData.data ?? []).map((channel) => ({
			id: channel.id,
			category: channel.category as DevicesModuleChannelCategory,
		}));
	} catch {
		return [];
	}
};

const loadSpaceDevices = async (): Promise<void> => {
	if (!props.space?.id) return;

	loading.value = true;

	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/devices`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			return;
		}

		// Map devices with empty channels initially
		const devices: IClimateDevice[] = (responseData.data ?? []).map((device) => ({
			id: device.id,
			name: device.name,
			category: device.category as DevicesModuleDeviceCategory,
			channels: [],
			createdAt: new Date(device.created_at),
		}));

		// Load channels for sensor devices to check for temperature channel
		const sensorDevicesTemp = devices.filter(d => d.category === DevicesModuleDeviceCategory.sensor);

		await Promise.all(
			sensorDevicesTemp.map(async (device) => {
				device.channels = await loadDeviceChannels(device.id);
			})
		);

		spaceDevices.value = devices;
	} finally {
		loading.value = false;
	}
};

watch(
	() => props.space?.id,
	(newId) => {
		if (newId) {
			loadSpaceDevices();
		}
	}
);

onMounted(() => {
	if (props.space?.id) {
		loadSpaceDevices();
	}
});
</script>
