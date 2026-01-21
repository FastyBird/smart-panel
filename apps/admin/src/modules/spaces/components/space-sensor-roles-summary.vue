<template>
	<template v-if="hasTargets">
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('spacesModule.detail.sensorRoles.title') }}
		</dt>
		<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center justify-between min-w-[8rem]">
			<!-- Show role tags when roles are assigned -->
			<div v-if="roleSummaries.length > 0" class="flex items-center gap-2 flex-wrap">
				<el-popover
					v-for="summary in roleSummaries"
					:key="summary.role"
					placement="bottom"
					:width="400"
					trigger="click"
				>
					<template #reference>
						<el-tag
							:type="getRoleTagType(summary.role)"
							size="small"
							class="cursor-pointer"
						>
							<div class="flex items-center gap-1">
								<icon :icon="getRoleIcon(summary.role)" />
								{{ t(`spacesModule.sensorRoles.${summary.role}`) }}
								<el-badge
									:value="summary.sensors.length"
									:type="getRoleTagType(summary.role)"
									class="ml-1"
								/>
							</div>
						</el-tag>
					</template>
					<div class="space-y-2">
						<el-alert
							type="info"
							:closable="false"
							show-icon
							class="mb-2!"
						>
							{{ t(`spacesModule.sensorRoles.descriptions.${summary.role}`) }}
						</el-alert>
						<div class="text-sm font-medium mb-1">
							{{ t('spacesModule.detail.sensorRoles.sensorsAssigned') }}:
						</div>
						<ul class="list-none p-0 m-0 space-y-1">
							<li
								v-for="sensor in summary.sensors"
								:key="`${sensor.deviceId}-${sensor.channelId}`"
								class="flex items-center gap-2 text-sm py-1"
							>
								<icon :icon="getChannelIcon(sensor.channelCategory)" class="text-gray-400" />
								<span>{{ sensor.deviceName }} — {{ sensor.channelName }}</span>
							</li>
						</ul>
					</div>
				</el-popover>
			</div>
			<!-- Show hint when no roles assigned yet -->
			<div v-else class="flex items-center gap-2 text-gray-400 text-sm">
				<icon icon="mdi:chart-bell-curve" />
				{{ t('spacesModule.detail.sensorRoles.noRolesAssigned') }}
			</div>
			<el-button
				text
				size="small"
				class="ml-2"
				@click="emit('edit')"
			>
				<template #icon>
					<icon icon="mdi:pencil" />
				</template>
				{{ t('spacesModule.buttons.edit.title') }}
			</el-button>
		</dd>
	</template>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import { Icon } from '@iconify/vue';
import { ElAlert, ElBadge, ElButton, ElPopover, ElTag } from 'element-plus';
import { useI18n } from 'vue-i18n';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { useSpacesRefreshSignals } from '../composables';
import { SENSOR_ROLE_ORDER, SensorRole, SPACES_MODULE_PREFIX } from '../spaces.constants';

import type { ISensorRoleSummary, ISpaceSensorRolesSummaryProps } from './space-sensor-roles-summary.types';

defineOptions({
	name: 'SpaceSensorRolesSummary',
});

const props = defineProps<ISpaceSensorRolesSummaryProps>();

const emit = defineEmits<{
	(e: 'edit'): void;
}>();

const { t } = useI18n();
const backend = useBackend();
const { sensorSignal } = useSpacesRefreshSignals();

const loading = ref(false);
const roleSummaries = ref<ISensorRoleSummary[]>([]);
const hasTargets = ref(false);

const getRoleTagType = (role: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
	switch (role) {
		case SensorRole.ENVIRONMENT:
			return 'success';
		case SensorRole.SAFETY:
			return 'danger';
		case SensorRole.SECURITY:
			return 'warning';
		case SensorRole.AIR_QUALITY:
			return 'info';
		case SensorRole.ENERGY:
			return 'primary';
		case SensorRole.OTHER:
		case SensorRole.HIDDEN:
		default:
			return 'info';
	}
};

const getRoleIcon = (role: string): string => {
	switch (role) {
		case SensorRole.ENVIRONMENT:
			return 'mdi:thermometer';
		case SensorRole.SAFETY:
			return 'mdi:shield-alert';
		case SensorRole.SECURITY:
			return 'mdi:motion-sensor';
		case SensorRole.AIR_QUALITY:
			return 'mdi:air-filter';
		case SensorRole.ENERGY:
			return 'mdi:lightning-bolt';
		case SensorRole.HIDDEN:
			return 'mdi:eye-off';
		case SensorRole.OTHER:
		default:
			return 'mdi:chart-line';
	}
};

const getChannelIcon = (category: string): string => {
	switch (category) {
		case 'temperature':
			return 'mdi:thermometer';
		case 'humidity':
			return 'mdi:water-percent';
		case 'pressure':
			return 'mdi:gauge';
		case 'illuminance':
			return 'mdi:weather-sunny';
		case 'smoke':
		case 'gas':
		case 'carbon_monoxide':
		case 'carbon_dioxide':
			return 'mdi:alert';
		case 'leak':
			return 'mdi:water-alert';
		case 'motion':
		case 'occupancy':
			return 'mdi:walk';
		case 'contact':
			return 'mdi:door-closed';
		case 'air_quality':
		case 'air_particulate':
		case 'nitrogen_dioxide':
		case 'ozone':
		case 'sulphur_dioxide':
		case 'volatile_organic_compounds':
			return 'mdi:air-filter';
		case 'electrical_energy':
		case 'electrical_power':
			return 'mdi:lightning-bolt';
		case 'battery':
			return 'mdi:battery';
		default:
			return 'mdi:chart-bell-curve';
	}
};

const loadSensorRoles = async (): Promise<void> => {
	if (!props.space?.id) return;

	loading.value = true;

	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/sensors/targets`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			hasTargets.value = false;
			return;
		}

		const targets = responseData.data ?? [];
		hasTargets.value = targets.length > 0;

		const roleMap = new Map<string, ISensorRoleSummary>();

		for (const target of targets) {
			// Skip unassigned and hidden sensors in the summary list
			if (!target.role || (target.role as string) === SensorRole.HIDDEN) continue;

			const role = target.role as string;

			if (!roleMap.has(role)) {
				roleMap.set(role, {
					role,
					sensors: [],
				});
			}

			roleMap.get(role)!.sensors.push({
				deviceId: target.device_id,
				deviceName: target.device_name,
				channelId: target.channel_id,
				channelName: target.channel_name ?? target.channel_category,
				channelCategory: target.channel_category,
			});
		}

		roleSummaries.value = Array.from(roleMap.values()).sort((a, b) => {
			const aIndex = SENSOR_ROLE_ORDER.indexOf(a.role as SensorRole);
			const bIndex = SENSOR_ROLE_ORDER.indexOf(b.role as SensorRole);
			return aIndex - bIndex;
		});
	} finally {
		loading.value = false;
	}
};

watch(
	() => props.space?.id,
	(newId) => {
		if (newId) {
			loadSensorRoles();
		}
	}
);

// Watch for sensor refresh signal from websocket events
watch(
	() => sensorSignal?.value,
	() => {
		if (props.space?.id) {
			loadSensorRoles();
		}
	}
);

onMounted(() => {
	if (props.space?.id) {
		loadSensorRoles();
	}
});

defineExpose({
	reload: loadSensorRoles,
});
</script>
