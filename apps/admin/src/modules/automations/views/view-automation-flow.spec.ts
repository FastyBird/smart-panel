/* eslint-disable vue/one-component-per-file */
import { type Ref, computed, ref } from 'vue';

import { ElMessageBox } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import {
	AutomationMode,
	AutomationNodeKind,
	AutomationRunRecordStatus,
	AutomationStatus,
	AutomationTriggerOutcome,
	RouteNames,
} from '../automations.constants';
import { AutomationsApiException, AutomationsTriggerRefusedException } from '../automations.exceptions';
import { mapTraceToOverlay } from '../automations.trace';
import type { IAutomationShownRun } from '../composables/types';
import type { IAutomation, IAutomationGraph, IAutomationGraphIssue } from '../store/automations.store.types';
import type { IAutomationRun, IAutomationRuntime } from '../store/runs.store.types';

import ViewAutomationFlow from './view-automation-flow.vue';

const automationId = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a01';

const graph: IAutomationGraph = {
	version: 1,
	nodes: [
		{ id: 't1', type: 'manual.start', position: { x: 0, y: 0 }, config: {} },
		{ id: 'a1', type: 'notification.send', position: { x: 300, y: 0 }, config: { title: 'Hello' } },
	],
	edges: [{ id: 'e1', source: 't1', source_port: 'out', target: 'a1', target_port: 'in' }],
};

const mocks = vi.hoisted(() => ({
	isMDDevice: true,
	routerPush: vi.fn(),
	leaveGuard: null as null | (() => Promise<boolean>),
	updateGuard: null as null | ((to: { params: { id: string } }, from: { params: { id: string } }) => Promise<boolean> | boolean),
	flash: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
	fetchNodeTypes: vi.fn(),
	canvas: { addNode: vi.fn(), removeNode: vi.fn(), removeSelected: vi.fn(), focusNode: vi.fn(), revealNode: vi.fn() },
	editor: null as unknown,
	runs: null as unknown,
}));

interface IRunsMock {
	runs: Ref<IAutomationRun[]>;
	runsLoading: Ref<boolean>;
	runsLoadFailed: Ref<boolean>;
	runtime: Ref<IAutomationRuntime | null>;
	testing: Ref<boolean>;
	watching: Ref<boolean>;
	shown: Ref<IAutomationShownRun | null>;
	fetchRuns: ReturnType<typeof vi.fn>;
	fetchRuntime: ReturnType<typeof vi.fn>;
	test: ReturnType<typeof vi.fn>;
	replay: ReturnType<typeof vi.fn>;
	close: ReturnType<typeof vi.fn>;
}

interface IEditorMock {
	automation: Ref<IAutomation | null>;
	graph: Ref<IAutomationGraph>;
	issues: Ref<IAutomationGraphIssue[]>;
	saving: Ref<boolean>;
	reloading: Ref<boolean>;
	conflict: Ref<boolean>;
	isDirty: Ref<boolean>;
	draftInvalid: Ref<boolean>;
	draftResets: Ref<number>;
	hasUnsaved: Ref<boolean>;
	hasSeparateFlows: Ref<boolean>;
	canUndo: Ref<boolean>;
	canRedo: Ref<boolean>;
	load: ReturnType<typeof vi.fn>;
	updateGraph: ReturnType<typeof vi.fn>;
	updateNodeConfig: ReturnType<typeof vi.fn>;
	setDraftInvalid: ReturnType<typeof vi.fn>;
	discardDraft: ReturnType<typeof vi.fn>;
	undo: ReturnType<typeof vi.fn>;
	redo: ReturnType<typeof vi.fn>;
	save: ReturnType<typeof vi.fn>;
	setEnabled: ReturnType<typeof vi.fn>;
	reloadLatest: ReturnType<typeof vi.fn>;
	overwrite: ReturnType<typeof vi.fn>;
}

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
		te: () => false,
	}),
}));

vi.mock('vue-meta', () => ({
	useMeta: () => ({ meta: {} }),
}));

vi.mock('vue-router', () => ({
	useRouter: () => ({
		push: mocks.routerPush,
		resolve: (route: unknown) => route,
	}),
	onBeforeRouteLeave: (guard: () => Promise<boolean>): void => {
		mocks.leaveGuard = guard;
	},
	onBeforeRouteUpdate: (guard: typeof mocks.updateGuard): void => {
		mocks.updateGuard = guard;
	},
}));

vi.mock('../../../common', async () => {
	const { defineComponent, h, computed: vueComputed, ref: vueRef } = await import('vue');

	// The breakpoint can change while the view is open
	const md = vueRef<boolean>(mocks.isMDDevice);

	Object.defineProperty(mocks, 'isMDDevice', {
		get: (): boolean => md.value,
		set: (value: boolean): void => {
			md.value = value;
		},
	});

	const Stub = defineComponent({
		inheritAttrs: false,
		setup(_, { slots }) {
			return () => h('div', [slots.default?.(), slots.extra?.()]);
		},
	});

	return {
		AppBarButton: Stub,
		AppBarButtonAlign: { LEFT: 'left', RIGHT: 'right' },
		AppBarHeading: Stub,
		AppBreadcrumbs: Stub,
		ViewHeader: Stub,
		EntityNotFound: defineComponent({
			props: { message: { type: String, required: true } },
			emits: ['back'],
			template: '<div data-test-id="not-found">{{ message }}</div>',
		}),
		useBreakpoints: () => ({ isMDDevice: vueComputed(() => md.value) }),
		useFlashMessage: () => mocks.flash,
	};
});

