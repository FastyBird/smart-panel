<template>
	<div
		ref="container"
		class="automation-canvas"
		:class="{ 'automation-canvas--readonly': props.readonly }"
		data-test="automation-canvas"
		@dragover="onDragOver"
		@drop="onDrop"
	>
		<vue-flow
			:id="flowId"
			:connection-mode="props.looseConnections ? ConnectionMode.Loose : ConnectionMode.Strict"
			:is-valid-connection="isValidConnection"
			:nodes-draggable="!props.readonly"
			:nodes-connectable="!props.readonly"
			:edges-updatable="false"
			:elements-selectable="true"
			:delete-key-code="props.readonly ? null : ['Backspace', 'Delete']"
			:connect-on-click="props.connectOnClick"
			:connection-radius="30"
			:snap-to-grid="true"
			:snap-grid="[10, 10]"
			:min-zoom="0.2"
			:max-zoom="2"
			:fit-view-on-init="true"
		>
			<template #node-automation="nodeProps">
				<handle
					v-for="(port, index) in portsOf(nodeProps.data.type).inputs"
					:id="port"
					:key="`in-${port}`"
					type="target"
					:position="Position.Left"
					:style="{ top: handleOffset(index, portsOf(nodeProps.data.type).inputs.length) }"
					:data-test-port="port"
					@click.stop
				/>

				<automation-node-card
					:type="nodeProps.data.type"
					:config="nodeProps.data.config"
					:selected="nodeProps.selected"
				/>

				<template
					v-for="(port, index) in portsOf(nodeProps.data.type).outputs"
					:key="`out-${port}`"
				>
					<span
						v-if="portsOf(nodeProps.data.type).outputs.length > 1"
						class="automation-canvas__port-label"
						:style="{ top: handleOffset(index, portsOf(nodeProps.data.type).outputs.length) }"
					>
						{{ port }}
					</span>
					<handle
						:id="port"
						type="source"
						:position="Position.Right"
						:class="`automation-canvas__handle--${port}`"
						:style="{ top: handleOffset(index, portsOf(nodeProps.data.type).outputs.length) }"
						:data-test-port="port"
						@click.stop
					/>
				</template>
			</template>

			<background
				variant="dots"
				:gap="20"
				:size="1.5"
			/>
			<controls
				position="bottom-left"
				:show-interactive="false"
			/>
		</vue-flow>
	</div>
</template>

<script setup lang="ts">
/*
 * THROWAWAY SPIKE (AU-0).
 *
 * The ONLY file that imports the canvas library. Everything else talks plain graph JSON:
 *   in:  `graph` prop  { nodes: [{ id, type, position, config }], edges: [{ id, source, source_port, target, target_port }] }
 *   out: `update:graph` after every structural edit (drag end, connect, delete, add)
 */
import { nextTick, ref, useId, watch } from 'vue';

import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import '@vue-flow/controls/dist/style.css';
import {
	type Connection,
	ConnectionMode,
	type Edge,
	type EdgeChange,
	type GraphEdge,
	type GraphNode,
	Handle,
	MarkerType,
	type Node,
	type NodeChange,
	Position,
	VueFlow,
	useVueFlow,
} from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';

import { getNodeType } from '../automations-spike.catalogue';
import { validateConnection } from '../automations-spike.graph';
import type {
	AutomationConnectionRejection,
	IAutomationConnectionCandidate,
	IAutomationGraph,
	IAutomationGraphEdge,
	IAutomationGraphNode,
} from '../automations-spike.types';

import AutomationNodeCard from './automation-node-card.vue';

defineOptions({
	name: 'AutomationCanvas',
});

interface IAutomationNodeData {
	type: string;
	config: Record<string, unknown>;
}

const NODE_DRAG_MIME = 'application/x-automation-node-type';

const props = withDefaults(
	defineProps<{
		graph: IAutomationGraph;
		readonly?: boolean;
		connectOnClick?: boolean;
		// Spike only: Vue Flow's default "loose" mode lets a source handle connect to another source handle.
		looseConnections?: boolean;
	}>(),
	{
		readonly: false,
		connectOnClick: true,
		looseConnections: false,
	}
);

const emit = defineEmits<{
	(e: 'update:graph', graph: IAutomationGraph): void;
	(e: 'select', nodeIds: string[], edgeIds: string[]): void;
	(e: 'reject', reason: AutomationConnectionRejection): void;
}>();

