<template>
	<div :class="{ 'mt-2': !hideHeader }">
		<el-divider v-if="!hideHeader" content-position="left" class="mt-6!">
			{{ t('spacesModule.edit.sections.smartOverrides.mediaRoles') }}
		</el-divider>

		<el-alert
			type="info"
			:closable="false"
			show-icon
			class="mb-4!"
		>
			{{ t('spacesModule.fields.spaces.mediaRoles.description') }}
		</el-alert>

		<div v-if="loading && mediaTargets.length === 0" class="flex justify-center py-4">
			<icon icon="mdi:loading" class="animate-spin text-2xl" />
		</div>

		<template v-else-if="mediaTargets.length > 0 || loading">
			<el-table :data="mediaTargets" border max-height="400px">
				<el-table-column prop="deviceName" :label="t('spacesModule.onboarding.deviceName')" min-width="180">
					<template #default="{ row }">
						<div class="flex items-center gap-2">
							<icon :icon="getDeviceIcon()" />
							<div class="flex flex-col">
								<span>{{ row.deviceName }}</span>
								<span v-if="row.channelName" class="text-xs text-gray-400">{{ row.channelName }}</span>
							</div>
						</div>
					</template>
				</el-table-column>

				<el-table-column :label="t('spacesModule.fields.spaces.mediaRoles.role.title')" width="200">
					<template #default="{ row }">
						<el-select
							:model-value="row.role ?? ''"
							:placeholder="t('spacesModule.fields.spaces.mediaRoles.role.placeholder')"
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

				<el-table-column label="" width="140">
					<template #default="{ row }">
						<div class="flex gap-1">
							<el-tag v-if="row.hasOn" type="success" size="small">Power</el-tag>
							<el-tag v-if="row.hasVolume" type="info" size="small">Vol</el-tag>
							<el-tag v-if="row.hasMute" type="warning" size="small">Mute</el-tag>
						</div>
					</template>
				</el-table-column>
			</el-table>

			<div class="flex justify-between items-center mt-4">
				<el-button size="small" :loading="applyingDefaults" @click="onApplyDefaults">
					{{ t('spacesModule.fields.spaces.mediaRoles.applyDefaults') }}
				</el-button>
				<div class="text-xs text-gray-400 ml-4">
					{{ t('spacesModule.fields.spaces.mediaRoles.applyDefaultsHint') }}
				</div>
			</div>
		</template>

		<el-result v-else>
			<template #icon>
				<icon-with-child :size="80">
					<template #primary>
						<icon icon="mdi:cast" />
					</template>
					<template #secondary>
						<icon icon="mdi:information" />
					</template>
				</icon-with-child>
			</template>

			<template #title>
				{{ t('spacesModule.fields.spaces.mediaRoles.noDevices') }}
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
import { MEDIA_ROLE_ORDER, SPACES_MODULE_PREFIX } from '../spaces.constants';
import { SpacesModuleMediaRole as MediaRole } from '../../../openapi.constants';
import type { ISpace } from '../store';

interface IMediaTarget {
	deviceId: string;
	deviceName: string;
	deviceCategory: string;
	channelId: string | null;
	channelName: string | null;
	role: MediaRole | null;
	priority: number;
	hasOn: boolean;
	hasVolume: boolean;
	hasMute: boolean;
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
const { mediaSignal } = useSpacesRefreshSignals();

const loading = ref(false);
const applyingDefaults = ref(false);
const mediaTargets = ref<IMediaTarget[]>([]);

const roleOptions = computed(() =>
	MEDIA_ROLE_ORDER.map((role) => ({
		value: role,
		label: t(`spacesModule.mediaRoles.${role}`),
	}))
);

const getDeviceIcon = (): string => 'mdi:cast';

const loadMediaTargets = async (): Promise<void> => {
	loading.value = true;

	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/media/targets`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			return;
		}

		mediaTargets.value = (responseData.data ?? []).map((target) => ({
			deviceId: target.device_id,
			deviceName: target.device_name,
			deviceCategory: '',
			channelId: target.channel_id ?? null,
			channelName: target.channel_name ?? null,
			role: target.role ? (target.role as unknown as MediaRole) : null,
			priority: target.priority ?? 0,
			hasOn: target.has_on ?? false,
			hasVolume: target.has_volume ?? false,
			hasMute: target.has_mute ?? false,
		}));
	} finally {
		loading.value = false;
	}
};

const onRoleChange = async (target: IMediaTarget, newRole: string): Promise<void> => {
	try {
		if (newRole === '') {
			const { error } = await backend.client.DELETE(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/media/roles/{deviceId}`,
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
				flashMessage.error('Failed to clear media role');
				return;
			}

			target.role = null;
		} else {
			const roleData: { device_id: string; role: never; priority?: number } = {
				device_id: target.deviceId,
				role: newRole as never,
				priority: target.priority,
			};

			const { error } = await backend.client.POST(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/media/roles`,
				{
					params: { path: { id: props.space.id } },
					body: { data: roleData },
				}
			);

			if (error) {
				flashMessage.error('Failed to update media role');
				return;
			}

			target.role = newRole as MediaRole;
		}
	} catch {
		flashMessage.error('Failed to update media role');
	}
};

const onApplyDefaults = async (): Promise<void> => {
	applyingDefaults.value = true;

	try {
		const { data: responseData, error } = await backend.client.POST(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/media/roles/defaults`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			flashMessage.error('Failed to apply default roles');
			return;
		}

		await loadMediaTargets();
		flashMessage.success(`Applied ${responseData.data?.success_count ?? 0} default role(s)`);
	} finally {
		applyingDefaults.value = false;
	}
};

watch(
	() => props.space?.id,
	(newId) => {
		if (newId) {
			loadMediaTargets();
		}
	}
);

watch(
	() => mediaSignal?.value,
	() => {
		if (props.space?.id) {
			loadMediaTargets();
		}
	}
);

onMounted(() => {
	if (props.space?.id) {
		loadMediaTargets();
	}
});
</script>
