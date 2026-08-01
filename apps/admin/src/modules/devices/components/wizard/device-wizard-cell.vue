<template>
	<el-tooltip
		v-if="cell?.render === 'tag' && cell.tooltip"
		:content="cell.tooltip"
		placement="top"
	>
		<el-tag
			size="small"
			:type="cell.variant ?? 'info'"
			effect="plain"
		>
			{{ cell.value }}
		</el-tag>
	</el-tooltip>

	<el-tag
		v-else-if="cell?.render === 'tag'"
		size="small"
		:type="cell.variant ?? 'info'"
		effect="plain"
	>
		{{ cell.value }}
	</el-tag>

	<code
		v-else-if="cell?.render === 'code'"
		class="text-sm"
	>
		{{ cell.value }}
	</code>

	<span
		v-else-if="cell?.render === 'text'"
		:class="cell.muted ? 'text-gray-500' : undefined"
	>
		{{ cell.value }}
	</span>

	<span
		v-else
		class="text-gray-400"
	>
		&mdash;
	</span>
</template>

<script setup lang="ts">
import { ElTag, ElTooltip } from 'element-plus';

import type { IWizardCell } from './device-wizard.types';

defineOptions({
	name: 'DeviceWizardCell',
});

defineProps<{
	cell?: IWizardCell;
}>();
</script>
