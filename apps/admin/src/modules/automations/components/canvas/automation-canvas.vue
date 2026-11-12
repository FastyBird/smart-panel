<template>
	<div
		ref="container"
		class="automation-canvas"
		:class="{ 'automation-canvas--readonly': props.readonly }"
		data-test-id="automation-canvas"
		@dragover="onDragOver"
		@drop="onDrop"
	>
		<vue-flow
			:id="flowId"
			:connection-mode="ConnectionMode.Strict"
			:is-valid-connection="isValidConnection"
			:nodes-draggable="!props.readonly"
			:nodes-connectable="!props.readonly"
			:edges-updatable="false"
			:elements-selectable="true"
			:delete-key-code="props.readonly ? null : ['Backspace', 'Delete']"
			:connect-on-click="true"
			:connection-radius="30"
			:snap-to-grid="true"
			:snap-grid="[10, 10]"
			:min-zoom="0.2"
			:max-zoom="2"
		>
			<template #node-automation="nodeProps">
				<handle
					v-for="(port, index) in portsOf(nodeProps.id, nodeProps.data.type).inputs"
					:id="port"
					:key="`in-${port}`"
					type="target"
					:position="Position.Left"
					:style="{ top: handleOffset(index, portsOf(nodeProps.id, nodeProps.data.type).inputs.length) }"
					:data-test-port="port"
					@click.stop
				/>

				<automation-node-card
					v-bind="cardOf(nodeProps.data)"
					:selected="nodeProps.selected"
					:issue="severities.nodes.get(nodeProps.id)"
				/>

				<template
					v-for="(port, index) in portsOf(nodeProps.id, nodeProps.data.type).outputs"
					:key="`out-${port}`"
				>
					<span
						v-if="portsOf(nodeProps.id, nodeProps.data.type).outputs.length > 1"
						class="automation-canvas__port-label"
						:style="{ top: handleOffset(index, portsOf(nodeProps.id, nodeProps.data.type).outputs.length) }"
					>
						{{ portLabel(port) }}
					</span>
					<handle
						:id="port"
						type="source"
						:position="Position.Right"
						:class="`automation-canvas__handle--${edgeTone(port)}`"
						:style="{ top: handleOffset(index, portsOf(nodeProps.id, nodeProps.data.type).outputs.length) }"
						:data-test-port="port"
						@click.stop
					/>
				</template>
			</template>

			<background
				variant="dots"
				:gap="20"
				:size="1.5"
				:color="colors.background"
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
 * The ONLY file that imports the canvas library (ADR 0003, decision 1). Everything else talks plain graph
 * JSON, so the library can be replaced by rewriting this component:
 *   in:  `graph`         { version, nodes: [{ id, type, position, config }], edges: [{ id, source, source_port, target, target_port }] }
 *   out: `update:graph`  after every edit made on the canvas (a finished drag, a connection, a removal, an added node)
 */
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue';

