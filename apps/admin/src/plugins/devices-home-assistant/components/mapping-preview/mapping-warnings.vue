<template>
	<el-collapse v-if="warnings.length > 0">
		<el-collapse-item :title="t('devicesHomeAssistantPlugin.headings.mapping.warnings', { count: warnings.length })">
			<div class="space-y-2">
				<el-alert
					v-for="(warning, index) in warnings"
					:key="index"
					:type="getWarningType(warning.type)"
					:title="warning.message"
					:closable="false"
					show-icon
				>
					<template v-if="warning.entityId" #title>
						{{ warning.entityId }}
					</template>

					<template v-if="warning.entityId" #default>
						<div class="mb-1">
							{{ warning.message }}
						</div>
						<small v-if="warning.suggestion">{{ warning.suggestion }}</small>
					</template>
					<template v-else #default>
						{{ warning.suggestion }}
					</template>
				</el-alert>
			</div>
		</el-collapse-item>
	</el-collapse>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElAlert, ElCollapse, ElCollapseItem } from 'element-plus';

import type { IMappingWarning } from '../../schemas/mapping-preview.types';

interface IMappingWarningsProps {
	warnings: IMappingWarning[];
}

defineProps<IMappingWarningsProps>();

const { t } = useI18n();

const getWarningType = (type: IMappingWarning['type']): 'warning' | 'error' | 'info' => {
	switch (type) {
		case 'missing_required_channel':
		case 'missing_required_property':
			return 'error';
		case 'unsupported_entity':
			return 'warning';
		case 'unknown_device_class':
			return 'info';
		default:
			return 'warning';
	}
};
</script>
