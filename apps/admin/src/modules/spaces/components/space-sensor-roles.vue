<template>
	<div :class="{ 'mt-2': !hideHeader }">
		<el-divider v-if="!hideHeader" content-position="left" class="mt-6!">
			{{ t('spacesModule.edit.sections.smartOverrides.sensorRoles') }}
		</el-divider>

		<el-alert
			type="info"
			:closable="false"
			show-icon
			class="mb-4!"
		>
			{{ t('spacesModule.fields.spaces.sensorRoles.description') }}
		</el-alert>

		<div v-if="loading && sensorTargets.length === 0" class="flex justify-center py-4">
			<icon icon="mdi:loading" class="animate-spin text-2xl" />
		</div>

		<template v-else-if="sensorTargets.length > 0 || loading">
			<el-table :data="sensorTargets" border max-height="400px">
				<el-table-column prop="deviceName" :label="t('spacesModule.onboarding.deviceName')" min-width="180">
					<template #default="{ row }">
						<div class="flex items-center gap-2">
							<icon icon="mdi:motion-sensor" />
							<div class="flex flex-col">
								<span>{{ row.deviceName }}</span>
								<span class="text-xs text-gray-400">{{ row.channelName }}</span>
							</div>
						</div>
					</template>
				</el-table-column>

				<el-table-column :label="t('spacesModule.fields.spaces.sensorRoles.channel.title')" width="200">
					<template #default="{ row }">
						<el-tag size="small" type="info">
							{{ getChannelLabel(row.channelCategory) }}
						</el-tag>
					</template>
				</el-table-column>

				<el-table-column :label="t('spacesModule.fields.spaces.sensorRoles.role.title')" width="200">
					<template #default="{ row }">
						<el-select
							:model-value="row.role ?? ''"
							:placeholder="t('spacesModule.fields.spaces.sensorRoles.role.placeholder')"
							clearable
							@update:model-value="onRoleChange(row, $event)"
						>
							<el-option
								v-for="role in roleOptions"
								:key="role.value"
								:label="role.label"
								:value="role.value"
							/>
						</el-select>
					</template>
				</el-table-column>
			</el-table>

			<div class="flex justify-between items-center mt-4">
				<el-button size="small" :loading="applyingDefaults" @click="onApplyDefaults">
					{{ t('spacesModule.fields.spaces.sensorRoles.applyDefaults') }}
				</el-button>
				<div class="text-xs text-gray-400 ml-4">
					{{ t('spacesModule.fields.spaces.sensorRoles.applyDefaultsHint') }}
				</div>
			</div>
		</template>

		<el-result v-else>
			<template #icon>
				<icon-with-child :size="80">
					<template #primary>
						<icon icon="mdi:motion-sensor" />
					</template>
					<template #secondary>
						<icon icon="mdi:information" />
					</template>
				</icon-with-child>
			</template>

			<template #title>
				{{ t('spacesModule.fields.spaces.sensorRoles.noSensors') }}
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
import { useSpacesRefreshSignals } from '../composables';
import { SENSOR_ROLE_ORDER, SensorRole, SPACES_MODULE_PREFIX } from '../spaces.constants';
import type { ISpace } from '../store';

interface ISensorTarget {
	deviceId: string;
	deviceName: string;
	channelId: string;
	channelName: string;
	channelCategory: string;
	role: SensorRole | null;
	priority: number;
}

interface IProps {
	space: ISpace;
	hideHeader?: boolean;
}

const props = withDefaults(defineProps<IProps>(), {
	hideHeader: false,
});

defineOptions({
	name: 'SpaceSensorRoles',
});

const { t } = useI18n();
const backend = useBackend();
const flashMessage = useFlashMessage();
const { sensorSignal } = useSpacesRefreshSignals();

const loading = ref(false);
const applyingDefaults = ref(false);
const sensorTargets = ref<ISensorTarget[]>([]);

const roleOptions = computed(() =>
	SENSOR_ROLE_ORDER.map((role) => ({
		value: role,
		label: t(`spacesModule.sensorRoles.${role}`),
	}))
);