const flowId = `automation-canvas-${useId()}`;

const container = ref<HTMLDivElement | null>(null);

const {
	addEdges,
	addSelectedNodes,
	addNodes,
	findNode,
	fitView,
	getEdges,
	getNodes,
	getSelectedEdges,
	getSelectedNodes,
	getViewport,
	onConnect,
	onConnectEnd,
	onConnectStart,
	onEdgesChange,
	onNodesChange,
	removeEdges,
	removeNodes,
	screenToFlowCoordinate,
	setEdges,
	setNodes,
	zoomTo,
} = useVueFlow(flowId);

const shortId = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const portsOf = (type: string): { inputs: string[]; outputs: string[] } => {
	const definition = getNodeType(type);

	return { inputs: definition?.inputs ?? [], outputs: definition?.outputs ?? [] };
};

const handleOffset = (index: number, count: number): string => `${((index + 1) / (count + 1)) * 100}%`;

/*
 * Graph JSON -> library
 */

const toFlowNode = (node: IAutomationGraphNode): Node<IAutomationNodeData> => ({
	id: node.id,
	type: 'automation',
	position: { x: node.position.x, y: node.position.y },
	data: { type: node.type, config: { ...node.config } },
	ariaLabel: `${getNodeType(node.type)?.kind ?? 'node'}: ${getNodeType(node.type)?.summary(node.config) ?? node.type}`,
});

const EDGE_COLORS: Record<string, string> = {
	default: 'var(--el-text-color-secondary)',
	yes: 'var(--el-color-success)',
	done: 'var(--el-color-success)',
	error: 'var(--el-color-danger)',
};

const toFlowEdge = (edge: IAutomationGraphEdge): Edge => ({
	id: edge.id,
	source: edge.source,
	sourceHandle: edge.source_port,
	target: edge.target,
	targetHandle: edge.target_port,
	class: `automation-canvas__edge automation-canvas__edge--${edge.source_port}`,
	// The marker colour is written into an inline style, so a CSS variable works here (a stylesheet rule would lose to the inline style).
	markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS[edge.source_port] ?? EDGE_COLORS.default },
});

/*
 * Library -> graph JSON
 */

const toGraph = (): IAutomationGraph => ({
	version: props.graph.version,
	nodes: getNodes.value.map(
		(node: GraphNode<IAutomationNodeData>): IAutomationGraphNode => ({
			id: node.id,
			type: node.data.type,
			position: { x: node.position.x, y: node.position.y },
			config: { ...node.data.config },
		})
	),
	edges: getEdges.value.map(
		(edge: GraphEdge): IAutomationGraphEdge => ({
			id: edge.id,
			source: edge.source,
			source_port: edge.sourceHandle ?? 'out',
			target: edge.target,
			target_port: edge.targetHandle ?? 'in',
		})
	),
});

let lastSynced = '';
let emitScheduled = false;

const emitGraph = (): void => {
	if (emitScheduled) {
		return;
	}

	emitScheduled = true;

	void nextTick(() => {
		emitScheduled = false;

		const graph = toGraph();
		const serialised = JSON.stringify(graph);

		if (serialised === lastSynced) {
			return;
		}

		lastSynced = serialised;

		emit('update:graph', graph);
	});
};

const structureOf = (graph: IAutomationGraph): string =>
	JSON.stringify([
		graph.nodes.map((node) => [node.id, node.type]),
		graph.edges.map((edge) => [edge.id, edge.source, edge.source_port, edge.target, edge.target_port]),
	]);

watch(
	(): IAutomationGraph => props.graph,
	(graph: IAutomationGraph): void => {
		const serialised = JSON.stringify(graph);

		if (serialised === lastSynced) {
			return;
		}

		const sameStructure = lastSynced !== '' && structureOf(graph) === structureOf(toGraph());

		lastSynced = serialised;

		if (sameStructure) {
			// Config or position edit from outside (drawer form): patch in place, keep selection and measured sizes.
			for (const node of graph.nodes) {
				const existing = findNode<IAutomationNodeData>(node.id);

				if (existing) {
					existing.position = { x: node.position.x, y: node.position.y };
					existing.data = { type: node.type, config: { ...node.config } };
				}
			}

			return;
		}

		const selected = new Set(getSelectedNodes.value.map((node) => node.id));

		setNodes(graph.nodes.map((node) => toFlowNode(node)));
		setEdges(graph.edges.map(toFlowEdge));

		// The public `Node` input type has no `selected` field (only the internal `GraphNode` has), so selection is restored separately.
		addSelectedNodes(getNodes.value.filter((node) => selected.has(node.id)));
	},
	{ deep: true, immediate: true }
);

