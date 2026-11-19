<template>
	<div
		v-if="status !== null || stale"
		data-test-id="relay-status-panel"
	>
		<el-alert
			v-if="stale"
			type="warning"
			show-icon
			:closable="false"
			:title="t('camerasModule.relayStale')"
			class="mb-2"
			data-test-id="relay-status-stale"
		/>

		<el-alert
			v-if="reasonText !== null"
			type="warning"
			show-icon
			:closable="false"
			:title="reasonText"
			class="mb-2"
			data-test-id="relay-status-reason"
		/>

		<dl
			v-if="status !== null"
			class="relay-status-panel__list"
		>
			<dt>{{ t('camerasModule.config.relayPanel.mode') }}</dt>
			<dd>{{ t(`camerasModule.config.modes.${status.relay.mode}`) }}</dd>

			<dt>{{ t('camerasModule.config.relayPanel.state') }}</dt>
			<dd>{{ t(`camerasModule.config.relayStates.${status.relay.state}`) }}</dd>

			<template v-if="status.relay.version !== null">
				<dt>{{ t('camerasModule.config.relayPanel.version') }}</dt>
				<dd>{{ status.relay.version }}</dd>
			</template>

			<dt>{{ t('camerasModule.config.relayPanel.sessions') }}</dt>
			<dd>{{ t('camerasModule.config.relayPanel.sessionsValue', { active: status.sessions.active, max: status.sessions.max }) }}</dd>

			<dt>{{ t('camerasModule.config.relayPanel.maxPerCamera') }}</dt>
			<dd>{{ status.sessions.maxPerCamera }}</dd>
		</dl>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert } from 'element-plus';

import type { IRelayStatusPanelProps } from './relay-status-panel.types';

defineOptions({
	name: 'RelayStatusPanel',
});

const props = withDefaults(defineProps<IRelayStatusPanelProps>(), {
	stale: false,
});

const { t } = useI18n();

const reasonText = computed<string | null>(() => {
	const reason = props.status?.relay.reason ?? null;

	return reason !== null ? t(`camerasModule.relayReasons.${reason}`) : null;
});
</script>

<style scoped>
.relay-status-panel__list {
	display: grid;
	grid-template-columns: max-content 1fr;
	gap: 0.25rem 1rem;
	margin: 0;
}

.relay-status-panel__list dt {
	color: var(--el-text-color-secondary);
}

.relay-status-panel__list dd {
	margin: 0;
}
</style>
