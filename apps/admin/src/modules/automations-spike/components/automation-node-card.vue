<template>
	<div
		class="automation-node-card"
		:class="[`automation-node-card--${definition?.kind ?? 'unknown'}`, { 'automation-node-card--selected': props.selected }]"
		:data-test-kind="definition?.kind"
	>
		<div class="automation-node-card__icon">
			<el-icon :size="20">
				<icon :icon="definition?.icon ?? 'mdi:help-circle-outline'" />
			</el-icon>
		</div>
		<div class="automation-node-card__body">
			<el-tag
				:type="tagType"
				size="small"
				effect="dark"
				round
				disable-transitions
			>
				{{ kindLabel }}
			</el-tag>
			<el-text
				class="automation-node-card__summary"
				truncated
				data-test="node-summary"
			>
				{{ summary }}
			</el-text>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ElIcon, ElTag, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { KIND_LABELS, getNodeType } from '../automations-spike.catalogue';
import type { IAutomationNodeTypeDefinition } from '../automations-spike.types';

defineOptions({
	name: 'AutomationNodeCard',
});

const props = withDefaults(
	defineProps<{
		type: string;
		config: Record<string, unknown>;
		selected?: boolean;
	}>(),
	{
		selected: false,
	}
);

const definition = computed<IAutomationNodeTypeDefinition | undefined>(() => getNodeType(props.type));

const kindLabel = computed<string>(() => (definition.value ? KIND_LABELS[definition.value.kind] : '?'));

const summary = computed<string>(() => definition.value?.summary(props.config) ?? props.type);

const tagType = computed<'primary' | 'success' | 'warning' | 'info'>(() => {
	switch (definition.value?.kind) {
		case 'trigger':
			return 'primary';
		case 'condition':
			return 'warning';
		case 'action':
			return 'success';
		default:
			return 'info';
	}
});
</script>

<style scoped lang="scss">
.automation-node-card {
	--automation-node-accent: var(--el-color-info);

	display: flex;
	align-items: center;
	gap: 10px;
	box-sizing: border-box;
	width: 300px;
	padding: 10px 50px 10px 10px;
	border: 1px solid var(--el-border-color);
	border-left: 4px solid var(--automation-node-accent);
	border-radius: var(--el-border-radius-base);
	background-color: var(--el-bg-color-overlay);
	box-shadow: var(--el-box-shadow-lighter);
	color: var(--el-text-color-primary);

	&--trigger {
		--automation-node-accent: var(--el-color-primary);
	}

	&--condition {
		--automation-node-accent: var(--el-color-warning);
	}

	&--action {
		--automation-node-accent: var(--el-color-success);
	}

	&--selected {
		border-color: var(--automation-node-accent);
		box-shadow: 0 0 0 2px var(--automation-node-accent);
	}

	&__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 34px;
		height: 34px;
		border-radius: 50%;
		background-color: color-mix(in srgb, var(--automation-node-accent) 15%, transparent);
		color: var(--automation-node-accent);
	}

	&__body {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		min-width: 0;
	}

	&__summary {
		max-width: 100%;
		font-size: var(--el-font-size-small);
	}
}
</style>
