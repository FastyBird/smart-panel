<template>
	<el-tooltip
		v-if="status !== null"
		:content="tooltip ?? ''"
		:disabled="tooltip === null"
		placement="bottom"
	>
		<router-link
			v-if="isAdmin"
			:to="settingsRoute"
			class="relay-status-chip"
			data-test-id="relay-status-chip-link"
		>
			<el-tag
				:type="tagType"
				data-test-id="relay-status-chip"
			>
				{{ label }}
			</el-tag>
		</router-link>

		<span
			v-else
			class="relay-status-chip"
		>
			<el-tag
				:type="tagType"
				data-test-id="relay-status-chip"
			>
				{{ label }}
			</el-tag>
		</span>
	</el-tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElTag, ElTooltip } from 'element-plus';

import { CamerasModuleDataRelayStatusState, UsersModuleUserRole } from '../../../openapi.constants';
import { useSession } from '../../auth/composables/useSession';
import { RouteNames as ConfigRouteNames } from '../../config/config.constants';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';

import type { IRelayStatusChipProps } from './relay-status-chip.types';

defineOptions({
	name: 'RelayStatusChip',
});

const props = defineProps<IRelayStatusChipProps>();

const { t } = useI18n();

const { profile: currentUser } = useSession();

const isAdmin = computed<boolean>(
	() => currentUser.value?.role === UsersModuleUserRole.admin || currentUser.value?.role === UsersModuleUserRole.owner
);

const settingsRoute = { name: ConfigRouteNames.CONFIG_MODULE_EDIT, params: { module: CAMERAS_MODULE_NAME } };

const tagType = computed<'success' | 'warning' | 'info' | 'danger'>(() => {
	switch (props.status?.relay.state) {
		case CamerasModuleDataRelayStatusState.running:
			return 'success';
		case CamerasModuleDataRelayStatusState.starting:
			return 'warning';
		case CamerasModuleDataRelayStatusState.disabled:
			return 'info';
		default:
			return 'danger';
	}
});

const label = computed<string>(() => {
	switch (props.status?.relay.state) {
		case CamerasModuleDataRelayStatusState.running:
			return t('camerasModule.relayChip.running');
		case CamerasModuleDataRelayStatusState.starting:
			return t('camerasModule.relayChip.starting');
		case CamerasModuleDataRelayStatusState.disabled:
			return t('camerasModule.relayChip.disabled');
		default:
			return t('camerasModule.relayChip.unavailable');
	}
});

const tooltip = computed<string | null>(() => {
	const reason = props.status?.relay.reason ?? null;

	return reason !== null ? t(`camerasModule.relayReasons.${reason}`) : null;
});
</script>

<style scoped>
.relay-status-chip {
	display: inline-flex;
	text-decoration: none;
}
</style>
