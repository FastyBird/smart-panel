<template>
	<template v-if="roleSummaries.length > 0">
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('spacesModule.detail.climateRoles.title') }}
		</dt>
		<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center gap-2 flex-wrap min-w-[8rem]">
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
							{{ t(`spacesModule.climateRoles.${summary.role}`) }}
							<el-badge
								:value="summary.devices.length"
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
						{{ t(`spacesModule.climateRoles.descriptions.${summary.role}`) }}
					</el-alert>
					<div class="text-sm font-medium mb-1">
						{{ t('spacesModule.detail.climateRoles.devicesAssigned') }}:
					</div>
					<ul class="list-none p-0 m-0 space-y-1">
						<li
							v-for="device in summary.devices"
							:key="device.deviceId"
							class="flex items-center gap-2 text-sm py-1"
						>
							<icon :icon="getDeviceIcon(device.deviceCategory)" class="text-gray-400" />
							<span>{{ device.deviceName }}</span>
						</li>
					</ul>
				</div>
			</el-popover>
		</dd>
	</template>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import { Icon } from '@iconify/vue';
import { ElAlert, ElBadge, ElPopover, ElTag } from 'element-plus';
import { useI18n } from 'vue-i18n';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { ClimateRole, SPACES_MODULE_PREFIX } from '../spaces.constants';

import type { IClimateRoleSummary, ISpaceClimateRolesSummaryProps } from './space-climate-roles-summary.types';

defineOptions({
	name: 'SpaceClimateRolesSummary',
});

const props = defineProps<ISpaceClimateRolesSummaryProps>();

const { t } = useI18n();
const backend = useBackend();

const loading = ref(false);
const roleSummaries = ref<IClimateRoleSummary[]>([]);

const getRoleTagType = (role: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
	switch (role) {
		case ClimateRole.PRIMARY:
			return 'primary';
		case ClimateRole.AUXILIARY:
			return 'warning';
		case ClimateRole.VENTILATION:
			return 'success';
		case ClimateRole.HUMIDITY:
			return 'info';
		case ClimateRole.OTHER:
		default:
			return 'info';
	}
};

const getRoleIcon = (role: string): string => {
	switch (role) {
		case ClimateRole.PRIMARY:
			return 'mdi:thermostat';
		case ClimateRole.AUXILIARY:
			return 'mdi:radiator';
		case ClimateRole.VENTILATION:
			return 'mdi:fan';
		case ClimateRole.HUMIDITY:
			return 'mdi:water-percent';
		case ClimateRole.OTHER:
		default:
			return 'mdi:thermostat-box';
	}
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
		default:
			return 'mdi:thermostat-box';
	}
};

const loadClimateRoles = async (): Promise<void> => {
	if (!props.space?.id) return;

	loading.value = true;
	roleSummaries.value = [];

	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/climate/targets`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			return;
		}

		// Group targets by role (excluding HIDDEN roles)
		const roleMap = new Map<string, IClimateRoleSummary>();

		for (const target of responseData.data ?? []) {
			if (!target.role || target.role === ClimateRole.HIDDEN) continue;

			const role = target.role as string;
			if (!roleMap.has(role)) {
				roleMap.set(role, {
					role,
					devices: [],
				});
			}

			roleMap.get(role)!.devices.push({
				deviceId: target.device_id,
				deviceName: target.device_name,
				deviceCategory: target.device_category ?? '',
			});
		}

		// Convert map to array and sort by role order
		const roleOrder = [
			ClimateRole.PRIMARY,
			ClimateRole.AUXILIARY,
			ClimateRole.VENTILATION,
			ClimateRole.HUMIDITY,
			ClimateRole.OTHER,
		];

		roleSummaries.value = Array.from(roleMap.values()).sort((a, b) => {
			const aIndex = roleOrder.indexOf(a.role as ClimateRole);
			const bIndex = roleOrder.indexOf(b.role as ClimateRole);
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
			loadClimateRoles();
		}
	}
);

onMounted(() => {
	if (props.space?.id) {
		loadClimateRoles();
	}
});
</script>
