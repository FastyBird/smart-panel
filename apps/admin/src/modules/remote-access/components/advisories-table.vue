<template>
	<el-table
		:data="rows"
		table-layout="fixed"
		row-key="rowKey"
	>
		<el-table-column
			:label="t('remoteAccessModule.fields.advisory.severity')"
			prop="severity"
			:width="130"
		>
			<template #default="scope">
				<el-tag
					size="small"
					:type="severityTagType(scope.row.severity)"
				>
					{{ t(`remoteAccessModule.severity.${scope.row.severity}`) }}
				</el-tag>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('remoteAccessModule.fields.advisory.message')"
			prop="message"
			:min-width="320"
		/>

		<el-table-column
			:label="t('remoteAccessModule.fields.advisory.provider')"
			prop="provider"
			:width="200"
		>
			<template #default="scope">
				{{ scope.row.provider ?? t('remoteAccessModule.texts.moduleSource') }}
			</template>
		</el-table-column>

		<el-table-column
			:label="t('remoteAccessModule.fields.advisory.code')"
			prop="code"
			:width="240"
		>
			<template #default="scope">
				<span class="font-mono">{{ scope.row.code }}</span>
			</template>
		</el-table-column>

		<template #empty>
			<div class="h-full w-full leading-normal">
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:cloud-lock-outline" />
							</template>
							<template #secondary>
								<icon icon="mdi:check-circle" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('remoteAccessModule.texts.noAdvisories') }}
					</template>
				</el-result>
			</div>
		</template>
	</el-table>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElResult, ElTable, ElTableColumn, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { IconWithChild } from '../../../common';
import { useRemoteAccessStatus } from '../composables';
import type { IRemoteAccessAdvisory } from '../store/remote-access-status.store.types';

defineOptions({
	name: 'AdvisoriesTable',
});

const { t } = useI18n();

const { advisories } = useRemoteAccessStatus();

// `row-key` only ever receives the row itself, never its index, so the index has to be baked
// into a synthetic field up front to keep keys unique for two advisories that otherwise share a
// code and provider.
const rows = computed<(IRemoteAccessAdvisory & { rowKey: string })[]>(() =>
	advisories.value.map((advisory, index) => ({
		...advisory,
		rowKey: `${advisory.code}-${advisory.provider ?? 'module'}-${index}`,
	}))
);

const severityTagType = (severity: IRemoteAccessAdvisory['severity']): 'danger' | 'warning' | 'info' => {
	switch (severity) {
		case 'critical':
			return 'danger';
		case 'warning':
			return 'warning';
		default:
			return 'info';
	}
};
</script>