vi.mock('../composables/composables', () => ({
	useAutomationEditor: () => mocks.editor,
	useAutomationRunTrace: () => mocks.runs,
	useAutomationRunPresentation: () => ({
		nodeLabel: (nodeId: string) => `label:${nodeId}`,
		outcomeText: (outcome: string) => `outcome:${outcome}`,
		refusalText: (refusal: string | null) => `refusal:${refusal}`,
	}),
	useAutomationNodeTypes: () => ({
		nodeTypes: computed(() => []),
		fetchNodeTypes: mocks.fetchNodeTypes,
		// Only the triggers matter to the view: they are what a test can start at
		getNodeType: (type: string) =>
			type === 'manual.start' || type === 'time.of-day'
				? { type, kind: AutomationNodeKind.trigger, name: type, description: '', ports: { inputs: [], outputs: ['out'] }, configSchema: {} }
				: null,
	}),
	useAutomationNodePlugins: () => ({
		getFormComponent: () => null,
		getCardComponent: () => null,
	}),
}));

vi.mock('../components/components', async () => {
	const { defineComponent, h } = await import('vue');

	return {
		AutomationCanvas: defineComponent({
			name: 'AutomationCanvas',
			props: {
				graph: { type: Object, required: true },
				nodeTypes: { type: Array, required: true },
				issues: { type: Array, required: true },
				readonly: { type: Boolean, required: true },
				initialView: { type: String, required: true },
				run: { type: Object, required: false, default: null },
			},
			emits: ['update:graph', 'select', 'reject'],
			setup(_, { expose }) {
				expose(mocks.canvas);

				return () => h('div', { 'data-test-id': 'canvas-stub' });
			},
		}),
		AutomationPalette: defineComponent({
			name: 'AutomationPalette',
			emits: ['add'],
			template: '<div data-test-id="palette-stub" />',
		}),
		AutomationNodePanel: defineComponent({
			name: 'AutomationNodePanel',
			props: {
				node: { type: Object, required: true },
				nodeType: { type: Object, required: false, default: null },
				issues: { type: Array, required: true },
				disabled: { type: Boolean, default: false },
			},
			emits: ['update:config', 'update:invalid', 'remove', 'close'],
			template: '<div data-test-id="panel-stub" />',
		}),
		AutomationIssuesList: defineComponent({
			name: 'AutomationIssuesList',
			props: { issues: { type: Array, required: true } },
			emits: ['focus'],
			template: '<div data-test-id="issues-stub" />',
		}),
		AutomationTestButton: defineComponent({
			name: 'AutomationTestButton',
			props: {
				triggers: { type: Array, required: true },
				disabledReason: { type: String, required: false, default: null },
				loading: { type: Boolean, default: false },
			},
			emits: ['test'],
			template: '<div data-test-id="test-button-stub" />',
		}),
		AutomationRunHistory: defineComponent({
			name: 'AutomationRunHistory',
			props: {
				runs: { type: Array, required: true },
				selectedRunId: { type: String, required: false, default: null },
				loading: { type: Boolean, default: false },
				failed: { type: Boolean, default: false },
			},
			emits: ['select', 'reload'],
			template: '<div data-test-id="run-history-stub" />',
		}),
		AutomationRunSummary: defineComponent({
			name: 'AutomationRunSummary',
			props: {
				shown: { type: Object, required: true },
				revision: { type: Number, required: true },
				unsaved: { type: Boolean, default: false },
			},
			emits: ['focus', 'close'],
			template: '<div data-test-id="run-summary-stub" />',
		}),
		AutomationStatusExplanation: defineComponent({
			name: 'AutomationStatusExplanation',
			props: {
				status: { type: String, required: true },
				runtime: { type: Object, required: false, default: null },
			},
			emits: ['focus'],
			template: '<div data-test-id="status-explanation-stub" />',
		}),
	};
});

const createEditor = (): IEditorMock => {
	const isDirty = ref(false);
	const draftInvalid = ref(false);
	const draftResets = ref(0);

	return {
		automation: ref<IAutomation | null>({
			id: automationId,
			name: 'Hallway motion light',
			description: null,
			icon: null,
			enabled: false,
			spaceId: null,
			mode: AutomationMode.restart,
			graph,
			revision: 3,
			status: AutomationStatus.ok,
			lastTriggeredAt: null,
			lastRunStatus: null,
			createdAt: new Date(),
			updatedAt: null,
		}),
		graph: ref(graph),
		issues: ref([]),
		saving: ref(false),
		reloading: ref(false),
		conflict: ref(false),
		isDirty,
		draftInvalid,
		draftResets,
		hasUnsaved: computed(() => isDirty.value || draftInvalid.value),
		hasSeparateFlows: ref(false),
		canUndo: ref(false),
		canRedo: ref(false),
		load: vi.fn().mockResolvedValue(undefined),
		updateGraph: vi.fn(),
		updateNodeConfig: vi.fn(),
		setDraftInvalid: vi.fn((invalid: boolean): void => {
			draftInvalid.value = invalid;
		}),
		discardDraft: vi.fn((): void => {
			if (draftInvalid.value) {
				draftInvalid.value = false;
				draftResets.value += 1;
			}
		}),
		undo: vi.fn(),
		redo: vi.fn(),
		save: vi.fn().mockResolvedValue('saved'),
		setEnabled: vi.fn().mockResolvedValue(true),
		reloadLatest: vi.fn().mockResolvedValue(undefined),
		overwrite: vi.fn().mockResolvedValue('saved'),
	};
};

