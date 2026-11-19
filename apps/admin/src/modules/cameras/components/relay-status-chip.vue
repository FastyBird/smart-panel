<template>
	<el-tooltip
		v-if="status !== null || stale"
		:content="tooltip ?? ''"
		:disabled="tooltip === null"
		placement="bottom"
	>
		<router-link
			v-if="canOpenSettings"
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

import { CamerasModuleDataRelayStatusState } from '../../../openapi.constants';
import { useCamerasSettingsLink } from '../composables/useCamerasSettingsLink';

import type { IRelayStatusChipProps } from './relay-status-chip.types';

defineOptions({
	name: 'RelayStatusChip',
});

const props = withDefaults(defineProps<IRelayStatusChipProps>(), {
	stale: false,
});

const { t } = useI18n();

const { canOpenSettings, settingsRoute } = useCamerasSettingsLink();

// A status that could not be refreshed may be wrong, so the chip does not claim a state it cannot confirm.
const tagType = computed<'success' | 'warning' | 'info' | 'danger'>(() => {
	if (props.stale) {
		return 'info';
	}

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
	if (props.stale) {
		return t('camerasModule.relayChip.unknown');
	}

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
	if (props.stale) {
		return t('camerasModule.relayStale');
	}

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
