<template>
	<!-- Phone (spec section 6): the flow read as a list of steps, from its triggers on; it is edited on a larger screen -->
	<state-view
		v-if="steps.length === 0"
		kind="empty"
		:title="t('automations.editor.texts.noSteps')"
		:icon="AUTOMATION_FLOW_ICON"
	/>

	<ol
		v-else
		class="flex flex-col gap-2 m-0 p-3 list-none"
		:aria-label="t('automations.editor.texts.steps')"
		data-test-id="automation-step-list"
	>
		<li
			v-for="(step, index) in steps"
			:key="step.id"
			:data-step-id="step.id"
			class="flex items-start gap-2"
			data-test-id="automation-step"
		>
			<span
				class="flex items-center justify-center shrink-0 w-6 h-6 mt-2 rounded-full bg-fill text-[12px] font-600 text-regular"
				aria-hidden="true"
			>
				{{ index + 1 }}
			</span>
			<automation-node-card
				v-bind="step.card"
				class="flex-1 min-w-0"
			/>
		</li>
	</ol>
</template>

<script setup lang="ts">
import { computed, markRaw } from 'vue';
import { useI18n } from 'vue-i18n';

import { StateView } from '../../../../common';
import { AUTOMATION_FLOW_ICON, AutomationNodeKind } from '../../automations.constants';
import { mapIssueSeverities } from '../../automations.graph';
import { useAutomationNodePresentation } from '../../composables/useAutomationNodePresentation';
import type { IAutomationGraphNode } from '../../store/automations.store.types';
import type { IAutomationNodeType } from '../../store/node-types.store.types';

import type { IAutomationNodeCardProps } from './automation-node-card.types';
import AutomationNodeCard from './automation-node-card.vue';
import type { IAutomationStepListProps } from './automation-step-list.types';

defineOptions({
	name: 'AutomationStepList',
});

const props = withDefaults(defineProps<IAutomationStepListProps>(), {
	issues: () => [],
	summaryComponent: undefined,
	nodeDomain: undefined,
});

const { t } = useI18n();

const { kindLabel, nodeTitle, nodeIcon, nodeSummary } = useAutomationNodePresentation();

const lookup = (type: string): IAutomationNodeType | null => props.nodeTypes.find((nodeType) => nodeType.type === type) ?? null;

const byPosition = (a: IAutomationGraphNode, b: IAutomationGraphNode): number => a.position.y - b.position.y || a.position.x - b.position.x;

// The order the flow runs in: the triggers first, then every step as soon as one before it leads to it. Steps nothing
// leads to come last, top to bottom as they lie on the canvas
const ordered = computed<IAutomationGraphNode[]>((): IAutomationGraphNode[] => {
	const nodes = new Map(props.graph.nodes.map((node) => [node.id, node]));
	const seen = new Set<string>();
	const queue = props.graph.nodes.filter((node) => lookup(node.type)?.kind === AutomationNodeKind.trigger).sort(byPosition);
	const result: IAutomationGraphNode[] = [];

	queue.forEach((node) => seen.add(node.id));

	while (queue.length > 0) {
		const node = queue.shift()!;

		result.push(node);

		const next = props.graph.edges
			.filter((edge) => edge.source === node.id)
			.map((edge) => nodes.get(edge.target))
			.filter((target): target is IAutomationGraphNode => target !== undefined && !seen.has(target.id))
			.sort(byPosition);

		next.forEach((target) => {
			seen.add(target.id);
			queue.push(target);
		});
	}

	return [...result, ...props.graph.nodes.filter((node) => !seen.has(node.id)).sort(byPosition)];
});

const severities = computed(() => mapIssueSeverities(props.issues));

const steps = computed<{ id: string; card: IAutomationNodeCardProps }[]>(() =>
	ordered.value.map((node) => {
		const nodeType = lookup(node.type);
		const component = nodeType !== null ? (props.summaryComponent?.(node.type) ?? null) : null;

		return {
			id: node.id,
			card: {
				kind: nodeType?.kind ?? null,
				kindLabel: kindLabel(nodeType?.kind ?? null),
				icon: nodeIcon(node.type, nodeType),
				title: nodeTitle(node.type, nodeType),
				summary: nodeSummary(node, nodeType),
				issue: severities.value.nodes.get(node.id),
				domain: props.nodeDomain?.(node),
				...(component !== null && nodeType !== null ? { summaryComponent: markRaw(component), summaryProps: { nodeType, config: node.config } } : {}),
			},
		};
	})
);
</script>