import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import '@vue-flow/controls/dist/style.css';
import {
	type Connection,
	ConnectionMode,
	type Edge,
	type EdgeChange,
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
import { useMutationObserver } from '@vueuse/core';

import {
	AUTOMATION_GRAPH_MAX_NODES,
	AUTOMATION_NODE_DRAG_MIME,
	type AutomationConnectionRejection,
	AutomationNodeKind,
} from '../../automations.constants';
import {
	type IAutomationConnectionCandidate,
	createGraphId,
	findFreePosition,
	mapIssueSeverities,
	normalizePosition,
	resolveNodePorts,
	validateConnection,
} from '../../automations.graph';
import { useAutomationNodePresentation } from '../../composables/useAutomationNodePresentation';
import type { IAutomationGraph, IAutomationGraphEdge, IAutomationGraphNode } from '../../store/automations.store.types';
import type { IAutomationNodeType, IAutomationNodeTypePorts } from '../../store/node-types.store.types';

import {
	type AutomationEdgeTone,
	DEFAULT_SOURCE_PORT,
	DEFAULT_TARGET_PORT,
	type IAutomationCanvasNodeData,
	edgeTone,
	graphStructure,
	toCanvasEdge,
	toCanvasNode,
	toGraph,
} from './automation-canvas.mapping';
import type { IAutomationCanvasColors, IAutomationCanvasProps } from './automation-canvas.types';
import type { IAutomationNodeCardProps } from './automation-node-card.types';
import AutomationNodeCard from './automation-node-card.vue';

defineOptions({
	name: 'AutomationCanvas',
});

const props = withDefaults(defineProps<IAutomationCanvasProps>(), {
	issues: () => [],
	readonly: false,
	initialView: 'fit',
});

const emit = defineEmits<{
	(e: 'update:graph', graph: IAutomationGraph): void;
	(e: 'select', nodeIds: string[], edgeIds: string[]): void;
	(e: 'reject', reason: AutomationConnectionRejection): void;
}>();

const { kindLabel, nodeTitle, nodeIcon, nodeSummary, portLabel } = useAutomationNodePresentation();

const flowId = `automation-canvas-${useId()}`;

const container = ref<HTMLDivElement | null>(null);

const {
	addEdges,
	addNodes,
	addSelectedNodes,
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
	onNodesInitialized,
	removeEdges,
	removeNodes,
	removeSelectedElements,
	screenToFlowCoordinate,
	setCenter,
	setEdges,
	setNodes,
	setViewport,
	updateNodeInternals,
} = useVueFlow(flowId);

/*
 * Node types
 */

const nodeTypesByType = computed<Map<string, IAutomationNodeType>>(
	(): Map<string, IAutomationNodeType> => new Map(props.nodeTypes.map((nodeType) => [nodeType.type, nodeType]))
);

const lookup = (type: string): IAutomationNodeType | null => nodeTypesByType.value.get(type) ?? null;

const portsOf = (id: string, type: string): IAutomationNodeTypePorts => resolveNodePorts({ id, type }, props.graph.edges, lookup);

const handleOffset = (index: number, count: number): string => `${((index + 1) / (count + 1)) * 100}%`;

const cardOf = (data: IAutomationCanvasNodeData): IAutomationNodeCardProps => {
	const nodeType = lookup(data.type);

	return {
		kind: nodeType?.kind ?? null,
		kindLabel: kindLabel(nodeType?.kind ?? null),
		icon: nodeIcon(data.type, nodeType),
		title: nodeTitle(data.type, nodeType),
		summary: nodeSummary(data, nodeType),
	};
};

/*
 * Colours. The arrowheads and the background pattern are drawn by the library from the values it is
 * given, where a stylesheet cannot reach them (and a CSS variable does not resolve in an SVG attribute),
 * so the Element Plus variables are read here and handed over as props. They are read again whenever the
 * theme class on the document changes.
 */

const readColor = (name: string, fallback: string): string => {
	const value = getComputedStyle(container.value ?? document.documentElement)
		.getPropertyValue(name)
		.trim();

	return value !== '' ? value : fallback;
};

const readColors = (): IAutomationCanvasColors => ({
	background: readColor('--el-border-color-darker', '#cdd0d6'),
	edges: {
		default: readColor('--el-text-color-secondary', '#909399'),
		positive: readColor('--el-color-success', '#67c23a'),
		negative: readColor('--el-color-danger', '#f56c6c'),
		muted: readColor('--el-color-info', '#909399'),
	},
	issues: {
		error: readColor('--el-color-danger', '#f56c6c'),
		warning: readColor('--el-color-warning', '#e6a23c'),
	},
});

const colors = ref<IAutomationCanvasColors>(readColors());

useMutationObserver(
	typeof document === 'undefined' ? null : document.documentElement,
	(): void => {
		colors.value = readColors();
	},
	{ attributes: true, attributeFilter: ['class', 'style'] }
);

/*
 * Issues
 */

const severities = computed(() => mapIssueSeverities(props.issues));

/*
 * Graph JSON -> library
 */

const toFlowNode = (node: IAutomationGraphNode): Node<IAutomationCanvasNodeData> => {
	const nodeType = lookup(node.type);

	return {
		...toCanvasNode(node),
		ariaLabel: `${kindLabel(nodeType?.kind ?? null)}: ${nodeTitle(node.type, nodeType)}`,
	};
};

const edgeAppearance = (id: string, sourcePort: string): Pick<Edge, 'class' | 'markerEnd'> => {
	const tone: AutomationEdgeTone = edgeTone(sourcePort);
	const issue = severities.value.edges.get(id);

	return {
		class: ['automation-canvas__edge', `automation-canvas__edge--${tone}`, ...(issue ? [`automation-canvas__edge--${issue}`] : [])].join(' '),
		markerEnd: { type: MarkerType.ArrowClosed, color: issue ? colors.value.issues[issue] : colors.value.edges[tone] },
	};
};

const toFlowEdge = (edge: IAutomationGraphEdge): Edge => ({
	...toCanvasEdge(edge),
	...edgeAppearance(edge.id, edge.source_port),
});

// The colour of an arrowhead and the outline of a refused edge are part of the edge the library holds
watch([colors, severities], (): void => {
	for (const edge of getEdges.value) {
		Object.assign(edge, edgeAppearance(edge.id, edge.sourceHandle ?? DEFAULT_SOURCE_PORT));
	}
});

/*
 * Library -> graph JSON
 */

const readGraph = (): IAutomationGraph => toGraph(props.graph.version, getNodes.value, getEdges.value);

let lastSynced = '';
let emitScheduled = false;

// The library runs `isValidConnection` on every edge it is handed, not only on the ones being drawn. A
// graph that is loaded or restored is shown as it is - what is wrong with it is the backend's to say - so
// the check stands back while edges are put on the canvas by the wrapper itself.
let placingEdges = false;

const placeEdges = (place: () => void): void => {
	placingEdges = true;

	try {
		place();
	} finally {
		placingEdges = false;
	}
};

const emitGraph = (): void => {
	if (emitScheduled) {
		return;
	}

	emitScheduled = true;

	// One edit arrives as several changes (a node and its edges, every node of a dragged selection)
	void nextTick((): void => {
		emitScheduled = false;

		const graph = readGraph();
		const serialised = JSON.stringify(graph);

		if (serialised === lastSynced) {
			return;
		}

		lastSynced = serialised;

		emit('update:graph', graph);
	});
};

watch(
	(): IAutomationGraph => props.graph,
	(graph: IAutomationGraph): void => {
		const serialised = JSON.stringify(graph);

		if (serialised === lastSynced) {
			return;
		}

		const sameStructure = lastSynced !== '' && graphStructure(graph) === graphStructure(readGraph());

		lastSynced = serialised;

		if (sameStructure) {
			// A configuration or position changed from outside (the form, undo): patch in place, which keeps
			// the selection and the sizes the library has measured
			for (const node of graph.nodes) {
				const existing = findNode<IAutomationCanvasNodeData>(node.id);

				if (existing) {
					const next = toCanvasNode(node);

					existing.position = next.position;
					existing.data = next.data;
				}
			}

			return;
		}

		const selected = new Set(getSelectedNodes.value.map((node) => node.id));

		setNodes(graph.nodes.map(toFlowNode));
		placeEdges((): void => setEdges(graph.edges.map(toFlowEdge)));

		// The node the library is given has no `selected` field, so the selection is put back afterwards
		addSelectedNodes(getNodes.value.filter((node) => selected.has(node.id)));
	},
	{ deep: true, immediate: true }
);

// The handles of a card come from the catalogue; when it arrives late the library has to measure them again
watch(nodeTypesByType, (): void => {
	void nextTick((): void => {
		updateNodeInternals();
	});
});

/*
 * Connection validation. The library default lets a source handle connect to another source handle, so the
 * mode is strict, and every candidate is checked against what the backend would refuse.
 */

let lastRejection: AutomationConnectionRejection | null = null;
let connectedInGesture = false;

const toCandidate = (connection: Connection): IAutomationConnectionCandidate => ({
	source: connection.source,
	source_port: connection.sourceHandle ?? DEFAULT_SOURCE_PORT,
	target: connection.target,
	target_port: connection.targetHandle ?? DEFAULT_TARGET_PORT,
});

const checkConnection = (candidate: IAutomationConnectionCandidate): AutomationConnectionRejection | null =>
	validateConnection(readGraph(), candidate, lookup);

const isValidConnection = (connection: Connection): boolean => {
	if (placingEdges) {
		return true;
	}

	lastRejection = checkConnection(toCandidate(connection));

	return lastRejection === null;
};

onConnectStart((): void => {
	lastRejection = null;
	connectedInGesture = false;
});

onConnect((connection: Connection): void => {
	connectedInGesture = true;

	// `isValidConnection` has run for a drag, but this is the last line of defence for a tap-tap connection
	if (!isValidConnection(connection)) {
		return;
	}

	const candidate = toCandidate(connection);

	const id = createGraphId(
		'e',
		getEdges.value.map((edge) => edge.id)
	);

	placeEdges((): void => addEdges([toFlowEdge({ id, ...candidate })]));

	emitGraph();
});

onConnectEnd((): void => {
	// The order of `connect` and `connectEnd` is not documented; decide once both have had their turn
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
 * Initial view. Fitting the whole graph is what a wide screen wants; at phone width it makes every card
 * unreadable, so there the view starts at the first trigger instead.
 */

// An empty canvas has nothing to show: the first card added to it must not make the view jump
let viewInitialised = props.graph.nodes.length === 0;

const showFirstTrigger = (): void => {
	const nodes = getNodes.value as GraphNode<IAutomationCanvasNodeData>[];
	const first = nodes.find((node) => lookup(node.data.type)?.kind === AutomationNodeKind.trigger) ?? nodes[0];

	if (first) {
		void setViewport({ x: 16 - first.position.x, y: 16 - first.position.y, zoom: 1 });
	}
};

onNodesInitialized((): void => {
	if (viewInitialised) {
		return;
	}

	viewInitialised = true;

	if (props.initialView === 'first-trigger') {
		showFirstTrigger();
	} else {
		// Never beyond full size: a flow of one or two cards would otherwise fill the whole canvas
		void fitView({ maxZoom: 1, padding: 0.15 });
	}
});

/*
 * Adding nodes: dragged from the palette (HTML5 drag and drop, which a touch does not start) or added by
 * a tap on a palette item, which puts the card in the middle of what is visible.
 */

// A card added by a tap must not land on top of another one
const freePosition = (position: { x: number; y: number }): { x: number; y: number } =>
	findFreePosition(
		position,
		getNodes.value.map((node) => ({
			x: node.position.x,
			y: node.position.y,
			width: node.dimensions.width || 280,
			height: node.dimensions.height || 56,
		}))
	);

const addNode = (type: string, position?: { x: number; y: number }): string | null => {
	if (props.readonly || lookup(type) === null) {
		return null;
	}

	if (getNodes.value.length >= AUTOMATION_GRAPH_MAX_NODES) {
		emit('reject', 'limit');

		return null;
	}

	let target = position;

	if (!target) {
		const rect = container.value?.getBoundingClientRect();

		target = screenToFlowCoordinate({
			x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2 - 140,
			y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2 - 30,
		});
	}

	const id = createGraphId(
		'n',
		getNodes.value.map((node) => node.id)
	);

	addNodes([toFlowNode({ id, type, position: position ? normalizePosition(target) : freePosition(target), config: {} })]);

	emitGraph();

	// The new card is what the user wants to configure next
	void nextTick((): void => {
		const added = findNode(id);

		if (added) {
			removeSelectedElements();
			addSelectedNodes([added]);
		}
	});

	return id;
};

const onDragOver = (event: DragEvent): void => {
	if (props.readonly || !event.dataTransfer?.types.includes(AUTOMATION_NODE_DRAG_MIME)) {
		return;
	}

	event.preventDefault();
	event.dataTransfer.dropEffect = 'copy';
};

const onDrop = (event: DragEvent): void => {
	const type = event.dataTransfer?.getData(AUTOMATION_NODE_DRAG_MIME);

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

	// Removing a node also removes the edges attached to it (the library does that)
	removeEdges(getSelectedEdges.value);
	removeNodes(getSelectedNodes.value);
};

const removeNode = (id: string): void => {
	if (!props.readonly) {
		removeNodes([id]);
	}
};

const clearSelection = (): void => {
	removeSelectedElements();
};

const focusNode = (id: string): void => {
	const node = findNode(id);

	if (!node) {
		return;
	}

	removeSelectedElements();
	addSelectedNodes([node]);

	void setCenter(node.position.x + (node.dimensions.width || 280) / 2, node.position.y + (node.dimensions.height || 56) / 2, {
		zoom: Math.max(getViewport().zoom, 0.75),
		duration: 200,
	});
};

/**
 * Brings a node back into view when it is cut off - which happens to a card near the right edge once the
 * panel with its form opens beside the canvas and takes that room.
 */
const revealNode = (id: string): void => {
	const node = findNode(id);
	const rect = container.value?.getBoundingClientRect();

	if (!node || !rect || rect.width === 0 || rect.height === 0) {
		return;
	}

	const margin = 24;
	const viewport = getViewport();

	const left = node.position.x * viewport.zoom + viewport.x;
	const top = node.position.y * viewport.zoom + viewport.y;
	const right = left + (node.dimensions.width || 280) * viewport.zoom;
	const bottom = top + (node.dimensions.height || 56) * viewport.zoom;

	let dx = 0;
	let dy = 0;

	if (right > rect.width - margin) dx = rect.width - margin - right;
	if (left + dx < margin) dx = margin - left;
	if (bottom > rect.height - margin) dy = rect.height - margin - bottom;
	if (top + dy < margin) dy = margin - top;

	if (dx !== 0 || dy !== 0) {
		void setViewport({ x: viewport.x + dx, y: viewport.y + dy, zoom: viewport.zoom }, { duration: 150 });
	}
};

onMounted((): void => {
	colors.value = readColors();
});

defineExpose({
	addNode,
	removeNode,
	removeSelected,
	clearSelection,
	focusNode,
	revealNode,
	checkConnection,
	getGraph: readGraph,
	fitView: (): void => {
		void fitView();
	},
	getViewport: (): { x: number; y: number; zoom: number } => ({ ...getViewport() }),
});
</script>

<style lang="scss">
/*
 * Not scoped: the library renders its own DOM. Everything is nested under `.automation-canvas`.
 * `@vue-flow/core/dist/theme-default.css` is deliberately NOT imported; the rules below replace it and bind
 * every colour to an Element Plus CSS variable, so the `dark` class on <html> is all dark mode needs.
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

		// A bigger hit area for fingers without changing how the handle looks
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

	&__handle--positive {
		background-color: var(--el-color-success) !important;
	}

	&__handle--muted {
		background-color: var(--el-color-info) !important;
	}

	&__handle--negative {
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
		fill: none;
		stroke: var(--el-text-color-secondary);
		stroke-width: 2;
	}

	// The wider invisible stroke the library adds for hit testing, made finger sized
	.vue-flow__edge-interaction {
		stroke-width: 24;
	}

	&__edge--positive .vue-flow__edge-path {
		stroke: var(--el-color-success);
	}

	&__edge--negative .vue-flow__edge-path {
		stroke: var(--el-color-danger);
	}

	&__edge--muted .vue-flow__edge-path {
		stroke: var(--el-color-info);
	}

	&__edge--warning .vue-flow__edge-path {
		stroke: var(--el-color-warning);
		stroke-dasharray: 6 4;
	}

	&__edge--error .vue-flow__edge-path {
		stroke: var(--el-color-danger);
		stroke-dasharray: 6 4;
	}

	.vue-flow__edge.selected .vue-flow__edge-path,
	.vue-flow__edge:focus-visible .vue-flow__edge-path {
		stroke: var(--el-color-primary);
		stroke-width: 3;
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
		border: none;
		border-bottom: 1px solid var(--el-border-color-lighter);
		background-color: var(--el-bg-color-overlay);
		color: var(--el-text-color-regular);
		cursor: pointer;

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
