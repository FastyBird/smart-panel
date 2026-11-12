<template>
	<section
		class="automation-run-summary"
		:aria-label="sourceLabel"
		data-test-id="run-summary"
		:data-test-source="props.shown.source"
	>
		<div class="automation-run-summary__header">
			<el-icon
				:size="16"
				:class="{ 'is-loading': !props.shown.ended }"
			>
				<icon :icon="props.shown.ended ? 'mdi:history' : 'mdi:loading'" />
			</el-icon>
			<span class="font-600">{{ sourceLabel }}</span>
			<el-tag
				:type="props.shown.run ? AUTOMATION_RUN_RECORD_STATUS_COLORS[props.shown.run.status] : 'primary'"
				size="small"
				disable-transitions
				data-test-id="run-summary-status"
			>
				{{ props.shown.run ? runStatusLabel(props.shown.run.status) : runStatusLabel(AutomationRunRecordStatus.running) }}
			</el-tag>
			<span
				v-if="props.shown.run"
				class="automation-run-summary__time"
			>
				{{ dateText(props.shown.run.startedAt) }}
			</span>
			<div class="grow-1" />
			<el-button
				link
				size="small"
				data-test-id="close-run"
				@click="emit('close')"
			>
				<template #icon>
					<icon icon="mdi:close" />
				</template>
				{{ t('automations.runs.buttons.close.title') }}
			</el-button>
		</div>

		<div
			v-if="props.shown.attention"
			class="automation-run-summary__attention"
			:class="`automation-run-summary__attention--${props.shown.attention.kind}`"
			role="alert"
			data-test-id="run-attention"
			:data-test-kind="props.shown.attention.kind"
		>
			<el-icon
				:size="16"
				class="flex-none mt-[1px]"
			>
				<icon :icon="props.shown.attention.kind === 'failed' ? 'mdi:alert-circle' : 'mdi:alert'" />
			</el-icon>
			<div class="min-w-0">
				<span>{{ attentionText(props.shown.attention) }}</span>
				<el-button
					v-if="attentionNode !== null"
					link
					type="primary"
					class="automation-run-summary__node ml-1"
					data-test-id="run-attention-node"
					@click="emit('focus', attentionNode.id)"
				>
					{{ t('automations.runs.buttons.showNode.title', { node: attentionNode.label }) }}
				</el-button>
			</div>
		</div>

		<ul
			v-if="notes.length > 0"
			class="automation-run-summary__notes"
		>
			<li
				v-for="note in notes"
				:key="note"
				:data-test-note="note"
			>
				{{ t(`automations.runs.texts.${note}`) }}
			</li>
		</ul>
	</section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElIcon, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AUTOMATION_RUN_RECORD_STATUS_COLORS, AutomationRunRecordStatus } from '../../automations.constants';
import { useAutomationRunPresentation } from '../../composables/useAutomationRunPresentation';

import type { IAutomationRunSummaryProps } from './automation-run-summary.types';

defineOptions({
	name: 'AutomationRunSummary',
});

type SummaryNote = 'waitingForSteps' | 'traceLoading' | 'traceFailed' | 'truncated' | 'otherRevision' | 'unsaved' | 'missingNodes';

const props = withDefaults(defineProps<IAutomationRunSummaryProps>(), {
	unsaved: false,
});

const emit = defineEmits<{
	(e: 'focus', nodeId: string): void;
	(e: 'close'): void;
}>();

const { t } = useI18n();

const { runStatusLabel, dateText, attentionText, nodeLabel } = useAutomationRunPresentation();

const sourceLabel = computed<string>((): string => t(`automations.runs.sources.${props.shown.source}`));

// The card the explanation is about, when it is on the canvas
const attentionNode = computed<{ id: string; label: string } | null>((): { id: string; label: string } | null => {
	const nodeId = props.shown.attention?.nodeId ?? null;
	const label = nodeId === null ? null : nodeLabel(nodeId, props.graph, props.nodeTypes);

	return nodeId !== null && label !== null ? { id: nodeId, label } : null;
});

// What to keep in mind when reading the canvas
const notes = computed<SummaryNote[]>((): SummaryNote[] => {
	const list: SummaryNote[] = [];
	const { shown } = props;

	if (!shown.ended && shown.steps.length === 0) {
		list.push('waitingForSteps');
	}

	if (shown.loading && shown.steps.length === 0) {
		list.push('traceLoading');
	}

	if (shown.failed) {
		list.push('traceFailed');
	}

	if (shown.truncated) {
		list.push('truncated');
	}

	if (shown.run !== null && shown.run.revision !== props.revision) {
		list.push('otherRevision');
	} else if (props.unsaved) {
		list.push('unsaved');
	}

	if (shown.overlay.missingNodeIds.length > 0) {
		list.push('missingNodes');
	}

	return list;
});
</script>

<style scoped lang="scss">
.automation-run-summary {
	flex: none;
	border-bottom: 1px solid var(--el-border-color);
	background-color: var(--el-color-primary-light-9);
	font-size: var(--el-font-size-small);

	&__header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		color: var(--el-text-color-primary);
	}

	// A button that reads as a link in the text
	&__node {
		height: auto;
		padding: 0;
		font-size: inherit;
		vertical-align: baseline;
	}

	&__time {
		color: var(--el-text-color-secondary);
		font-size: var(--el-font-size-extra-small);
	}

	&__attention {
		display: flex;
		gap: 8px;
		padding: 0 12px 8px;
		color: var(--el-text-color-regular);
		line-height: 1.4;

		&--failed .el-icon {
			color: var(--el-color-danger);
		}

		&--interrupted .el-icon,
		&--cancelled .el-icon {
			color: var(--el-color-warning);
		}
	}

	&__notes {
		margin: 0;
		padding: 0 12px 8px 32px;
		color: var(--el-text-color-secondary);
		font-size: var(--el-font-size-extra-small);
		line-height: 1.4;
	}
}
</style>
