<template>
	<el-alert
		:type="props.status === AutomationStatus.invalid ? 'error' : 'warning'"
		:closable="false"
		show-icon
		class="automation-status-explanation"
		data-test-id="status-explanation"
		:data-test-status="props.status"
	>
		<template #title>
			{{ t(`automations.runs.explanations.${props.status}.title`) }}
		</template>

		<p class="my-0">{{ t(`automations.runs.explanations.${props.status}.text`) }}</p>

		<p
			v-if="props.status === AutomationStatus.suspended && suspended !== null"
			class="mt-1 mb-0"
		>
			{{ t('automations.runs.explanations.suspended.trigger') }}
			<el-link
				underline="always"
				data-test-id="status-node"
				@click="emit('focus', suspended.id)"
			>
				{{ t('automations.runs.buttons.showNode.title', { node: suspended.label }) }}
			</el-link>
		</p>

		<ul
			v-if="props.status === AutomationStatus.invalid && problems.length > 0"
			class="automation-status-explanation__problems"
		>
			<li
				v-for="(problem, index) in problems"
				:key="index"
				data-test-id="status-problem"
				:data-test-code="problem.code"
			>
				<span>{{ problem.text }}</span>
				<el-link
					v-if="problem.node !== null"
					underline="always"
					class="ml-1"
					data-test-id="status-node"
					@click="emit('focus', problem.node.id)"
				>
					{{ t('automations.runs.buttons.showNode.title', { node: problem.node.label }) }}
				</el-link>
			</li>
		</ul>
	</el-alert>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElLink } from 'element-plus';

import { AutomationStatus } from '../../automations.constants';
import { problemNodeId } from '../../automations.trace';
import { useAutomationRunPresentation } from '../../composables/useAutomationRunPresentation';

import type { IAutomationStatusExplanationProps } from './automation-status-explanation.types';

defineOptions({
	name: 'AutomationStatusExplanation',
});

interface INodeLink {
	id: string;
	label: string;
}

interface IProblemItem {
	code: string;
	text: string;
	node: INodeLink | null;
}

const props = withDefaults(defineProps<IAutomationStatusExplanationProps>(), {
	suspendedNodeId: null,
});

const emit = defineEmits<{
	(e: 'focus', nodeId: string): void;
}>();

const { t } = useI18n();

const { problemText, nodeLabel } = useAutomationRunPresentation();

const link = (nodeId: string | null): INodeLink | null => {
	const label = nodeId === null ? null : nodeLabel(nodeId, props.graph, props.nodeTypes);

	return nodeId !== null && label !== null ? { id: nodeId, label } : null;
};

// The trigger that kept firing: the one the last run started at, or the last one the engine turned away
const suspended = computed<INodeLink | null>(
	(): INodeLink | null => link(props.suspendedNodeId ?? null) ?? link(props.runtime?.lastSkippedNodeId ?? null)
);

const problems = computed<IProblemItem[]>((): IProblemItem[] =>
	(props.runtime?.problems ?? []).map(
		(problem): IProblemItem => ({
			code: problem.code,
			text: problemText(problem),
			node: link(problemNodeId(problem, props.graph)),
		})
	)
);
</script>

<style scoped lang="scss">
.automation-status-explanation {
	flex: none;
	border-radius: 0;

	&__problems {
		margin: 4px 0 0;
		padding-left: 18px;
	}
}
</style>
