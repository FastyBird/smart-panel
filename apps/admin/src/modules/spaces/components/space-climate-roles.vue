<template>
	<div class="mt-2">
		<el-divider content-position="left" class="mt-6!">
			{{ t('spacesModule.edit.sections.smartOverrides.climateRoles') }}
		</el-divider>

		<el-alert
			type="info"
			:closable="false"
			show-icon
			class="mb-4!"
		>
			{{ t('spacesModule.fields.spaces.climateRoles.description') }}
		</el-alert>

		<div v-if="loading" class="flex justify-center py-4">
			<icon icon="mdi:loading" class="animate-spin text-2xl" />
		</div>

		<template v-else-if="climateTargets.length > 0">
			<el-table :data="climateTargets" border>
				<el-table-column prop="deviceName" :label="t('spacesModule.onboarding.deviceName')" min-width="180">
					<template #default="{ row }">
						<div class="flex items-center gap-2">
							<icon :icon="getDeviceIcon(row.deviceCategory)" />
							<div class="flex flex-col">
								<span>{{ row.deviceName }}</span>
								<span v-if="row.channelName" class="text-xs text-gray-400">{{ row.channelName }}</span>
							</div>
						</div>
					</template>
				</el-table-column>

				<el-table-column :label="t('spacesModule.fields.spaces.climateRoles.role.title')" width="200">
					<template #default="{ row }">
						<el-select
							:model-value="row.role ?? ''"
							:placeholder="t('spacesModule.fields.spaces.climateRoles.role.placeholder')"
							clearable
							@update:model-value="onRoleChange(row, $event)"
						>
							<el-option
								v-for="role in getRoleOptions(row)"
								:key="role.value"
								:label="role.label"
								:value="role.value"
							/>
						</el-select>
					</template>
				</el-table-column>

				<el-table-column label="" width="120">
					<template #default="{ row }">
						<div class="flex gap-1">
							<el-tag v-if="row.hasTemperature" type="warning" size="small">Temp</el-tag>
							<el-tag v-if="row.hasHumidity" type="info" size="small">Humid</el-tag>
							<el-tag v-if="row.hasMode" type="success" size="small">Mode</el-tag>
						</div>
					</template>
				</el-table-column>
			</el-table>

			<div class="flex justify-between items-center mt-4">
				<el-button size="small" :loading="applyingDefaults" @click="onApplyDefaults">
					{{ t('spacesModule.fields.spaces.climateRoles.applyDefaults') }}
				</el-button>
				<div class="text-xs text-gray-400">
					{{ t('spacesModule.fields.spaces.climateRoles.applyDefaultsHint') }}
				</div>
			</div>
		</template>

		<el-result v-else>
			<template #icon>
				<icon-with-child :size="80">
					<template #primary>
						<icon icon="mdi:thermostat" />
					</template>
					<template #secondary>
						<icon icon="mdi:information" />
					</template>
				</icon-with-child>
			</template>

			<template #title>
				{{ t('spacesModule.fields.spaces.climateRoles.noDevices') }}
			</template>
		</el-result>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { Icon } from '@iconify/vue';
import { ElAlert, ElButton, ElDivider, ElOption, ElResult, ElSelect, ElTable, ElTableColumn, ElTag } from 'element-plus';
import { useI18n } from 'vue-i18n';

import { IconWithChild, useBackend, useFlashMessage } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { ClimateRole, SPACES_MODULE_PREFIX } from '../spaces.constants';
import type { ISpace } from '../store';

interface IClimateTarget {
	deviceId: string;
	deviceName: string;
	deviceCategory: string;
	channelId: string | null;
	channelName: string | null;
	role: ClimateRole | null;
	priority: number;
	hasTemperature: boolean;
	hasHumidity: boolean;
	hasMode: boolean;
}

interface IProps {
	space: ISpace;
}

const props = defineProps<IProps>();

const { t } = useI18n();
const backend = useBackend();
const flashMessage = useFlashMessage();

const loading = ref(false);
const applyingDefaults = ref(false);
const climateTargets = ref<IClimateTarget[]>([]);