/*
 * Connection validation
 */

let lastRejection: AutomationConnectionRejection | null = null;
let connectedInGesture = false;

const toCandidate = (connection: Connection): IAutomationConnectionCandidate => ({
	source: connection.source,
	source_port: connection.sourceHandle ?? 'out',
	target: connection.target,
	target_port: connection.targetHandle ?? 'in',
});

const currentEdges = (): IAutomationConnectionCandidate[] =>
	getEdges.value.map((edge) => ({
		source: edge.source,
		source_port: edge.sourceHandle ?? 'out',
		target: edge.target,
		target_port: edge.targetHandle ?? 'in',
	}));

const isValidConnection = (connection: Connection): boolean => {
	lastRejection = validateConnection(
		getNodes.value.map((node: GraphNode<IAutomationNodeData>) => ({ id: node.id, type: node.data.type })),
		currentEdges(),
		toCandidate(connection)
	);

	return lastRejection === null;
};

onConnectStart((): void => {
	lastRejection = null;
	connectedInGesture = false;
});

onConnect((connection: Connection): void => {
	connectedInGesture = true;

	// `isValidConnection` already ran, but the store is the last line of defence (click-connect, programmatic calls).
	if (!isValidConnection(connection)) {
		return;
	}

	const candidate = toCandidate(connection);

	addEdges([toFlowEdge({ id: shortId('e'), ...candidate })]);

	emitGraph();
});

onConnectEnd((): void => {
	// `connect` and `connectEnd` order is not documented; decide after both had a chance to run.
	setTimeout((): void => {
		if (!connectedInGesture && lastRejection !== null) {
			emit('reject', lastRejection);
		}

		lastRejection = null;
	}, 0);
});

/*
 * Change tracking
 */

onNodesChange((changes: NodeChange[]): void => {
	if (changes.some((change) => change.type === 'remove' || change.type === 'add' || (change.type === 'position' && !change.dragging))) {
		emitGraph();
	}
});

onEdgesChange((changes: EdgeChange[]): void => {
	if (changes.some((change) => change.type === 'remove' || change.type === 'add')) {
		emitGraph();
	}
});

watch(
	(): string => JSON.stringify([getSelectedNodes.value.map((node) => node.id), getSelectedEdges.value.map((edge) => edge.id)]),
	(): void => {
		emit(
			'select',
			getSelectedNodes.value.map((node) => node.id),
			getSelectedEdges.value.map((edge) => edge.id)
		);
	}
);

/*
 * Adding nodes: HTML5 drag & drop from the palette, or programmatic (tap on touch devices)
 */

const addNode = (type: string, position?: { x: number; y: number }): string | null => {
	const definition = getNodeType(type);

	if (!definition || props.readonly) {
		return null;
	}

	let target = position;

	if (!target) {
		const rect = container.value?.getBoundingClientRect();

		target = screenToFlowCoordinate({
			x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
			y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
		});
	}

	const id = shortId('n');

	addNodes([toFlowNode({ id, type, position: { x: Math.round(target.x), y: Math.round(target.y) }, config: { ...definition.defaultConfig } })]);

	emitGraph();

	return id;
};

const onDragOver = (event: DragEvent): void => {
	if (props.readonly || !event.dataTransfer?.types.includes(NODE_DRAG_MIME)) {
		return;
	}

	event.preventDefault();
	event.dataTransfer.dropEffect = 'copy';
};

const onDrop = (event: DragEvent): void => {
	const type = event.dataTransfer?.getData(NODE_DRAG_MIME);

	if (props.readonly || !type) {
		return;
	}

	event.preventDefault();

	addNode(type, screenToFlowCoordinate({ x: event.clientX, y: event.clientY }));
};

const removeSelected = (): void => {
	if (props.readonly) {
		return;
	}

	// Removing a node also removes its connected edges (library behaviour).
	removeEdges(getSelectedEdges.value);
	removeNodes(getSelectedNodes.value);
};

