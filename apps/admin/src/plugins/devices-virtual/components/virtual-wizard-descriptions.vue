<template>
	<el-descriptions
		border
		size="small"
		label-width="var(--virtual-wizard-description-label-width, 180px)"
		class="virtual-wizard-descriptions"
		:class="{ 'virtual-wizard-descriptions--card-inset': cardInset }"
	>
		<slot />
	</el-descriptions>
</template>

<script setup lang="ts">
import { ElDescriptions } from 'element-plus';

defineProps<{ cardInset?: boolean }>();
</script>

<style scoped>
.virtual-wizard-descriptions :deep(.el-descriptions__table) {
	table-layout: fixed;
	/* Collapsed borders suppress perimeter cells without overriding theme cell rules. */
	border-style: hidden;
}
.virtual-wizard-descriptions :deep(.el-descriptions__cell) {
	overflow-wrap: anywhere;
}
.virtual-wizard-descriptions--card-inset {
	margin-inline: calc(-1 * var(--el-card-padding));
	width: calc(100% + 2 * var(--el-card-padding));
}
.virtual-wizard-descriptions--card-inset:first-child {
	margin-top: calc(-1 * var(--el-card-padding));
}
.virtual-wizard-descriptions--card-inset:last-child {
	margin-bottom: calc(-1 * var(--el-card-padding));
}
.virtual-wizard-descriptions--card-inset:not(:first-child) :deep(.el-descriptions__table) {
	border-top: 1px solid var(--el-border-color-lighter);
}
</style>
