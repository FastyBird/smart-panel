<template>
	<div :class="{ 'mt-2': !hideHeader }">
		<el-divider v-if="!hideHeader" content-position="left" class="mt-6!">
			{{ t('spacesModule.edit.sections.smartOverrides.lightingRoles') }}
		</el-divider>

		<el-alert
			type="info"
			:closable="false"
			show-icon
			class="mb-4!"
		>
			{{ t('spacesModule.fields.spaces.lightingRoles.description') }}
		</el-alert>

		<div v-if="loading" class="flex justify-center py-4">
			<icon icon="mdi:loading" class="animate-spin text-2xl" />
		</div>

		<template v-else-if="lightTargets.length > 0">
			<el-table :data="lightTargets" border max-height="400px">
				<el-table-column prop="deviceName" :label="t('spacesModule.onboarding.deviceName')" min-width="180">
					<template #default="{ row }">
						<div class="flex items-center gap-2">
							<icon icon="mdi:lightbulb" />
							<div class="flex flex-col">
								<span>{{ row.deviceName }}</span>
								<span v-if="row.channelName" class="text-xs text-gray-400">{{ row.channelName }}</span>
							</div>
						</div>
					</template>
				</el-table-column>

				<el-table-column :label="t('spacesModule.fields.spaces.lightingRoles.role.title')" width="160">
					<template #default="{ row }">
						<el-select
							:model-value="row.role ?? ''"
							:placeholder="t('spacesModule.fields.spaces.lightingRoles.role.placeholder')"
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

				<el-table-column label="" width="100">
					<template #default="{ row }">
						<div class="flex gap-1">
							<el-tag v-if="row.hasBrightness" type="info" size="small">Dim</el-tag>
							<el-tag v-if="row.hasColor" type="success" size="small">RGB</el-tag>
						</div>
					</template>
				</el-table-column>
			</el-table>

			<div class="flex justify-between items-center mt-4">
				<el-button size="small" :loading="applyingDefaults" @click="onApplyDefaults">
					{{ t('spacesModule.fields.spaces.lightingRoles.applyDefaults') }}
				</el-button>
				<div class="text-xs text-gray-400">
					{{ t('spacesModule.fields.spaces.lightingRoles.applyDefaultsHint') }}
				</div>
			</div>
		</template>

		<el-result v-else>
			<template #icon>
				<icon-with-child :size="80">
					<template #primary>
						<icon icon="mdi:lightbulb" />
					</template>
					<template #secondary>
						<icon icon="mdi:information" />
					</template>
				</icon-with-child>
			</template>

			<template #title>
				{{ t('spacesModule.fields.spaces.lightingRoles.noLights') }}
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
import { LightingRole, SPACES_MODULE_PREFIX } from '../spaces.constants';
import type { ISpace } from '../store';

interface ILightTarget {
	deviceId: string;
	deviceName: string;
	channelId: string;
	channelName: string;
	role: LightingRole | null;
	priority: number;
	hasBrightness: boolean;
	hasColorTemp: boolean;
	hasColor: boolean;
}

interface IProps {
	space: ISpace;
	hideHeader?: boolean;
}

const props = withDefaults(defineProps<IProps>(), {
	hideHeader: false,
});

const { t } = useI18n();
const backend = useBackend();
const flashMessage = useFlashMessage();

const loading = ref(false);
const applyingDefaults = ref(false);
const lightTargets = ref<ILightTarget[]>([]);

const roleOptions = computed(() => [
	{ value: LightingRole.main, label: t('spacesModule.lightingRoles.main') },
	{ value: LightingRole.task, label: t('spacesModule.lightingRoles.task') },
	{ value: LightingRole.ambient, label: t('spacesModule.lightingRoles.ambient') },
	{ value: LightingRole.accent, label: t('spacesModule.lightingRoles.accent') },
	{ value: LightingRole.night, label: t('spacesModule.lightingRoles.night') },
	{ value: LightingRole.other, label: t('spacesModule.lightingRoles.other') },
	{ value: LightingRole.hidden, label: t('spacesModule.lightingRoles.hidden') },
]);

const loadLightTargets = async (): Promise<void> => {
	loading.value = true;
	lightTargets.value = [];

	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/lighting/targets`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			return;
		}

		lightTargets.value = (responseData.data ?? []).map((target) => ({
			deviceId: target.device_id,
			deviceName: target.device_name,
			channelId: target.channel_id,
			channelName: target.channel_name,
			role: target.role ? (target.role as unknown as LightingRole) : null,
			priority: target.priority ?? 0,
			hasBrightness: target.has_brightness ?? false,
			hasColorTemp: target.has_color_temp ?? false,
			hasColor: target.has_color ?? false,
		}));
	} finally {
		loading.value = false;
	}
};

const onRoleChange = async (target: ILightTarget, newRole: string): Promise<void> => {
	try {
		if (newRole === '') {
			// Clear role - delete the assignment
			const { error } = await backend.client.DELETE(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/lighting/roles/{deviceId}/{channelId}`,
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
				flashMessage.error('Failed to clear lighting role');
				return;
			}

			target.role = null;
		} else {
			// Set role
			const { error } = await backend.client.POST(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/lighting/roles`,
				{
					params: { path: { id: props.space.id } },
					body: {
						data: {
							device_id: target.deviceId,
							channel_id: target.channelId,
							// Type assertion needed: LightingRole values match OpenAPI generated enum at runtime
							role: newRole as never,
						},
					},
				}
			);

			if (error) {
				flashMessage.error('Failed to update lighting role');
				return;
			}

			target.role = newRole as LightingRole;
		}
	} catch {
		flashMessage.error('Failed to update lighting role');
	}
};

const onApplyDefaults = async (): Promise<void> => {
	applyingDefaults.value = true;

	try {
		const { data: responseData, error } = await backend.client.POST(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/lighting/roles/defaults`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			flashMessage.error('Failed to apply default roles');
			return;
		}

		// Reload the targets to reflect the new roles
		await loadLightTargets();

		flashMessage.success(`Applied ${responseData.data?.success_count ?? 0} default role(s)`);
	} finally {
		applyingDefaults.value = false;
	}
};

watch(
	() => props.space?.id,
	(newId) => {
		if (newId) {
			loadLightTargets();
		}
	}
);

onMounted(() => {
	if (props.space?.id) {
		loadLightTargets();
	}
});
</script>