const getChannelLabel = (category: string): string => {
	switch (category) {
		case 'temperature':
			return t('spacesModule.sensorRoles.categories.temperature');
		case 'humidity':
			return t('spacesModule.sensorRoles.categories.humidity');
		case 'pressure':
			return t('spacesModule.sensorRoles.categories.pressure');
		case 'illuminance':
			return t('spacesModule.sensorRoles.categories.illuminance');
		case 'smoke':
			return t('spacesModule.sensorRoles.categories.smoke');
		case 'gas':
			return t('spacesModule.sensorRoles.categories.gas');
		case 'carbon_monoxide':
			return t('spacesModule.sensorRoles.categories.carbon_monoxide');
		case 'carbon_dioxide':
			return t('spacesModule.sensorRoles.categories.carbon_dioxide');
		case 'leak':
			return t('spacesModule.sensorRoles.categories.leak');
		case 'motion':
			return t('spacesModule.sensorRoles.categories.motion');
		case 'occupancy':
			return t('spacesModule.sensorRoles.categories.occupancy');
		case 'contact':
			return t('spacesModule.sensorRoles.categories.contact');
		case 'air_quality':
			return t('spacesModule.sensorRoles.categories.air_quality');
		case 'air_particulate':
			return t('spacesModule.sensorRoles.categories.air_particulate');
		case 'nitrogen_dioxide':
			return t('spacesModule.sensorRoles.categories.nitrogen_dioxide');
		case 'ozone':
			return t('spacesModule.sensorRoles.categories.ozone');
		case 'sulphur_dioxide':
			return t('spacesModule.sensorRoles.categories.sulphur_dioxide');
		case 'volatile_organic_compounds':
			return t('spacesModule.sensorRoles.categories.volatile_organic_compounds');
		case 'electrical_energy':
			return t('spacesModule.sensorRoles.categories.electrical_energy');
		case 'electrical_power':
			return t('spacesModule.sensorRoles.categories.electrical_power');
		case 'battery':
			return t('spacesModule.sensorRoles.categories.battery');
		default:
			return category;
	}
};

const loadSensorTargets = async (): Promise<void> => {
	loading.value = true;

	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/sensors/targets`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			return;
		}

		sensorTargets.value = (responseData.data ?? []).map((target, index) => ({
			deviceId: target.device_id,
			deviceName: target.device_name,
			channelId: target.channel_id,
			channelName: target.channel_name ?? target.channel_category,
			channelCategory: target.channel_category,
			role: target.role ? (target.role as unknown as SensorRole) : null,
			priority: target.priority ?? index,
		}));
	} finally {
		loading.value = false;
	}
};

const onRoleChange = async (target: ISensorTarget, newRole: string): Promise<void> => {
	try {
		if (newRole === '') {
			const { error } = await backend.client.DELETE(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/sensors/roles/{deviceId}/{channelId}`,
				{
					params: {
						path: {
							id: props.space.id,
							deviceId: target.deviceId,
							channelId: target.channelId,
						},
					},
				}
			);

			if (error) {
				flashMessage.error('Failed to clear sensor role');
				return;
			}

			target.role = null;
		} else {
			const { error } = await backend.client.POST(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/sensors/roles`,
				{
					params: { path: { id: props.space.id } },
					body: {
						data: {
							device_id: target.deviceId,
							channel_id: target.channelId,
							role: newRole as never,
						},
					},
				}
			);

			if (error) {
				flashMessage.error('Failed to update sensor role');
				return;
			}

			target.role = newRole as SensorRole;
		}
	} catch {
		flashMessage.error('Failed to update sensor role');
	}
};

const onApplyDefaults = async (): Promise<void> => {
	applyingDefaults.value = true;

	try {
		const { data: responseData, error } = await backend.client.POST(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/sensors/roles/defaults`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			flashMessage.error('Failed to apply default roles');
			return;
		}

		await loadSensorTargets();
		flashMessage.success(`Applied ${responseData.data?.success_count ?? 0} default role(s)`);
	} finally {
		applyingDefaults.value = false;
	}
};

watch(
	() => props.space?.id,
	(newId) => {
		if (newId) {
			loadSensorTargets();
		}
	}
);

watch(
	() => sensorSignal?.value,
	() => {
		if (props.space?.id) {
			loadSensorTargets();
		}
	}
);

onMounted(() => {
	if (props.space?.id) {
		loadSensorTargets();
	}
});
</script>
