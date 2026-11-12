/* eslint-disable vue/one-component-per-file */
import { type Ref, computed, ref } from 'vue';

import { ElMessageBox } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { AutomationMode, AutomationStatus, RouteNames } from '../automations.constants';
import { AutomationsApiException } from '../automations.exceptions';
import type { IAutomation, IAutomationGraph, IAutomationGraphIssue } from '../store/automations.store.types';

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
}));

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
	const { defineComponent, h, computed: vueComputed } = await import('vue');

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
		useBreakpoints: () => ({ isMDDevice: vueComputed(() => mocks.isMDDevice) }),
		useFlashMessage: () => mocks.flash,
	};
});

vi.mock('../composables/composables', () => ({
	useAutomationEditor: () => mocks.editor,
	useAutomationNodeTypes: () => ({
		nodeTypes: computed(() => []),
		fetchNodeTypes: mocks.fetchNodeTypes,
		getNodeType: () => null,
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
	};
});

const createEditor = (): IEditorMock => {
	const isDirty = ref(false);
	const draftInvalid = ref(false);

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
		draftResets: ref(0),
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
		undo: vi.fn(),
		redo: vi.fn(),
		save: vi.fn().mockResolvedValue('saved'),
		setEnabled: vi.fn().mockResolvedValue(true),
		reloadLatest: vi.fn().mockResolvedValue(undefined),
		overwrite: vi.fn().mockResolvedValue('saved'),
	};
};

describe('ViewAutomationFlow', (): void => {
	let wrapper: VueWrapper;
	let editor: IEditorMock;

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

		expect(wrapper.find('[data-test-id="panel-stub"]').exists()).toBe(false);

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
});