const createRuns = (): IRunsMock => ({
	runs: ref<IAutomationRun[]>([]),
	runsLoading: ref(false),
	runsLoadFailed: ref(false),
	runtime: ref<IAutomationRuntime | null>(null),
	testing: ref(false),
	watching: ref(true),
	shown: ref<IAutomationShownRun | null>(null),
	fetchRuns: vi.fn().mockResolvedValue(undefined),
	fetchRuntime: vi.fn().mockResolvedValue(undefined),
	test: vi.fn().mockResolvedValue({ automationId, started: true, outcome: AutomationTriggerOutcome.started, runId: 'r1', reason: null }),
	replay: vi.fn(),
	close: vi.fn(),
});

const createRun = (overrides: Partial<IAutomationRun> = {}): IAutomationRun => ({
	id: '0b6f1b44-7a3f-4c49-9f53-0c1d2e3f4a51',
	automationId,
	revision: 3,
	status: AutomationRunRecordStatus.interrupted,
	triggerNodeId: 't1',
	manual: true,
	startedAt: new Date('2026-11-11T07:30:00.000Z'),
	finishedAt: null,
	durationMs: null,
	endReason: 'backend_restarted',
	trace: null,
	...overrides,
});

describe('ViewAutomationFlow', (): void => {
	let wrapper: VueWrapper;
	let editor: IEditorMock;
	let runs: IRunsMock;

	const createWrapper = async (): Promise<void> => {
		wrapper = mount(ViewAutomationFlow, { props: { id: automationId }, attachTo: document.body });

		await flushPromises();
	};

	const canvas = (): VueWrapper => wrapper.findComponent({ name: 'AutomationCanvas' }) as unknown as VueWrapper;

	const press = (key: string, modifiers: KeyboardEventInit = { ctrlKey: true }, target: EventTarget = window): KeyboardEvent => {
		const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers });

		target.dispatchEvent(event);

		return event;
	};

	beforeEach((): void => {
		vi.clearAllMocks();

		mocks.isMDDevice = true;
		mocks.leaveGuard = null;
		mocks.updateGuard = null;
		mocks.fetchNodeTypes.mockResolvedValue(undefined);

		editor = createEditor();
		mocks.editor = editor;

		runs = createRuns();
		mocks.runs = runs;
	});

	afterEach((): void => {
		wrapper.unmount();

		vi.restoreAllMocks();
	});

	it('reads the catalogue and the automation, then shows the editor', async (): Promise<void> => {
		await createWrapper();

		expect(mocks.fetchNodeTypes).toHaveBeenCalledTimes(1);
		expect(editor.load).toHaveBeenCalledTimes(1);
		expect(wrapper.find('[data-test-id="palette-stub"]').exists()).toBe(true);
		expect(canvas().props()).toMatchObject({ graph, readonly: false, initialView: 'fit' });
		expect(wrapper.find('[data-test-id="save-flow"]').exists()).toBe(true);
	});

	it('says so when the automation is not there', async (): Promise<void> => {
		editor.load.mockRejectedValue(new AutomationsApiException('Failed to get automation.', 404));
		editor.automation.value = null;

		await createWrapper();

		expect(wrapper.find('[data-test-id="not-found"]').text()).toBe('automations.messages.notFound');
		expect(wrapper.find('[data-test-id="load-failed"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="canvas-stub"]').exists()).toBe(false);
	});

	it('does not take a catalogue that cannot be read for a missing automation', async (): Promise<void> => {
		mocks.fetchNodeTypes.mockRejectedValueOnce(new AutomationsApiException('Failed to fetch automation node types.', 404));

		await createWrapper();

		expect(wrapper.find('[data-test-id="not-found"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="load-failed"]').exists()).toBe(true);

		await wrapper.find('[data-test-id="retry-load"]').trigger('click');
		await flushPromises();

		expect(mocks.fetchNodeTypes).toHaveBeenCalledTimes(2);
		expect(wrapper.find('[data-test-id="canvas-stub"]').exists()).toBe(true);
	});

	it('tells a failed read apart from a missing automation and reads again when asked to', async (): Promise<void> => {
		editor.load.mockRejectedValueOnce(new AutomationsApiException('Failed to get automation.', null));

		await createWrapper();

		expect(wrapper.find('[data-test-id="load-failed"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="not-found"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="canvas-stub"]').exists()).toBe(false);

		await wrapper.find('[data-test-id="retry-load"]').trigger('click');
		await flushPromises();

		expect(mocks.fetchNodeTypes).toHaveBeenCalledTimes(2);
		expect(editor.load).toHaveBeenCalledTimes(2);
		expect(wrapper.find('[data-test-id="load-failed"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="canvas-stub"]').exists()).toBe(true);
	});

	it('is read-only below the md breakpoint: no palette, no save, the first trigger in view', async (): Promise<void> => {
		mocks.isMDDevice = false;

		await createWrapper();

		expect(canvas().props()).toMatchObject({ readonly: true, initialView: 'first-trigger' });
		expect(wrapper.find('[data-test-id="palette-stub"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="save-flow"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="undo"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="readonly-tag"]').exists()).toBe(true);
		// Enabling and disabling stays possible
		expect(wrapper.find('[data-test-id="toggle-automation"]').exists()).toBe(true);

		canvas().vm.$emit('select', ['a1'], []);

		await flushPromises();

		expect(wrapper.find('[data-test-id="panel-stub"]').isVisible()).toBe(false);

		press('s');
		press('z');

		expect(editor.save).not.toHaveBeenCalled();
		expect(editor.undo).not.toHaveBeenCalled();
	});

	it('opens the panel for one selected node only, and lets it be dismissed', async (): Promise<void> => {
		await createWrapper();

		expect(wrapper.find('[data-test-id="panel-stub"]').exists()).toBe(false);

		canvas().vm.$emit('select', ['a1'], []);
		await flushPromises();

		const panel = wrapper.findComponent({ name: 'AutomationNodePanel' });

		expect(panel.props('node')).toEqual(graph.nodes[1]);
		expect(mocks.canvas.revealNode).toHaveBeenCalledWith('a1');

		panel.vm.$emit('close');
		await flushPromises();

		expect(wrapper.find('[data-test-id="panel-stub"]').exists()).toBe(false);

		canvas().vm.$emit('select', ['t1', 'a1'], []);
		await flushPromises();

		expect(wrapper.find('[data-test-id="panel-stub"]').exists()).toBe(false);
	});

	it('hands the panel the issues of its node', async (): Promise<void> => {
		editor.issues.value = [
			{ severity: 'error', code: 'invalid_config', message: 'Not valid.', node_id: 'a1', field: 'title', blocking: true },
			{ severity: 'error', code: 'cycle', message: 'Loop.', node_ids: ['t1', 'a1'], blocking: true },
			{ severity: 'warning', code: 'unreachable_node', message: 'Unreachable.', node_id: 't1', blocking: false },
		];

		await createWrapper();

		canvas().vm.$emit('select', ['a1'], []);
		await flushPromises();

		expect((wrapper.findComponent({ name: 'AutomationNodePanel' }).props('issues') as IAutomationGraphIssue[]).map((issue) => issue.code)).toEqual([
			'invalid_config',
			'cycle',
		]);
		expect(wrapper.find('[data-test-id="issues-stub"]').exists()).toBe(true);
	});

	it('passes the edits of the canvas, the palette and the form on', async (): Promise<void> => {
		await createWrapper();

		const next: IAutomationGraph = { ...graph, edges: [] };

		canvas().vm.$emit('update:graph', next);
		wrapper.findComponent({ name: 'AutomationPalette' }).vm.$emit('add', 'flow.delay');
		canvas().vm.$emit('select', ['a1'], []);
		await flushPromises();

		const panel = wrapper.findComponent({ name: 'AutomationNodePanel' });

		panel.vm.$emit('update:config', { title: 'Changed' }, 'title');
		panel.vm.$emit('remove');

		expect(editor.updateGraph).toHaveBeenCalledWith(next);
		expect(mocks.canvas.addNode).toHaveBeenCalledWith('flow.delay');
		expect(editor.updateNodeConfig).toHaveBeenCalledWith('a1', { title: 'Changed' }, 'title');
		expect(mocks.canvas.removeNode).toHaveBeenCalledWith('a1');
	});

	it('tells why a connection was refused', async (): Promise<void> => {
		await createWrapper();

		canvas().vm.$emit('reject', 'cycle');

		expect(mocks.flash.warning).toHaveBeenCalledWith('automations.editor.rejections.cycle');
	});

	it('saves only when there is something to save', async (): Promise<void> => {
		await createWrapper();

		expect(wrapper.find('[data-test-id="save-flow"]').attributes('disabled')).toBeDefined();
		expect(wrapper.find('[data-test-id="unsaved-tag"]').exists()).toBe(false);

		press('s');

		expect(editor.save).not.toHaveBeenCalled();

		editor.isDirty.value = true;
		await flushPromises();

		expect(wrapper.find('[data-test-id="unsaved-tag"]').exists()).toBe(true);

		await wrapper.find('[data-test-id="save-flow"]').trigger('click');

		expect(editor.save).toHaveBeenCalledTimes(1);

		expect(press('s').defaultPrevented).toBe(true);
		expect(editor.save).toHaveBeenCalledTimes(2);
	});

	it('undoes and redoes from the toolbar and the keyboard, but not inside a text field', async (): Promise<void> => {
		editor.canUndo.value = true;
		editor.canRedo.value = true;

		await createWrapper();

		await wrapper.find('[data-test-id="undo"]').trigger('click');
		await wrapper.find('[data-test-id="redo"]').trigger('click');

		press('z');
		press('z', { ctrlKey: true, shiftKey: true });
		press('y', { metaKey: true });

		expect(editor.undo).toHaveBeenCalledTimes(2);
		expect(editor.redo).toHaveBeenCalledTimes(3);

		// The browser's own undo belongs to the text being typed
		const input = document.createElement('input');

		document.body.appendChild(input);

		expect(press('z', { ctrlKey: true }, input).defaultPrevented).toBe(false);
		expect(editor.undo).toHaveBeenCalledTimes(2);

		input.remove();
	});

	it('asks before an undo or a redo replaces text in the form that does not parse', async (): Promise<void> => {
		editor.canUndo.value = true;
		editor.canRedo.value = true;

		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel').mockRejectedValueOnce('cancel');

		await createWrapper();

		canvas().vm.$emit('select', ['a1'], []);
		await flushPromises();

		wrapper.findComponent({ name: 'AutomationNodePanel' }).vm.$emit('update:invalid', true);
		await flushPromises();

		// Turned down: nothing changes, and the text stays
		await wrapper.find('[data-test-id="undo"]').trigger('click');
		await flushPromises();

		press('y');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(2);
		expect(editor.undo).not.toHaveBeenCalled();
		expect(editor.redo).not.toHaveBeenCalled();
		expect(editor.discardDraft).not.toHaveBeenCalled();
		expect(editor.draftInvalid.value).toBe(true);

		// Agreed: the text is given up, the form rebuilt, and the step taken
		confirm.mockResolvedValueOnce('confirm' as never);

		const before = wrapper.findComponent({ name: 'AutomationNodePanel' });

		press('z');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(3);
		expect(editor.discardDraft).toHaveBeenCalledTimes(1);
		expect(editor.undo).toHaveBeenCalledTimes(1);
		expect(editor.draftInvalid.value).toBe(false);
		expect(wrapper.findComponent({ name: 'AutomationNodePanel' }).vm.$.uid).not.toBe(before.vm.$.uid);
	});

	it('keeps text in the form that does not parse while the window is narrowed and widened again', async (): Promise<void> => {
		const confirm = vi.spyOn(ElMessageBox, 'confirm');

		await createWrapper();

		canvas().vm.$emit('select', ['a1'], []);
		await flushPromises();

		const before = wrapper.findComponent({ name: 'AutomationNodePanel' });

		before.vm.$emit('update:invalid', true);
		await flushPromises();

		mocks.isMDDevice = false;
		await flushPromises();

		// Out of sight and out of reach, but still there, and still unsaved
		const hidden = wrapper.findComponent({ name: 'AutomationNodePanel' });

		expect(hidden.vm.$.uid).toBe(before.vm.$.uid);
		expect(hidden.isVisible()).toBe(false);
		expect(hidden.props('disabled')).toBe(true);
		expect(editor.draftInvalid.value).toBe(true);
		expect(wrapper.find('[data-test-id="unsaved-tag"]').exists()).toBe(true);

		// Looking at another card does not ask about a form that cannot be seen
		canvas().vm.$emit('select', ['t1'], []);
		await flushPromises();

		expect(confirm).not.toHaveBeenCalled();
		expect(editor.draftInvalid.value).toBe(true);

		mocks.isMDDevice = true;
		await flushPromises();

		const after = wrapper.findComponent({ name: 'AutomationNodePanel' });

		expect(after.vm.$.uid).toBe(before.vm.$.uid);
		expect(after.isVisible()).toBe(true);
		expect(after.props('node')).toEqual(graph.nodes[1]);
		expect(after.props('disabled')).toBe(false);
		expect(editor.draftInvalid.value).toBe(true);

		// Leaving still asks
		confirm.mockRejectedValueOnce('cancel');

		await expect(mocks.leaveGuard?.()).resolves.toBe(false);
		expect(confirm).toHaveBeenCalledTimes(1);
	});

	it('removes the selection from the toolbar', async (): Promise<void> => {
		await createWrapper();

		expect(wrapper.find('[data-test-id="remove-selected"]').attributes('disabled')).toBeDefined();

		canvas().vm.$emit('select', [], ['e1']);
		await flushPromises();

		await wrapper.find('[data-test-id="remove-selected"]').trigger('click');

		expect(mocks.canvas.removeSelected).toHaveBeenCalledTimes(1);
	});

	it('offers both ways out of a conflict', async (): Promise<void> => {
		editor.conflict.value = true;

		await createWrapper();

		expect(wrapper.find('[data-test-id="conflict-alert"]').exists()).toBe(true);

		await wrapper.find('[data-test-id="conflict-overwrite"]').trigger('click');

		expect(editor.overwrite).toHaveBeenCalledTimes(1);

		// Nothing unsaved: the saved version is loaded without asking
		await wrapper.find('[data-test-id="conflict-reload"]').trigger('click');
		await flushPromises();

		expect(editor.reloadLatest).toHaveBeenCalledTimes(1);
	});

	it('asks before the saved version replaces unsaved changes', async (): Promise<void> => {
		editor.conflict.value = true;
		editor.isDirty.value = true;

		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel');

		await createWrapper();

		await wrapper.find('[data-test-id="conflict-reload"]').trigger('click');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(editor.reloadLatest).not.toHaveBeenCalled();

		confirm.mockResolvedValueOnce('confirm' as never);

		await wrapper.find('[data-test-id="conflict-reload"]').trigger('click');
		await flushPromises();

		expect(editor.reloadLatest).toHaveBeenCalledTimes(1);
	});

	it('warns about separate flows', async (): Promise<void> => {
		await createWrapper();

		expect(wrapper.find('[data-test-id="separate-flows-alert"]').exists()).toBe(false);

		editor.hasSeparateFlows.value = true;
		await flushPromises();

		expect(wrapper.find('[data-test-id="separate-flows-alert"]').exists()).toBe(true);
	});

	it('lets the route be left freely when nothing is unsaved', async (): Promise<void> => {
		const confirm = vi.spyOn(ElMessageBox, 'confirm');

		await createWrapper();

		await expect(mocks.leaveGuard?.()).resolves.toBe(true);
		expect(confirm).not.toHaveBeenCalled();
	});

	it('asks before unsaved changes are left behind', async (): Promise<void> => {
		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel');

		await createWrapper();

		editor.isDirty.value = true;

		await expect(mocks.leaveGuard?.()).resolves.toBe(false);

		confirm.mockResolvedValueOnce('confirm' as never);

		await expect(mocks.leaveGuard?.()).resolves.toBe(true);
		expect(confirm).toHaveBeenCalledTimes(2);
	});

	it('does not let the route be left while a save is on its way', async (): Promise<void> => {
		const confirm = vi.spyOn(ElMessageBox, 'confirm');

		await createWrapper();

		editor.saving.value = true;

		await expect(mocks.leaveGuard?.()).resolves.toBe(false);
		expect(confirm).not.toHaveBeenCalled();

		editor.saving.value = false;

		await expect(mocks.leaveGuard?.()).resolves.toBe(true);
	});

	it('neither saves nor lets go of the graph while the form holds JSON that does not parse', async (): Promise<void> => {
		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel');

		await createWrapper();

		canvas().vm.$emit('select', ['a1'], []);
		await flushPromises();

		editor.isDirty.value = true;
		wrapper.findComponent({ name: 'AutomationNodePanel' }).vm.$emit('update:invalid', true);
		await flushPromises();

		expect(wrapper.find('[data-test-id="save-flow"]').attributes('disabled')).toBeDefined();

		press('s');

		expect(editor.save).not.toHaveBeenCalled();
		expect(mocks.flash.error).toHaveBeenCalledWith('automations.editor.messages.invalidDraft');

		// Only the text in the form is unsaved: that still counts
		editor.isDirty.value = false;
		await flushPromises();

		expect(wrapper.find('[data-test-id="unsaved-tag"]').exists()).toBe(true);
		await expect(mocks.leaveGuard?.()).resolves.toBe(false);
		expect(confirm).toHaveBeenCalledTimes(1);

		const unload = new Event('beforeunload', { cancelable: true });

		window.dispatchEvent(unload);

		expect(unload.defaultPrevented).toBe(true);

		editor.isDirty.value = true;
		wrapper.findComponent({ name: 'AutomationNodePanel' }).vm.$emit('update:invalid', false);
		await flushPromises();

		press('s');

		expect(editor.save).toHaveBeenCalledTimes(1);
	});

	it('asks before the form is closed or left for another card while it holds JSON that does not parse', async (): Promise<void> => {
		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel').mockRejectedValueOnce('cancel');

		await createWrapper();

		canvas().vm.$emit('select', ['a1'], []);
		await flushPromises();

		const panel = () => wrapper.findComponent({ name: 'AutomationNodePanel' });

		panel().vm.$emit('update:invalid', true);
		await flushPromises();

		expect(editor.setDraftInvalid).toHaveBeenLastCalledWith(true);

		// Another card is picked on the canvas: the form stays, and so does what is typed in it
		canvas().vm.$emit('select', ['t1'], []);
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(panel().props('node')).toEqual(graph.nodes[1]);
		expect(mocks.canvas.focusNode).toHaveBeenCalledWith('a1');
		expect(editor.draftInvalid.value).toBe(true);
		expect(wrapper.find('[data-test-id="unsaved-tag"]').exists()).toBe(true);

		canvas().vm.$emit('select', ['a1'], []);
		await flushPromises();

		panel().vm.$emit('close');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(2);
		expect(panel().exists()).toBe(true);
		expect(editor.draftInvalid.value).toBe(true);

		// Once the user agrees, the text goes with the form and nothing is left unsaved
		confirm.mockResolvedValueOnce('confirm' as never);

		canvas().vm.$emit('select', ['t1'], []);
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(3);
		expect(panel().props('node')).toEqual(graph.nodes[0]);
		expect(editor.draftInvalid.value).toBe(false);
		expect(wrapper.find('[data-test-id="unsaved-tag"]').exists()).toBe(false);
		await expect(mocks.leaveGuard?.()).resolves.toBe(true);
	});

	it('closes and changes the form without asking while nothing in it is left unparsed', async (): Promise<void> => {
		const confirm = vi.spyOn(ElMessageBox, 'confirm');

		await createWrapper();

		canvas().vm.$emit('select', ['a1'], []);
		await flushPromises();

		canvas().vm.$emit('select', ['t1'], []);
		await flushPromises();

		expect(wrapper.findComponent({ name: 'AutomationNodePanel' }).props('node')).toEqual(graph.nodes[0]);

		wrapper.findComponent({ name: 'AutomationNodePanel' }).vm.$emit('close');
		await flushPromises();

		expect(wrapper.find('[data-test-id="panel-stub"]').exists()).toBe(false);
		expect(confirm).not.toHaveBeenCalled();
	});

	it('keeps the form from being typed into while the saved version is read, and rebuilds it once text is given up', async (): Promise<void> => {
		await createWrapper();

		canvas().vm.$emit('select', ['a1'], []);
		await flushPromises();

		const before = wrapper.findComponent({ name: 'AutomationNodePanel' });

		expect(before.props('disabled')).toBe(false);

		editor.reloading.value = true;
		await flushPromises();

		expect(wrapper.findComponent({ name: 'AutomationNodePanel' }).props('disabled')).toBe(true);

		editor.reloading.value = false;
		editor.draftResets.value += 1;
		await flushPromises();

		const after = wrapper.findComponent({ name: 'AutomationNodePanel' });

		expect(after.props('disabled')).toBe(false);
		expect(after.vm.$.uid).not.toBe(before.vm.$.uid);
	});

	it('asks before the saved version replaces text in the form that does not parse', async (): Promise<void> => {
		editor.conflict.value = true;

		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel');

		await createWrapper();

		editor.draftInvalid.value = true;

		await wrapper.find('[data-test-id="conflict-reload"]').trigger('click');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(editor.reloadLatest).not.toHaveBeenCalled();
	});

	it('asks before going from one flow straight to another, as before any other way out', async (): Promise<void> => {
		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel');

		await createWrapper();

		const other = { params: { id: 'c9e1a0b4-2f43-4f7e-8a51-0d4c2e7b9f10' } };
		const current = { params: { id: automationId } };

		await expect(mocks.updateGuard?.(other, current)).resolves.toBe(true);

		editor.isDirty.value = true;

		// The same automation: nothing is left behind
		expect(mocks.updateGuard?.(current, current)).toBe(true);

		await expect(mocks.updateGuard?.(other, current)).resolves.toBe(false);

		editor.saving.value = true;

		await expect(mocks.updateGuard?.(other, current)).resolves.toBe(false);
		expect(confirm).toHaveBeenCalledTimes(1);
	});

	it('holds the browser back from closing the page with unsaved changes', async (): Promise<void> => {
		await createWrapper();

		const clean = new Event('beforeunload', { cancelable: true });

		window.dispatchEvent(clean);

		expect(clean.defaultPrevented).toBe(false);

		editor.isDirty.value = true;

		const dirty = new Event('beforeunload', { cancelable: true });

		window.dispatchEvent(dirty);

		expect(dirty.defaultPrevented).toBe(true);
	});

	it('goes back to the list', async (): Promise<void> => {
		await createWrapper();

		await wrapper
			.findAll('button')
			.find((button) => button.text() === 'automations.buttons.backToList.title')
			?.trigger('click');

		expect(mocks.routerPush).toHaveBeenCalledWith({ name: RouteNames.AUTOMATIONS });
	});
	describe('test and trace', (): void => {
		const testButton = (): VueWrapper => wrapper.findComponent({ name: 'AutomationTestButton' }) as unknown as VueWrapper;

		const enable = (): void => {
			(editor.automation.value as IAutomation).enabled = true;
		};

		it('offers a test at every trigger of the flow and starts it at the one chosen', async (): Promise<void> => {
			enable();
			editor.graph.value = {
				...graph,
				nodes: [...graph.nodes, { id: 't2', type: 'time.of-day', position: { x: 0, y: 200 }, config: {} }],
			};

			await createWrapper();

			expect((testButton().props() as Record<string, unknown>).triggers).toEqual([
				{ id: 't1', label: 'label:t1' },
				{ id: 't2', label: 'label:t2' },
			]);
			expect((testButton().props() as Record<string, unknown>).disabledReason).toBeNull();

			testButton().vm.$emit('test', 't2');
			await flushPromises();

			expect(runs.test).toHaveBeenCalledWith('t2');
			expect(mocks.flash.warning).not.toHaveBeenCalled();
			expect(mocks.flash.error).not.toHaveBeenCalled();
		});

		it('says why a test cannot be started: unsaved changes, disabled, not ok, no trigger', async (): Promise<void> => {
			await createWrapper();

			expect((testButton().props() as Record<string, unknown>).disabledReason).toBe('automations.runs.test.disabled.disabled');

			enable();
			editor.isDirty.value = true;
			await flushPromises();

			// The backend runs the saved flow, so what is drawn has to be saved first
			expect((testButton().props() as Record<string, unknown>).disabledReason).toBe('automations.runs.test.disabled.unsaved');

			editor.isDirty.value = false;
			(editor.automation.value as IAutomation).status = AutomationStatus.suspended;
			await flushPromises();

			expect((testButton().props() as Record<string, unknown>).disabledReason).toBe('automations.runs.test.disabled.suspended');

			(editor.automation.value as IAutomation).status = AutomationStatus.ok;
			editor.graph.value = { ...graph, nodes: graph.nodes.filter((node) => node.id !== 't1'), edges: [] };
			await flushPromises();

			expect((testButton().props() as Record<string, unknown>).disabledReason).toBe('automations.runs.test.disabled.noTrigger');

			testButton().vm.$emit('test');
			await flushPromises();

			expect(runs.test).not.toHaveBeenCalled();
		});

		it('is offered below the md breakpoint too, where the flow is read-only', async (): Promise<void> => {
			mocks.isMDDevice = false;
			enable();

			await createWrapper();

			expect(testButton().exists()).toBe(true);
			expect((testButton().props() as Record<string, unknown>).disabledReason).toBeNull();
			expect(wrapper.find('[data-test-id="toggle-run-history"]').exists()).toBe(true);
		});

		it('tells when the test did not start, and why the backend refused it', async (): Promise<void> => {
			enable();

			await createWrapper();

			runs.test.mockResolvedValueOnce({ automationId, started: false, outcome: AutomationTriggerOutcome.ignored, runId: null, reason: 'Busy' });

			testButton().vm.$emit('test');
			await flushPromises();

			expect(runs.test).toHaveBeenCalledWith(undefined);
			expect(mocks.flash.warning).toHaveBeenCalledWith('outcome:ignored');

			runs.test.mockRejectedValueOnce(new AutomationsTriggerRefusedException('Not running.', 'not_running'));

			testButton().vm.$emit('test');
			await flushPromises();

			expect(mocks.flash.error).toHaveBeenCalledWith('refusal:not_running');

			runs.test.mockRejectedValueOnce(new AutomationsApiException('Network.', null));

			testButton().vm.$emit('test');
			await flushPromises();

			expect(mocks.flash.error).toHaveBeenCalledWith('automations.runs.messages.testFailed');
		});

		it('reads the run history along with the automation and shows it when asked to', async (): Promise<void> => {
			runs.runs.value = [createRun()];

			await createWrapper();

			expect(runs.fetchRuns).toHaveBeenCalledTimes(1);
			expect(wrapper.find('[data-test-id="run-history-stub"]').exists()).toBe(false);

			await wrapper.find('[data-test-id="toggle-run-history"]').trigger('click');

			const history = wrapper.findComponent({ name: 'AutomationRunHistory' });

			expect(history.props('runs')).toEqual(runs.runs.value);

			history.vm.$emit('reload');

			expect(runs.fetchRuns).toHaveBeenCalledTimes(2);
		});

		it('replays a run picked from the history over the canvas, without touching the graph', async (): Promise<void> => {
			const run = createRun();

			runs.runs.value = [run];

			await createWrapper();
			await wrapper.find('[data-test-id="toggle-run-history"]').trigger('click');

			wrapper.findComponent({ name: 'AutomationRunHistory' }).vm.$emit('select', run.id);

			expect(runs.replay).toHaveBeenCalledWith(run.id);

			const steps = [
				{
					seq: 1,
					at: '2026-11-11T07:30:00.000Z',
					elapsed_ms: 0,
					node_id: 't1',
					type: 'manual.start',
					kind: AutomationNodeKind.trigger,
					state: 'done' as IAutomationShownRun['steps'][number]['state'],
					output: 'out',
				},
			];
			const overlay = mapTraceToOverlay(graph, steps);

			runs.shown.value = {
				runId: run.id,
				source: 'replay',
				run,
				steps,
				overlay,
				ended: true,
				attention: { kind: 'interrupted', nodeId: 'a1', endReason: 'backend_restarted' },
				loading: false,
				failed: false,
				truncated: false,
			};
			await flushPromises();

			expect((canvas().props() as Record<string, unknown>).run).toEqual({ overlay, ended: true });
			expect((canvas().props() as Record<string, unknown>).graph).toEqual(graph);
			expect(wrapper.findComponent({ name: 'AutomationRunHistory' }).props('selectedRunId')).toBe(run.id);
			expect(wrapper.findComponent({ name: 'AutomationRunSummary' }).props('revision')).toBe(3);
			expect(editor.updateGraph).not.toHaveBeenCalled();

			// The explanation leads to the card it is about
			wrapper.findComponent({ name: 'AutomationRunSummary' }).vm.$emit('focus', 'a1');
			await flushPromises();

			expect(mocks.canvas.focusNode).toHaveBeenCalledWith('a1');

			// Picked again, it is laid off the canvas
			wrapper.findComponent({ name: 'AutomationRunHistory' }).vm.$emit('select', run.id);

			expect(runs.close).toHaveBeenCalledTimes(1);

			wrapper.findComponent({ name: 'AutomationRunSummary' }).vm.$emit('close');

			expect(runs.close).toHaveBeenCalledTimes(2);
		});

		it('explains a suspended or invalid automation and leads to the card concerned', async (): Promise<void> => {
			(editor.automation.value as IAutomation).status = AutomationStatus.suspended;
			runs.runs.value = [createRun({ triggerNodeId: 't1', status: AutomationRunRecordStatus.completed })];

			await createWrapper();

			expect(runs.fetchRuntime).toHaveBeenCalled();

			const explanation = wrapper.findComponent({ name: 'AutomationStatusExplanation' });

			expect(explanation.props()).toMatchObject({ status: AutomationStatus.suspended });
			// The last run is no word on the trigger that made the engine suspend the automation
			expect(explanation.attributes('suspended-node-id')).toBeUndefined();

			explanation.vm.$emit('focus', 't1');
			await flushPromises();

			expect(mocks.canvas.focusNode).toHaveBeenCalledWith('t1');
		});

		it('says nothing about the status of an automation that is in order', async (): Promise<void> => {
			await createWrapper();

			expect(wrapper.find('[data-test-id="status-explanation-stub"]').exists()).toBe(false);
			expect(runs.fetchRuntime).not.toHaveBeenCalled();
		});
	});
});
