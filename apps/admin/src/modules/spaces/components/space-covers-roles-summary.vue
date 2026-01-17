<template>
	<template v-if="hasTargets">
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('spacesModule.detail.coversRoles.title') }}
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
								{{ t(`spacesModule.coversRoles.${summary.role}`) }}
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
							{{ t(`spacesModule.coversRoles.descriptions.${summary.role}`) }}
						</el-alert>
						<div class="text-sm font-medium mb-1">
							{{ t('spacesModule.detail.coversRoles.coversAssigned') }}:
						</div>
						<ul class="list-none p-0 m-0 space-y-1">
							<li
								v-for="device in summary.devices"
								:key="`${device.deviceId}-${device.channelId}`"
								class="flex items-center gap-2 text-sm py-1"
							>
								<icon icon="mdi:blinds-horizontal" class="text-gray-400" />
								<span>{{ device.deviceName }}</span>
							</li>
						</ul>
					</div>
				</el-popover>
			</div>
			<!-- Show hint when no roles assigned yet -->
			<div v-else class="flex items-center gap-2 text-gray-400 text-sm">
				<icon icon="mdi:blinds" />
				{{ t('spacesModule.detail.coversRoles.noRolesAssigned') }}
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
import { CoversRole, SPACES_MODULE_PREFIX } from '../spaces.constants';

import type { ICoversRoleSummary, ISpaceCoversRolesSummaryProps } from './space-covers-roles-summary.types';

defineOptions({
	name: 'SpaceCoversRolesSummary',
});

const props = defineProps<ISpaceCoversRolesSummaryProps>();

const emit = defineEmits<{
	(e: 'edit'): void;
}>();

const { t } = useI18n();
const backend = useBackend();
const { coversSignal } = useSpacesRefreshSignals();

const loading = ref(false);
const roleSummaries = ref<ICoversRoleSummary[]>([]);
const hasTargets = ref(false);

const getRoleTagType = (role: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
	switch (role) {
		case CoversRole.primary:
			return 'primary';
		case CoversRole.blackout:
			return 'danger';
		case CoversRole.sheer:
			return 'success';
		case CoversRole.outdoor:
			return 'warning';
		case CoversRole.hidden:
		default:
			return 'info';
	}
};

const getRoleIcon = (role: string): string => {
	switch (role) {
		case CoversRole.primary:
			return 'mdi:blinds';
		case CoversRole.blackout:
			return 'mdi:blinds-horizontal-closed';
		case CoversRole.sheer:
			return 'mdi:curtains';
		case CoversRole.outdoor:
			return 'mdi:window-shutter';
		case CoversRole.hidden:
		default:
			return 'mdi:blinds-horizontal';
	}
};

const loadCoversRoles = async (): Promise<void> => {
	if (!props.space?.id) return;

	loading.value = true;

	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/covers/targets`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			hasTargets.value = false;
			return;
		}

		const targets = responseData.data ?? [];
		hasTargets.value = targets.length > 0;

		// Group targets by role
		const roleMap = new Map<string, ICoversRoleSummary>();

		for (const target of targets) {
			if (!target.role) continue;

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
				channelId: target.channel_id,
				channelName: target.channel_name,
			});
		}

		// Convert map to array and sort by role order
		const roleOrder = [
			CoversRole.primary,
			CoversRole.blackout,
			CoversRole.sheer,
			CoversRole.outdoor,
			CoversRole.hidden,
		];

		roleSummaries.value = Array.from(roleMap.values()).sort((a, b) => {
			const aIndex = roleOrder.indexOf(a.role as CoversRole);
			const bIndex = roleOrder.indexOf(b.role as CoversRole);
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
			loadCoversRoles();
		}
	}
);

// Watch for covers refresh signal from websocket events
watch(
	() => coversSignal?.value,
	() => {
		if (props.space?.id) {
			loadCoversRoles();
		}
	}
);

onMounted(() => {
	if (props.space?.id) {
		loadCoversRoles();
	}
});

defineExpose({
	reload: loadCoversRoles,
});
</script>