defineExpose({
	addNode,
	removeSelected,
	toGraph,
	fitView: (): void => {
		void fitView();
	},
	zoomTo: (zoom: number): void => {
		void zoomTo(zoom);
	},
	getViewport: (): { x: number; y: number; zoom: number } => ({ ...getViewport() }),
	// Spike only: lets the test drive the validator without a pointer gesture.
	checkConnection: (candidate: IAutomationConnectionCandidate): AutomationConnectionRejection | null =>
		validateConnection(
			getNodes.value.map((node: GraphNode<IAutomationNodeData>) => ({ id: node.id, type: node.data.type })),
			currentEdges(),
			candidate
		),
});
</script>

<style lang="scss">
/*
 * Not scoped: the library renders its own DOM. Everything is nested under `.automation-canvas`.
 * `@vue-flow/core/dist/theme-default.css` is deliberately NOT imported; the rules below replace it
 * and bind every colour to an Element Plus CSS variable so the `dark` class on <html> is enough.
 */
.automation-canvas {
	position: relative;
	width: 100%;
	height: 100%;
	min-height: 0;
	background-color: var(--el-bg-color-page);

	.vue-flow__node-automation {
		border-radius: var(--el-border-radius-base);
		cursor: grab;

		&.dragging {
			cursor: grabbing;
		}

		&:focus-visible {
			outline: 2px solid var(--el-color-primary);
			outline-offset: 3px;
		}
	}

	.vue-flow__handle {
		width: 12px;
		height: 12px;
		border: 2px solid var(--el-bg-color-overlay);
		border-radius: 50%;
		background-color: var(--el-text-color-secondary);

		// Bigger hit area for fingers without changing the visual size.
		&::after {
			position: absolute;
			inset: -12px;
			content: '';
		}

		&.connectable {
			cursor: crosshair;
		}

		&.connecting,
		&.connectionindicator:hover {
			background-color: var(--el-color-primary);
		}

		&.valid {
			background-color: var(--el-color-success);
		}
	}

	&__handle--yes,
	&__handle--done {
		background-color: var(--el-color-success) !important;
	}

	&__handle--no {
		background-color: var(--el-color-info) !important;
	}

	&__handle--error {
		background-color: var(--el-color-danger) !important;
	}

	&__port-label {
		position: absolute;
		right: 12px;
		transform: translateY(-50%);
		color: var(--el-text-color-secondary);
		font-size: 10px;
		line-height: 1;
		pointer-events: none;
	}

	.vue-flow__edge-path,
	.vue-flow__connection-path {
		stroke: var(--el-text-color-secondary);
		stroke-width: 2;
	}

	// Wider invisible stroke the library adds for hit testing; make it finger sized.
	.vue-flow__edge-interaction {
		stroke-width: 24;
	}

	&__edge--yes .vue-flow__edge-path,
	&__edge--done .vue-flow__edge-path {
		stroke: var(--el-color-success);
	}

	&__edge--error .vue-flow__edge-path {
		stroke: var(--el-color-danger);
	}

	.vue-flow__edge.selected .vue-flow__edge-path,
	.vue-flow__edge:focus-visible .vue-flow__edge-path {
		stroke: var(--el-color-primary);
		stroke-width: 3;
	}

	// The background component writes the colour into an SVG attribute, where var() does not resolve.
	.vue-flow__background pattern circle {
		fill: var(--el-border-color-darker);
	}

	.vue-flow__selection,
	.vue-flow__nodesselection-rect {
		border: 1px dashed var(--el-color-primary);
		background-color: var(--el-color-primary-light-9);
		opacity: 0.6;
	}

	.vue-flow__controls {
		overflow: hidden;
		border: 1px solid var(--el-border-color);
		border-radius: var(--el-border-radius-base);
		box-shadow: var(--el-box-shadow-lighter);
	}

	.vue-flow__controls-button {
		width: 20px;
		height: 20px;
		padding: 8px;
		border-bottom: 1px solid var(--el-border-color-lighter);
		background-color: var(--el-bg-color-overlay);
		color: var(--el-text-color-regular);

		&:last-child {
			border-bottom: none;
		}

		&:hover {
			background-color: var(--el-fill-color);
		}

		svg {
			max-width: 14px;
			max-height: 14px;
			fill: currentcolor;
		}
	}

	&--readonly {
		.vue-flow__node-automation {
			cursor: default;
		}

		.vue-flow__handle {
			pointer-events: none;
		}
	}
}
</style>
