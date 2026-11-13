<template>
	<div
		class="automation-node-card"
		:class="[
			`automation-node-card--${props.kind ?? 'unknown'}`,
			{
				'automation-node-card--selected': props.selected,
				'automation-node-card--error': props.issue === 'error',
				'automation-node-card--warning': props.issue === 'warning',
				[`automation-node-card--run-${props.run?.state}`]: Boolean(props.run),
				'automation-node-card--run-none': props.run === null,
			},
		]"
		:data-test-kind="props.kind ?? 'unknown'"
		:data-test-issue="props.issue"
		:data-test-run-state="props.run === undefined ? undefined : (props.run?.state ?? 'none')"
	>
		<div class="automation-node-card__icon">
			<el-icon :size="20">
				<icon :icon="props.icon" />
			</el-icon>
		</div>

		<div class="automation-node-card__body">
			<div class="automation-node-card__heading">
				<span class="automation-node-card__kind">{{ props.kindLabel }}</span>
				<span
					class="automation-node-card__title"
					data-test-id="node-title"
				>
					{{ props.title }}
				</span>
			</div>
			<div
				class="automation-node-card__summary"
				:title="props.summaryComponent ? undefined : props.summary"
				data-test-id="node-summary"
			>
				<component
					:is="props.summaryComponent"
					v-if="props.summaryComponent && props.summaryProps"
					v-bind="props.summaryProps"
				/>
				<template v-else>
					{{ props.summary }}
				</template>
			</div>
			<div
				v-if="props.run"
				class="automation-node-card__run"
				:title="props.run.text"
				data-test-id="node-run"
			>
				<el-icon
					:size="12"
					class="flex-none"
				>
					<icon :icon="RUN_STATE_ICONS[props.run.state]" />
				</el-icon>
				<span class="automation-node-card__run-text">{{ props.run.text }}</span>
				<span
					v-if="props.run.visits > 1"
					class="flex-none"
				>
					×{{ props.run.visits }}
				</span>
			</div>
		</div>

		<el-icon
			v-if="props.issue"
			class="automation-node-card__issue"
			:size="16"
		>
			<icon :icon="props.issue === 'error' ? 'mdi:alert-circle' : 'mdi:alert'" />
		</el-icon>
	</div>
</template>

<script setup lang="ts">
import { ElIcon } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { AutomationRunNodeState } from '../../automations.trace';

import type { IAutomationNodeCardProps } from './automation-node-card.types';

defineOptions({
	name: 'AutomationNodeCard',
});

const props = withDefaults(defineProps<IAutomationNodeCardProps>(), {
	kind: null,
	selected: false,
	issue: undefined,
	summaryComponent: undefined,
	summaryProps: undefined,
	run: undefined,
});

const RUN_STATE_ICONS: Record<AutomationRunNodeState, string> = {
	reached: 'mdi:progress-clock',
	passed: 'mdi:check-circle',
	failed: 'mdi:close-circle',
	skipped: 'mdi:minus-circle-outline',
};
</script>

<style scoped lang="scss">
.automation-node-card {
	--automation-node-accent: var(--el-color-info);

	position: relative;
	display: flex;
	align-items: center;
	gap: 10px;
	box-sizing: border-box;
	width: 280px;
	padding: 10px 44px 10px 10px;
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

	&--unknown {
		--automation-node-accent: var(--el-color-danger);

		border-style: dashed;
		border-left-style: solid;
	}

	&--selected {
		border-color: var(--automation-node-accent);
		box-shadow: 0 0 0 2px var(--automation-node-accent);
	}

	&--warning {
		outline: 2px solid var(--el-color-warning);
		outline-offset: 2px;
	}

	&--error {
		outline: 2px solid var(--el-color-danger);
		outline-offset: 2px;
	}

	&__icon {
		display: flex;
		flex: 0 0 34px;
		align-items: center;
		justify-content: center;
		height: 34px;
		border-radius: 50%;
		background-color: color-mix(in srgb, var(--automation-node-accent) 15%, transparent);
		color: var(--automation-node-accent);
	}

	&__body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	&__heading {
		display: flex;
		align-items: baseline;
		gap: 6px;
		min-width: 0;
		font-size: var(--el-font-size-small);
		line-height: 1.3;
	}

	&__kind {
		flex: none;
		color: var(--automation-node-accent);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	&__title {
		overflow: hidden;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&__summary {
		overflow: hidden;
		color: var(--el-text-color-secondary);
		font-size: var(--el-font-size-extra-small);
		line-height: 1.4;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&__run {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		margin-top: 2px;
		color: var(--automation-node-run-color, var(--el-text-color-secondary));
		font-size: var(--el-font-size-extra-small);
		font-weight: 600;
		line-height: 1.4;
	}

	&__run-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	// A run laid over the canvas: the cards it reached are lit, the others step back
	&--run-reached {
		--automation-node-run-color: var(--el-color-primary);
	}

	&--run-passed {
		--automation-node-run-color: var(--el-color-success);
	}

	&--run-failed {
		--automation-node-run-color: var(--el-color-danger);
	}

	&--run-skipped {
		--automation-node-run-color: var(--el-color-info);
	}

	&--run-reached,
	&--run-passed,
	&--run-failed,
	&--run-skipped {
		border-color: var(--automation-node-run-color);
		background-color: color-mix(in srgb, var(--automation-node-run-color) 8%, var(--el-bg-color-overlay));
	}

	&--run-none {
		opacity: 0.55;
	}

	&__issue {
		position: absolute;
		top: -8px;
		left: -8px;
		border-radius: 50%;
		background-color: var(--el-bg-color-overlay);
	}

	&--warning &__issue {
		color: var(--el-color-warning);
	}

	&--error &__issue {
		color: var(--el-color-danger);
	}
}
</style>
