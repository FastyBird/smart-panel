<template>
	<template v-if="hasTargets">
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('spacesModule.detail.mediaRoles.title') }}
		</dt>
		<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center justify-between min-w-[8rem]">
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
								{{ t(`spacesModule.mediaRoles.${summary.role}`) }}
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
							{{ t(`spacesModule.mediaRoles.descriptions.${summary.role}`) }}
						</el-alert>
						<div class="text-sm font-medium mb-1">
							{{ t('spacesModule.detail.mediaRoles.devicesAssigned') }}:
						</div>
						<ul class="list-none p-0 m-0 space-y-1">
							<li
								v-for="device in summary.devices"
								:key="device.deviceId"
								class="flex items-center gap-2 text-sm py-1"
							>
								<icon :icon="getDeviceIcon()" class="text-gray-400" />
								<span>{{ device.deviceName }}</span>
							</li>
						</ul>
					</div>
				</el-popover>
			</div>
			<div v-else class="flex items-center gap-2 text-gray-400 text-sm">
				<icon icon="mdi:cast" />
				{{ t('spacesModule.detail.mediaRoles.noRolesAssigned') }}
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
import { MEDIA_ROLE_ORDER, SPACES_MODULE_PREFIX } from '../spaces.constants';
import { SpacesModuleMediaRole as MediaRole } from '../../../openapi.constants';

import type { IMediaRoleSummary, ISpaceMediaRolesSummaryProps } from './space-media-roles-summary.types';

defineOptions({
	name: 'SpaceMediaRolesSummary',
});

const props = defineProps<ISpaceMediaRolesSummaryProps>();

const emit = defineEmits<{
	(e: 'edit'): void;
}>();

const { t } = useI18n();
const backend = useBackend();
const { mediaSignal } = useSpacesRefreshSignals();

const loading = ref(false);
const roleSummaries = ref<IMediaRoleSummary[]>([]);
const hasTargets = ref(false);

const getRoleTagType = (role: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
	switch (role) {
		case MediaRole.primary:
			return 'primary';
		case MediaRole.secondary:
			return 'success';
		case MediaRole.background:
			return 'warning';
		case MediaRole.gaming:
			return 'info';
		case MediaRole.hidden:
		default:
			return 'info';
	}
};

const getRoleIcon = (role: string): string => {
	switch (role) {
		case MediaRole.primary:
			return 'mdi:television';
		case MediaRole.secondary:
			return 'mdi:monitor';
		case MediaRole.background:
			return 'mdi:speaker';
		case MediaRole.gaming:
			return 'mdi:gamepad-variant';
		case MediaRole.hidden:
		default:
			return 'mdi:eye-off';
	}
};

const getDeviceIcon = (): string => 'mdi:cast';

const loadMediaRoles = async (): Promise<void> => {
	if (!props.space?.id) return;

	loading.value = true;

	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/media/targets`,
			{ params: { path: { id: props.space.id } } }
		);

		if (error || !responseData) {
			hasTargets.value = false;
			return;
		}

		const targets = responseData.data ?? [];
		hasTargets.value = targets.length > 0;

		const roleMap = new Map<string, IMediaRoleSummary>();

		for (const target of targets) {
			if (!target.role || (target.role as string) === MediaRole.hidden) continue;

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
				deviceCategory: '',
			});
		}

		roleSummaries.value = Array.from(roleMap.values()).sort((a, b) => {
			const aIndex = MEDIA_ROLE_ORDER.indexOf(a.role as MediaRole);
			const bIndex = MEDIA_ROLE_ORDER.indexOf(b.role as MediaRole);
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
			loadMediaRoles();
		}
	}
);

watch(
	() => mediaSignal?.value,
	() => {
		if (props.space?.id) {
			loadMediaRoles();
		}
	}
);

onMounted(() => {
	if (props.space?.id) {
		loadMediaRoles();
	}
});

defineExpose({
	reload: loadMediaRoles,
});
</script>
