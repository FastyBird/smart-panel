<template>
	<div
		v-if="advisories.length > 0"
		class="flex flex-col gap-2"
	>
		<el-alert
			v-for="(advisory, index) in advisories"
			:key="`${advisory.code}-${advisory.provider ?? 'module'}-${index}`"
			:type="severityAlertType(advisory.severity)"
			:title="advisory.message"
			:description="advisory.provider ?? undefined"
			:closable="false"
			show-icon
		/>
	</div>

	<el-empty
		v-else
		:description="t('remoteAccessModule.texts.noAdvisories')"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElAlert, ElEmpty } from 'element-plus';

import { useRemoteAccessStatus } from '../composables';
import type { IRemoteAccessAdvisory } from '../store/remote-access-status.store.types';

defineOptions({
	name: 'AdvisoriesList',
});

const { t } = useI18n();

const { advisories } = useRemoteAccessStatus();

const severityAlertType = (severity: IRemoteAccessAdvisory['severity']): 'error' | 'warning' | 'info' => {
	switch (severity) {
		case 'critical':
			return 'error';
		case 'warning':
			return 'warning';
		default:
			return 'info';
	}
};
</script>
