<template>
	<template v-if="roleSummaries.length > 0">
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('spacesModule.detail.lightingRoles.title') }}
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
							{{ t(`spacesModule.lightingRoles.${summary.role}`) }}
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
						{{ t(`spacesModule.lightingRoles.descriptions.${summary.role}`) }}
					</el-alert>
					<div class="text-sm font-medium mb-1">
						{{ t('spacesModule.detail.lightingRoles.lightsAssigned') }}:
					</div>
					<ul class="list-none p-0 m-0 space-y-1">
						<li
							v-for="device in summary.devices"
							:key="`${device.deviceId}-${device.channelId}`"
							class="flex items-center gap-2 text-sm py-1"
						>
							<icon icon="mdi:lightbulb-outline" class="text-gray-400" />
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
import { LightingRole, SPACES_MODULE_PREFIX } from '../spaces.constants';

import type { ILightingRoleSummary, ISpaceLightingRolesSummaryProps } from './space-lighting-roles-summary.types';

defineOptions({
	name: 'SpaceLightingRolesSummary',
});

const props = defineProps<ISpaceLightingRolesSummaryProps>();

const { t } = useI18n();
const backend = useBackend();

const loading = ref(false);
const roleSummaries = ref<ILightingRoleSummary[]>([]);

const getRoleTagType = (role: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
	switch (role) {
		case LightingRole.MAIN:
			return 'primary';
		case LightingRole.TASK:
			return 'warning';
		case LightingRole.AMBIENT:
			return 'success';
		case LightingRole.ACCENT:
			return 'danger';
		case LightingRole.NIGHT:
			return 'info';
		case LightingRole.OTHER:
		default:
			return 'info';
	}
};

const getRoleIcon = (role: string): string => {
	switch (role) {
		case LightingRole.MAIN:
			return 'mdi:lightbulb';
		case LightingRole.TASK:
			return 'mdi:desk-lamp';
		case LightingRole.AMBIENT:
			return 'mdi:lightbulb-group';
		case LightingRole.ACCENT:
			return 'mdi:spotlight-beam';
		case LightingRole.NIGHT:
			return 'mdi:weather-night';
		case LightingRole.OTHER:
		default:
			return 'mdi:lightbulb-outline';
	}
};

const loadLightingRoles = async (): Promise<void> => {
	if (!props.space?.id) return;

	loading.value = true;
	roleSummaries.value = [];

	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/lighting/targets`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			return;
		}

		// Group targets by role
		const roleMap = new Map<string, ILightingRoleSummary>();

		for (const target of responseData.data ?? []) {
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
			LightingRole.MAIN,
			LightingRole.TASK,
			LightingRole.AMBIENT,
			LightingRole.ACCENT,
			LightingRole.NIGHT,
			LightingRole.OTHER,
		];

		roleSummaries.value = Array.from(roleMap.values()).sort((a, b) => {
			const aIndex = roleOrder.indexOf(a.role as LightingRole);
			const bIndex = roleOrder.indexOf(b.role as LightingRole);
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
			loadLightingRoles();
		}
	}
);

onMounted(() => {
	if (props.space?.id) {
		loadLightingRoles();
	}
});
</script>
