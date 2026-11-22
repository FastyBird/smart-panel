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
			:ref="(el) => setStepRef(step.id, el)"
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
				:selected="step.id === focusedId"
				class="flex-1 min-w-0"
			/>
		</li>
	</ol>
</template>

<script setup lang="ts">
import { type ComponentPublicInstance, computed, markRaw, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { StateView } from '../../../../common';
import { AUTOMATION_FLOW_ICON, AutomationNodeKind } from '../../automations.constants';
import { mapIssueSeverities } from '../../automations.graph';
import { useAutomationNodePresentation } from '../../composables/useAutomationNodePresentation';
import { useAutomationRunPresentation } from '../../composables/useAutomationRunPresentation';
import type { IAutomationGraphNode } from '../../store/automations.store.types';
import type { IAutomationNodeType } from '../../store/node-types.store.types';

import type { IAutomationNodeCardProps, IAutomationNodeCardRun } from './automation-node-card.types';
import AutomationNodeCard from './automation-node-card.vue';
import type { IAutomationStepListProps } from './automation-step-list.types';

defineOptions({
	name: 'AutomationStepList',
});

const props = withDefaults(defineProps<IAutomationStepListProps>(), {
	issues: () => [],
	summaryComponent: undefined,
	nodeDomain: undefined,
	run: null,
});

const { t } = useI18n();

const { kindLabel, nodeTitle, nodeIcon, nodeSummary } = useAutomationNodePresentation();

const { nodeRunText } = useAutomationRunPresentation();

// What a step did in the run laid over the flow, as on the canvas: undefined without a run, null for a step it did not
// reach
const runOf = (id: string): IAutomationNodeCardRun | null | undefined => {
	if (!props.run) {
		return undefined;
	}

	const overlay = props.run.overlay.nodes[id];

	return overlay ? { state: overlay.state, text: nodeRunText(overlay, props.run.ended), visits: overlay.visits } : null;
};

/*
 * Focus: an issue or a run summary points at a step; it is scrolled to and marked
 */

const focusedId = ref<string | null>(null);

const stepRefs = new Map<string, HTMLElement>();

const setStepRef = (id: string, el: Element | ComponentPublicInstance | null): void => {
	if (el instanceof HTMLElement) {
		stepRefs.set(id, el);
	} else {
		stepRefs.delete(id);
	}
};

const focusStep = (id: string): void => {
	focusedId.value = id;

	stepRefs.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};

defineExpose({ focusStep });

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
			.filter((target): target is IAutomationGraphNode => target !== undefined)
			.sort(byPosition);

		// Two ports of one step may lead to the same next one: it is listed once
		next.forEach((target) => {
			if (!seen.has(target.id)) {
				seen.add(target.id);
				queue.push(target);
			}
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
				run: runOf(node.id),
				...(component !== null && nodeType !== null ? { summaryComponent: markRaw(component), summaryProps: { nodeType, config: node.config } } : {}),
			},
		};
	})
);
</script>