// Control roles for actuator devices
const controlRoleOptions = computed(() => [
	{ value: ClimateRole.PRIMARY, label: t('spacesModule.climateRoles.primary') },
	{ value: ClimateRole.AUXILIARY, label: t('spacesModule.climateRoles.auxiliary') },
	{ value: ClimateRole.VENTILATION, label: t('spacesModule.climateRoles.ventilation') },
	{ value: ClimateRole.HUMIDITY_CONTROL, label: t('spacesModule.climateRoles.humidityControl') },
	{ value: ClimateRole.OTHER, label: t('spacesModule.climateRoles.other') },
	{ value: ClimateRole.HIDDEN, label: t('spacesModule.climateRoles.hidden') },
]);

// Sensor roles for sensor device channels
const sensorRoleOptions = computed(() => [
	{ value: ClimateRole.TEMPERATURE_SENSOR, label: t('spacesModule.climateRoles.temperatureSensor') },
	{ value: ClimateRole.HUMIDITY_SENSOR, label: t('spacesModule.climateRoles.humiditySensor') },
	{ value: ClimateRole.HIDDEN, label: t('spacesModule.climateRoles.hidden') },
]);

// Get role options based on device category
const getRoleOptions = (target: IClimateTarget) => {
	return target.deviceCategory === 'sensor' ? sensorRoleOptions.value : controlRoleOptions.value;
};

const getDeviceIcon = (category: string): string => {
	switch (category) {
		case 'thermostat':
			return 'mdi:thermostat';
		case 'heater':
			return 'mdi:radiator';
		case 'air_conditioner':
			return 'mdi:air-conditioner';
		case 'fan':
			return 'mdi:fan';
		case 'air_humidifier':
			return 'mdi:air-humidifier';
		case 'air_dehumidifier':
			return 'mdi:air-humidifier-off';
		case 'air_purifier':
			return 'mdi:air-purifier';
		case 'sensor':
			return 'mdi:thermometer';
		default:
			return 'mdi:thermostat-box';
	}
};

const loadClimateTargets = async (): Promise<void> => {
	loading.value = true;
	climateTargets.value = [];

	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/climate/targets`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			return;
		}

		climateTargets.value = (responseData.data ?? []).map((target) => ({
			deviceId: target.device_id,
			deviceName: target.device_name,
			deviceCategory: target.device_category ?? '',
			channelId: target.channel_id ?? null,
			channelName: target.channel_name ?? null,
			role: target.role ? (target.role as unknown as ClimateRole) : null,
			priority: target.priority ?? 0,
			hasTemperature: target.has_temperature ?? false,
			hasHumidity: target.has_humidity ?? false,
			hasMode: target.has_mode ?? false,
		}));
	} finally {
		loading.value = false;
	}
};

const onRoleChange = async (target: IClimateTarget, newRole: string): Promise<void> => {
	try {
		if (newRole === '') {
			// Clear role - delete the assignment
			const { error } = await backend.client.DELETE(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/climate/roles/{deviceId}`,
				{
					params: {
						path: {
							id: props.space.id,
							deviceId: target.deviceId,
						},
					},
				}
			);

			if (error) {
				flashMessage.error('Failed to clear climate role');
				return;
			}

			target.role = null;
		} else {
			// Build the role assignment payload
			// Sensor roles require channel_id, actuator roles must not have it
			const roleData: { device_id: string; role: never; channel_id?: string } = {
				device_id: target.deviceId,
				// Type assertion needed: ClimateRole values match OpenAPI generated enum at runtime
				role: newRole as never,
			};

			// For sensor targets, include the channel_id
			if (target.channelId) {
				roleData.channel_id = target.channelId;
			}

			// Set role
			const { error } = await backend.client.POST(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/climate/roles`,
				{
					params: { path: { id: props.space.id } },
					body: { data: roleData },
				}
			);

			if (error) {
				flashMessage.error('Failed to update climate role');
				return;
			}

			target.role = newRole as ClimateRole;
		}
	} catch {
		flashMessage.error('Failed to update climate role');
	}
};

const onApplyDefaults = async (): Promise<void> => {
	applyingDefaults.value = true;

	try {
		const { data: responseData, error } = await backend.client.POST(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/climate/roles/defaults`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			flashMessage.error('Failed to apply default roles');
			return;
		}

		// Reload the targets to reflect the new roles
		await loadClimateTargets();

		flashMessage.success(`Applied ${responseData.data?.success_count ?? 0} default role(s)`);
	} finally {
		applyingDefaults.value = false;
	}
};

watch(
	() => props.space?.id,
	(newId) => {
		if (newId) {
			loadClimateTargets();
		}
	}
);

onMounted(() => {
	if (props.space?.id) {
		loadClimateTargets();
	}
});
</script>
