<template>
	<el-alert
		type="warning"
		:title="t('devicesHomeAssistantPlugin.headings.mapping.warnings')"
		:closable="false"
		show-icon
	>
		<ul class="list-disc list-inside space-y-1 mt-2">
			<li
				v-for="(warning, index) in warnings"
				:key="index"
			>
				<span class="font-medium">{{ warning.message }}</span>
				<span v-if="warning.suggestion" class="text-gray-600">
					- {{ warning.suggestion }}
				</span>
			</li>
		</ul>
	</el-alert>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElAlert } from 'element-plus';

import type { IMappingWarning } from '../../schemas/mapping-preview.types';

interface IMappingWarningsProps {
	warnings: IMappingWarning[];
}

defineProps<IMappingWarningsProps>();

const { t } = useI18n();
</script>
