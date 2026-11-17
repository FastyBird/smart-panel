<template>
	<el-table
		:data="checks"
		row-key="id"
		border
		stripe
		data-test-id="wizard-review-checks"
	>
		<el-table-column
			prop="label"
			:label="t('devicesModule.wizard.review.setting')"
			min-width="180"
		/>
		<el-table-column
			:label="t('devicesModule.wizard.review.value')"
			min-width="150"
		>
			<template #default="{ row }">{{ row.value ?? '—' }}</template>
		</el-table-column>
		<el-table-column
			:label="t('devicesModule.wizard.review.status')"
			min-width="140"
		>
			<template #default="{ row }">
				<el-tag :type="row.status === 'error' ? 'danger' : row.status">{{ t(`devicesModule.wizard.review.${row.status}`) }}</el-tag>
			</template>
		</el-table-column>
		<el-table-column
			:label="t('devicesModule.wizard.review.details')"
			min-width="240"
		>
			<template #default="{ row }">{{ row.detail ?? '—' }}</template>
		</el-table-column>
	</el-table>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElTable, ElTableColumn, ElTag } from 'element-plus';

import type { IWizardReviewCheck } from './device-wizard-review-checks.types';

defineProps<{ checks: IWizardReviewCheck[] }>();
const { t } = useI18n();
</script>
