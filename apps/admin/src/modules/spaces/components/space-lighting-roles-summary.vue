<template>
	<template v-if="roleSummaries.length > 0">
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('spacesModule.detail.lightingRoles.title') }}
		</dt>
		<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center justify-between min-w-[8rem]">
			<div class="flex items-center gap-2 flex-wrap">
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
import { LightingRole, SPACES_MODULE_PREFIX } from '../spaces.constants';

import type { ILightingRoleSummary, ISpaceLightingRolesSummaryProps } from './space-lighting-roles-summary.types';

defineOptions({
	name: 'SpaceLightingRolesSummary',
});

const props = defineProps<ISpaceLightingRolesSummaryProps>();

const emit = defineEmits<{
	(e: 'edit'): void;
}>();

const { t } = useI18n();
const backend = useBackend();
const { lightingSignal } = useSpacesRefreshSignals();

const loading = ref(false);
const roleSummaries = ref<ILightingRoleSummary[]>([]);

const getRoleTagType = (role: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
	switch (role) {
		case LightingRole.main:
			return 'primary';
		case LightingRole.task:
			return 'warning';
		case LightingRole.ambient:
			return 'success';
		case LightingRole.accent:
			return 'danger';
		case LightingRole.night:
			return 'info';
		case LightingRole.other:
		default:
			return 'info';
	}
};

const getRoleIcon = (role: string): string => {
	switch (role) {
		case LightingRole.main:
			return 'mdi:lightbulb';
		case LightingRole.task:
			return 'mdi:desk-lamp';
		case LightingRole.ambient:
			return 'mdi:lightbulb-group';
		case LightingRole.accent:
			return 'mdi:spotlight-beam';
		case LightingRole.night:
			return 'mdi:weather-night';
		case LightingRole.other:
		default:
			return 'mdi:lightbulb-outline';
	}
};

const loadLightingRoles = async (): Promise<void> => {
	if (!props.space?.id) return;

	loading.value = true;

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
			LightingRole.main,
			LightingRole.task,
			LightingRole.ambient,
			LightingRole.accent,
			LightingRole.night,
			LightingRole.other,
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

// Watch for lighting refresh signal from websocket events
watch(
	() => lightingSignal?.value,
	() => {
		if (props.space?.id) {
			loadLightingRoles();
		}
	}
);

onMounted(() => {
	if (props.space?.id) {
		loadLightingRoles();
	}
});

defineExpose({
	reload: loadLightingRoles,
});
</script>
