<template>
	<div :class="{ 'mt-2': !hideHeader }">
		<el-divider v-if="!hideHeader" content-position="left" class="mt-6!">
			{{ t('spacesModule.edit.sections.smartOverrides.coversRoles') }}
		</el-divider>

		<el-alert
			type="info"
			:closable="false"
			show-icon
			class="mb-4!"
		>
			{{ t('spacesModule.fields.spaces.coversRoles.description') }}
		</el-alert>

		<div v-if="loading && coversTargets.length === 0" class="flex justify-center py-4">
			<icon icon="mdi:loading" class="animate-spin text-2xl" />
		</div>

		<template v-else-if="coversTargets.length > 0 || loading">
			<el-table :data="coversTargets" border max-height="400px">
				<el-table-column prop="deviceName" :label="t('spacesModule.onboarding.deviceName')" min-width="180">
					<template #default="{ row }">
						<div class="flex items-center gap-2">
							<icon icon="mdi:blinds" />
							<div class="flex flex-col">
								<span>{{ row.deviceName }}</span>
								<span v-if="row.channelName" class="text-xs text-gray-400">{{ row.channelName }}</span>
							</div>
						</div>
					</template>
				</el-table-column>

				<el-table-column :label="t('spacesModule.fields.spaces.coversRoles.role.title')" width="160">
					<template #default="{ row }">
						<el-select
							:model-value="row.role ?? ''"
							:placeholder="t('spacesModule.fields.spaces.coversRoles.role.placeholder')"
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
							<el-tag v-if="row.hasPosition" type="info" size="small">Pos</el-tag>
							<el-tag v-if="row.hasTilt" type="success" size="small">Tilt</el-tag>
						</div>
					</template>
				</el-table-column>
			</el-table>

			<div class="flex justify-between items-center mt-4">
				<el-button size="small" :loading="applyingDefaults" @click="onApplyDefaults">
					{{ t('spacesModule.fields.spaces.coversRoles.applyDefaults') }}
				</el-button>
				<div class="text-xs text-gray-400">
					{{ t('spacesModule.fields.spaces.coversRoles.applyDefaultsHint') }}
				</div>
			</div>
		</template>

		<el-result v-else>
			<template #icon>
				<icon-with-child :size="80">
					<template #primary>
						<icon icon="mdi:blinds" />
					</template>
					<template #secondary>
						<icon icon="mdi:information" />
					</template>
				</icon-with-child>
			</template>

			<template #title>
				{{ t('spacesModule.fields.spaces.coversRoles.noCovers') }}
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
import { CoversRole, SPACES_MODULE_PREFIX } from '../spaces.constants';
import type { ISpace } from '../store';

interface ICoversTarget {
	deviceId: string;
	deviceName: string;
	channelId: string;
	channelName: string;
	role: CoversRole | null;
	priority: number;
	hasPosition: boolean;
	hasCommand: boolean;
	hasTilt: boolean;
	coverType: string | null;
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
const { coversSignal } = useSpacesRefreshSignals();

const loading = ref(false);
const applyingDefaults = ref(false);
const coversTargets = ref<ICoversTarget[]>([]);

const roleOptions = computed(() => [
	{ value: CoversRole.primary, label: t('spacesModule.coversRoles.primary') },
	{ value: CoversRole.blackout, label: t('spacesModule.coversRoles.blackout') },
	{ value: CoversRole.sheer, label: t('spacesModule.coversRoles.sheer') },
	{ value: CoversRole.outdoor, label: t('spacesModule.coversRoles.outdoor') },
	{ value: CoversRole.hidden, label: t('spacesModule.coversRoles.hidden') },
]);

const loadCoversTargets = async (): Promise<void> => {
	loading.value = true;

	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/covers/targets`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			return;
		}

		coversTargets.value = (responseData.data ?? []).map((target) => ({
			deviceId: target.device_id,
			deviceName: target.device_name,
			channelId: target.channel_id,
			channelName: target.channel_name,
			role: target.role ? (target.role as unknown as CoversRole) : null,
			priority: target.priority ?? 0,
			hasPosition: target.has_position ?? false,
			hasCommand: target.has_command ?? false,
			hasTilt: target.has_tilt ?? false,
			coverType: target.cover_type ?? null,
		}));
	} finally {
		loading.value = false;
	}
};

const onRoleChange = async (target: ICoversTarget, newRole: string): Promise<void> => {
	try {
		if (!newRole) {
			// Clear role - delete the assignment
			const { error } = await backend.client.DELETE(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/covers/roles/{deviceId}/{channelId}`,
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
				flashMessage.error('Failed to clear covers role');
				return;
			}

			target.role = null;
		} else {
			// Set role
			const { error } = await backend.client.POST(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/covers/roles`,
				{
					params: { path: { id: props.space.id } },
					body: {
						data: {
							device_id: target.deviceId,
							channel_id: target.channelId,
							// Type assertion needed: CoversRole values match OpenAPI generated enum at runtime
							role: newRole as never,
						},
					},
				}
			);

			if (error) {
				flashMessage.error('Failed to update covers role');
				return;
			}

			target.role = newRole as CoversRole;
		}
	} catch {
		flashMessage.error('Failed to update covers role');
	}
};

const onApplyDefaults = async (): Promise<void> => {
	applyingDefaults.value = true;

	try {
		const { data: responseData, error } = await backend.client.POST(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/covers/roles/defaults`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			flashMessage.error('Failed to apply default roles');
			return;
		}

		// Reload the targets to reflect the new roles
		await loadCoversTargets();

		flashMessage.success(`Applied ${responseData.data?.success_count ?? 0} default role(s)`);
	} finally {
		applyingDefaults.value = false;
	}
};

watch(
	() => props.space?.id,
	(newId) => {
		if (newId) {
			loadCoversTargets();
		}
	}
);

// Watch for covers refresh signal from websocket events
watch(
	() => coversSignal?.value,
	() => {
		if (props.space?.id) {
			loadCoversTargets();
		}
	}
);

onMounted(() => {
	if (props.space?.id) {
		loadCoversTargets();
	}
});
</script>
