import { nextTick } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises } from '@vue/test-utils';

import { injectStoresManager } from '../../../common';
import { AutomationMode, AutomationNodeKind, AutomationStatus } from '../automations.constants';
import { cloneGraph } from '../automations.graph';
import { useAutomationsStore } from '../store/automations.store';
import type { IAutomationGraph, IAutomationRes } from '../store/automations.store.types';
import { automationNodeTypesStoreKey } from '../store/keys';
import { useAutomationNodeTypesStore } from '../store/node-types.store';

import { useAutomationEditor } from './useAutomationEditor';

const mockFlash = {
	success: vi.fn(),
	error: vi.fn(),
	warning: vi.fn(),
};

const mockBackendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
	DELETE: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	const silent = { error: vi.fn(), info: vi.fn(), warning: vi.fn(), log: vi.fn(), debug: vi.fn() };

	return {
		...actual,
		injectStoresManager: vi.fn(),
		useFlashMessage: vi.fn(() => mockFlash),
		useBackend: vi.fn(() => ({ client: mockBackendClient })),
		useLogger: vi.fn(() => silent),
		logger: silent,
	};
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: vi.fn((key: string, params?: { automation?: string }) => `${key}${params?.automation ? ' ' + params.automation : ''}`),
	}),
}));

const automationId = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a01';

// Two flows on one canvas, as in the reference scenario of the design
const graph: IAutomationGraph = {
	version: 1,
	nodes: [
		{ id: 't1', type: 'manual.start', position: { x: 0, y: 0 }, config: {} },
		{ id: 'a1', type: 'notification.send', position: { x: 300, y: 0 }, config: { title: 'Hello' } },
		{ id: 't2', type: 'manual.start', position: { x: 0, y: 200 }, config: {} },
		{ id: 'a2', type: 'notification.send', position: { x: 300, y: 200 }, config: { title: 'Bye' } },
	],
	edges: [
		{ id: 'e1', source: 't1', source_port: 'out', target: 'a1', target_port: 'in' },
		{ id: 'e2', source: 't2', source_port: 'out', target: 'a2', target_port: 'in' },
	],
};

const withDelay = (base: IAutomationGraph = graph): IAutomationGraph => ({
	...cloneGraph(base),
	nodes: [...cloneGraph(base).nodes, { id: 'd1', type: 'flow.delay', position: { x: 600, y: 0 }, config: {} }],
});

const detailRes = (overrides: Partial<IAutomationRes> = {}): IAutomationRes => ({
	id: automationId,
	name: 'Hallway motion light',
	description: null,
	icon: null,
	enabled: false,
	space_id: null,
	mode: AutomationMode.restart,
	revision: 3,
	status: AutomationStatus.ok,
	last_triggered_at: null,
	last_run_status: null,
	created_at: '2026-01-01T10:00:00.000Z',
	updated_at: null,
	graph: cloneGraph(graph),
	...overrides,
});

const ok = (data: unknown): { data: { data: unknown }; response: { status: number } } => ({ data: { data }, response: { status: 200 } });

const refused = (status: number, details: unknown = null): { data: undefined; error: unknown; response: { status: number } } => ({
	data: undefined,
	error: { error: { code: 'Error', message: 'Refused', details } },
	response: { status },
});

const unreachable = { severity: 'warning', code: 'unreachable_node', message: 'No trigger leads to this node.', node_id: 'd1', blocking: false };
const invalidConfig = {
	severity: 'error',
	code: 'invalid_config',
	message: 'Seconds are required.',
	node_id: 'd1',
	field: 'seconds',
	blocking: true,
};

describe('useAutomationEditor', () => {
	let automationsStore: ReturnType<typeof useAutomationsStore>;
	let nodeTypesStore: ReturnType<typeof useAutomationNodeTypesStore>;

	const createEditor = async (response: IAutomationRes = detailRes()): Promise<ReturnType<typeof useAutomationEditor>> => {
		mockBackendClient.GET.mockResolvedValueOnce(ok(response));

		const editor = useAutomationEditor({ id: automationId });

		await editor.load();

		return editor;
	};

	beforeEach(() => {
		vi.clearAllMocks();

		mockBackendClient.GET.mockReset();
		mockBackendClient.POST.mockReset();
		mockBackendClient.PATCH.mockReset();

		setActivePinia(createPinia());

		automationsStore = useAutomationsStore();
		nodeTypesStore = useAutomationNodeTypesStore();

		nodeTypesStore.data = new Map([
			[
				'manual.start',
				{
					type: 'manual.start',
					kind: AutomationNodeKind.trigger,
					name: 'Manual start',
					description: '',
					ports: { inputs: [], outputs: ['out'] },
					configSchema: {},
				},
			],
			[
				'notification.send',
				{
					type: 'notification.send',
					kind: AutomationNodeKind.action,
					name: 'Send notification',
					description: '',
					ports: { inputs: ['in'], outputs: ['done', 'error'] },
					configSchema: {},
				},
			],
		]);

		(injectStoresManager as Mock).mockReturnValue({
			getStore: (key: symbol) => (key === automationNodeTypesStoreKey ? nodeTypesStore : automationsStore),
		});

		// A graph is valid unless a test says otherwise
		mockBackendClient.POST.mockResolvedValue(ok({ valid: true, issues: [] }));
	});

	describe('load', () => {
		it('reads the automation on its own and starts from its graph', async () => {
			const editor = await createEditor();

			expect(mockBackendClient.GET).toHaveBeenCalledWith('/modules/automations/automations/{id}', { params: { path: { id: automationId } } });
			expect(editor.loaded.value).toBe(true);
			expect(editor.graph.value).toEqual(graph);
			expect(editor.isDirty.value).toBe(false);
			expect(editor.canUndo.value).toBe(false);
			expect(editor.automation.value?.name).toBe('Hallway motion light');
		});

		it('rejects when the automation cannot be read', async () => {
			mockBackendClient.GET.mockResolvedValueOnce(refused(404));

			const editor = useAutomationEditor({ id: automationId });

			await expect(editor.load()).rejects.toMatchObject({ code: 404 });
			expect(editor.loaded.value).toBe(false);
			expect(editor.automation.value).toBeNull();
		});

		it('works on a copy: editing does not change the graph the store holds', async () => {
			const editor = await createEditor();

			editor.updateNodeConfig('a1', { title: 'Changed' });

			expect(automationsStore.findById(automationId)?.graph?.nodes[1]?.config).toEqual({ title: 'Hello' });
		});
	});

	describe('editing', () => {
		it('is dirty after a change and clean again once it is undone', async () => {
			const editor = await createEditor();

			editor.updateGraph(withDelay());

			expect(editor.isDirty.value).toBe(true);
			expect(editor.canUndo.value).toBe(true);

			editor.undo();

			expect(editor.isDirty.value).toBe(false);
			expect(editor.canRedo.value).toBe(true);

			editor.redo();

			expect(editor.graph.value.nodes).toHaveLength(5);
			expect(editor.isDirty.value).toBe(true);
		});

		it('is not dirty when a change comes to the same graph', async () => {
			const editor = await createEditor();

			editor.updateNodeConfig('a1', { title: 'Changed' });
			editor.updateNodeConfig('a1', { title: 'Hello' });

			expect(editor.isDirty.value).toBe(false);
		});

		it('changes the configuration of one node only', async () => {
			const editor = await createEditor();

			editor.updateNodeConfig('a1', { title: 'Changed', message: 'More' }, 'message');

			expect(editor.graph.value.nodes.map((node) => node.config)).toEqual([{}, { title: 'Changed', message: 'More' }, {}, { title: 'Bye' }]);
		});

		it('warns about separate flows in the restart mode only', async () => {
			const editor = await createEditor();

			expect(editor.hasSeparateFlows.value).toBe(true);

			editor.updateGraph({
				...cloneGraph(graph),
				edges: [...graph.edges, { id: 'e3', source: 't2', source_port: 'out', target: 'a1', target_port: 'in' }],
			});

			expect(editor.hasSeparateFlows.value).toBe(false);

			const parallel = await createEditor(detailRes({ mode: AutomationMode.parallel, revision: 4 }));

			expect(parallel.hasSeparateFlows.value).toBe(false);
		});
	});

	describe('save', () => {
		it('validates, then sends the graph with the revision it was read at', async () => {
			const editor = await createEditor();

			editor.updateGraph(withDelay());

			mockBackendClient.PATCH.mockResolvedValue(ok(detailRes({ revision: 4, graph: withDelay() })));

			await expect(editor.save()).resolves.toBe('saved');

			expect(mockBackendClient.POST).toHaveBeenCalledWith('/modules/automations/automations/validate', {
				body: { data: { graph: withDelay(), enabled: false } },
			});
			expect(mockBackendClient.PATCH).toHaveBeenCalledWith('/modules/automations/automations/{id}', {
				params: { path: { id: automationId } },
				body: { data: { revision: 3, graph: withDelay() } },
			});
			expect(editor.isDirty.value).toBe(false);
			expect(editor.saving.value).toBe(false);
			expect(mockFlash.success).toHaveBeenCalledWith('automations.messages.edited Hallway motion light');
		});

		it('bases the next save on the revision the save returned', async () => {
			const editor = await createEditor();

			editor.updateGraph(withDelay());

			mockBackendClient.PATCH.mockResolvedValueOnce(ok(detailRes({ revision: 4, graph: withDelay() })));

			await editor.save();

			editor.updateNodeConfig('d1', { seconds: 5 });

			mockBackendClient.PATCH.mockResolvedValueOnce(ok(detailRes({ revision: 5, graph: editor.graph.value })));

			await expect(editor.save()).resolves.toBe('saved');

			expect(mockBackendClient.PATCH.mock.calls[1]?.[1].body.data.revision).toBe(4);
		});

		it('keeps the history after a save, so a saved step can still be undone', async () => {
			const editor = await createEditor();

			editor.updateGraph(withDelay());

			mockBackendClient.PATCH.mockResolvedValue(ok(detailRes({ revision: 4, graph: withDelay() })));

			await editor.save();

			editor.undo();

			expect(editor.graph.value).toEqual(graph);
			expect(editor.isDirty.value).toBe(true);
		});

		it('keeps the warnings of a graph that was saved', async () => {
			const editor = await createEditor();

			editor.updateGraph(withDelay());

			mockBackendClient.POST.mockResolvedValue(ok({ valid: true, issues: [unreachable] }));
			mockBackendClient.PATCH.mockResolvedValue(ok(detailRes({ revision: 4, graph: withDelay() })));

			await expect(editor.save()).resolves.toBe('saved');

			expect(editor.issues.value).toEqual([unreachable]);
		});

		it('does not send a graph the validation refuses, and loses nothing', async () => {
			const editor = await createEditor();

			editor.updateGraph(withDelay());

			mockBackendClient.POST.mockResolvedValue(ok({ valid: false, issues: [invalidConfig, unreachable] }));

			await expect(editor.save()).resolves.toBe('invalid');

			expect(mockBackendClient.PATCH).not.toHaveBeenCalled();
			expect(editor.issues.value).toEqual([invalidConfig, unreachable]);
			expect(editor.graph.value).toEqual(withDelay());
			expect(editor.isDirty.value).toBe(true);
			expect(mockFlash.error).toHaveBeenCalledWith('automations.editor.messages.invalid Hallway motion light');
		});

		it('shows the issues of a save the backend refuses', async () => {
			const editor = await createEditor();

			editor.updateGraph(withDelay());

			mockBackendClient.PATCH.mockResolvedValue(refused(422, { code: 'automation-graph-invalid', issues: [invalidConfig] }));

			await expect(editor.save()).resolves.toBe('invalid');

			expect(editor.issues.value).toEqual([invalidConfig]);
			expect(editor.graph.value).toEqual(withDelay());
			expect(editor.isDirty.value).toBe(true);
		});

		it('saves even when the validation could not be asked', async () => {
			const editor = await createEditor();

			editor.updateGraph(withDelay());

			mockBackendClient.POST.mockRejectedValue(new Error('offline'));
			mockBackendClient.PATCH.mockResolvedValue(ok(detailRes({ revision: 4, graph: withDelay() })));

			await expect(editor.save()).resolves.toBe('saved');
		});

		it('reports a failed save and keeps the working copy', async () => {
			const editor = await createEditor();

			editor.updateGraph(withDelay());

			mockBackendClient.PATCH.mockRejectedValue(new Error('offline'));

			await expect(editor.save()).resolves.toBe('error');

			expect(editor.isDirty.value).toBe(true);
			expect(editor.conflict.value).toBe(false);
			expect(mockFlash.error).toHaveBeenCalledWith('automations.messages.notEdited Hallway motion light');
		});

		it('drops the issues of a node once it is removed', async () => {
			const editor = await createEditor();

			editor.updateGraph(withDelay());

			mockBackendClient.POST.mockResolvedValue(ok({ valid: false, issues: [invalidConfig] }));

			await editor.save();

			editor.updateGraph(cloneGraph(graph));

			expect(editor.issues.value).toEqual([]);
		});

		it('still counts as unsaved what was drawn while the save was under way', async () => {
			const editor = await createEditor();

			editor.updateGraph(withDelay());

			let resolve: (value: unknown) => void = () => {};

			mockBackendClient.PATCH.mockReturnValue(
				new Promise((res) => {
					resolve = res;
				})
			);

			const pending = editor.save();

			await nextTick();

			editor.updateNodeConfig('d1', { seconds: 30 });

			resolve(ok(detailRes({ revision: 4, graph: withDelay() })));

			await expect(pending).resolves.toBe('saved');

			expect(editor.isDirty.value).toBe(true);
			expect(editor.graph.value.nodes[4]?.config).toEqual({ seconds: 30 });
		});
	});

	describe('conflict', () => {
		const conflictingSave = async (): Promise<ReturnType<typeof useAutomationEditor>> => {
			const editor = await createEditor();

			editor.updateGraph(withDelay());

			mockBackendClient.PATCH.mockResolvedValueOnce(refused(409));
			// The store reads the automation again after a conflict
			mockBackendClient.GET.mockResolvedValueOnce(ok(detailRes({ name: 'Renamed elsewhere', revision: 5 })));

			await expect(editor.save()).resolves.toBe('conflict');

			return editor;
		};

		it('is reported, and nothing drawn is lost', async () => {
			const editor = await conflictingSave();

			expect(editor.conflict.value).toBe(true);
			expect(editor.graph.value).toEqual(withDelay());
			expect(editor.isDirty.value).toBe(true);
			expect(editor.canUndo.value).toBe(true);
			expect(mockFlash.warning).toHaveBeenCalledWith('automations.editor.messages.conflict Renamed elsewhere');
		});

		it('saves the working copy over the latest revision when the user keeps their version', async () => {
			const editor = await conflictingSave();

			mockBackendClient.GET.mockResolvedValueOnce(ok(detailRes({ name: 'Renamed elsewhere', revision: 5 })));
			mockBackendClient.PATCH.mockResolvedValueOnce(ok(detailRes({ name: 'Renamed elsewhere', revision: 6, graph: withDelay() })));

			await expect(editor.overwrite()).resolves.toBe('saved');

			expect(mockBackendClient.PATCH).toHaveBeenLastCalledWith('/modules/automations/automations/{id}', {
				params: { path: { id: automationId } },
				body: { data: { revision: 5, graph: withDelay() } },
			});
			expect(editor.conflict.value).toBe(false);
			expect(editor.isDirty.value).toBe(false);
		});

		it('does not base the kept version on a read started before the user chose it', async () => {
			const editor = await conflictingSave();

			let answerEarlier: (value: unknown) => void = () => {};

			mockBackendClient.GET.mockReturnValueOnce(
				new Promise((res) => {
					answerEarlier = res;
				})
			);

			// A read of the automation already on its way, e.g. from another view
			const earlier = automationsStore.get({ id: automationId });

			mockBackendClient.GET.mockResolvedValueOnce(ok(detailRes({ name: 'Renamed elsewhere', revision: 6 })));
			mockBackendClient.PATCH.mockResolvedValueOnce(ok(detailRes({ name: 'Renamed elsewhere', revision: 7, graph: withDelay() })));

			const overwriting = editor.overwrite();

			await flushPromises();

			// Not joined: the overwrite waits for it and then reads on its own
			expect(mockBackendClient.GET).toHaveBeenCalledTimes(3);
			expect(mockBackendClient.PATCH).toHaveBeenCalledTimes(1);

			answerEarlier(ok(detailRes({ name: 'Renamed elsewhere', revision: 5 })));

			await earlier;
			await expect(overwriting).resolves.toBe('saved');

			expect(mockBackendClient.GET).toHaveBeenCalledTimes(4);
			expect(mockBackendClient.PATCH).toHaveBeenLastCalledWith('/modules/automations/automations/{id}', {
				params: { path: { id: automationId } },
				body: { data: { revision: 6, graph: withDelay() } },
			});
		});

		it('does not take the saved version from a read started before the user chose it', async () => {
			const editor = await conflictingSave();

			let answerEarlier: (value: unknown) => void = () => {};

			mockBackendClient.GET.mockReturnValueOnce(
				new Promise((res) => {
					answerEarlier = res;
				})
			);

			const earlier = automationsStore.get({ id: automationId });

			const theirs: IAutomationGraph = { ...cloneGraph(graph), nodes: graph.nodes.slice(0, 2), edges: graph.edges.slice(0, 1) };

			mockBackendClient.GET.mockResolvedValueOnce(ok(detailRes({ name: 'Renamed elsewhere', revision: 6, graph: theirs })));

			const reloading = editor.reloadLatest();

			answerEarlier(ok(detailRes({ name: 'Renamed elsewhere', revision: 5 })));

			await earlier;
			await reloading;

			expect(mockBackendClient.GET).toHaveBeenCalledTimes(4);
			expect(editor.automation.value?.revision).toBe(6);
			expect(editor.graph.value).toEqual(theirs);
			expect(editor.isDirty.value).toBe(false);
		});

		it('takes the saved version when the user gives up theirs', async () => {
			const editor = await conflictingSave();

			const theirs: IAutomationGraph = { ...cloneGraph(graph), nodes: graph.nodes.slice(0, 2), edges: graph.edges.slice(0, 1) };

			mockBackendClient.GET.mockResolvedValueOnce(ok(detailRes({ name: 'Renamed elsewhere', revision: 5, graph: theirs })));

			await editor.reloadLatest();

			expect(editor.graph.value).toEqual(theirs);
			expect(editor.conflict.value).toBe(false);
			expect(editor.isDirty.value).toBe(false);
			expect(editor.canUndo.value).toBe(false);
		});

		it('keeps what is drawn while the saved version is being read, and asks again which version to keep', async () => {
			const editor = await conflictingSave();

			let answer: (value: unknown) => void = () => {};

			mockBackendClient.GET.mockReturnValueOnce(
				new Promise((res) => {
					answer = res;
				})
			);

			const reloading = editor.reloadLatest();

			const drawn: IAutomationGraph = { ...withDelay(), nodes: withDelay().nodes.filter((node) => node.id !== 'a2') };

			editor.updateGraph(drawn);

			answer(ok(detailRes({ name: 'Renamed elsewhere', revision: 6 })));

			await reloading;

			expect(editor.graph.value).toEqual(drawn);
			expect(editor.canUndo.value).toBe(true);
			expect(editor.isDirty.value).toBe(true);
			expect(editor.conflict.value).toBe(true);
		});

		it('saves nothing while the saved version is being read', async () => {
			const editor = await conflictingSave();

			let answer: (value: unknown) => void = () => {};

			mockBackendClient.GET.mockReturnValueOnce(
				new Promise((res) => {
					answer = res;
				})
			);

			const reloading = editor.reloadLatest();

			expect(editor.saving.value).toBe(true);
			await expect(editor.save()).resolves.toBe('error');
			await expect(editor.setEnabled(true)).resolves.toBe(false);

			answer(ok(detailRes({ name: 'Renamed elsewhere', revision: 6 })));

			await reloading;

			expect(mockBackendClient.PATCH).toHaveBeenCalledTimes(1);
			expect(editor.saving.value).toBe(false);
			expect(editor.conflict.value).toBe(false);
		});

		it('does not follow a save made elsewhere over what is drawn while it is being read', async () => {
			const editor = await createEditor();

			let answer: (value: unknown) => void = () => {};

			mockBackendClient.GET.mockReturnValueOnce(
				new Promise((res) => {
					answer = res;
				})
			);

			automationsStore.onEvent({ id: automationId, data: detailRes({ revision: 4 }) });

			await nextTick();

			expect(mockBackendClient.GET).toHaveBeenCalledTimes(2);

			editor.updateGraph(withDelay());

			const theirs: IAutomationGraph = { ...cloneGraph(graph), nodes: graph.nodes.slice(0, 2), edges: graph.edges.slice(0, 1) };

			answer(ok(detailRes({ revision: 4, graph: theirs })));

			await flushPromises();

			expect(editor.graph.value).toEqual(withDelay());
			expect(editor.canUndo.value).toBe(true);
			expect(editor.isDirty.value).toBe(true);
			expect(editor.conflict.value).toBe(true);
		});

		it('is noticed as soon as the automation is saved elsewhere while there are unsaved changes', async () => {
			const editor = await createEditor();

			editor.updateGraph(withDelay());

			automationsStore.onEvent({ id: automationId, data: detailRes({ revision: 4 }) });

			await nextTick();

			expect(editor.conflict.value).toBe(true);
			expect(editor.graph.value).toEqual(withDelay());
			expect(mockBackendClient.GET).toHaveBeenCalledTimes(1);
		});

		it('follows a save made elsewhere when nothing was changed here', async () => {
			const editor = await createEditor();

			const theirs: IAutomationGraph = withDelay();

			mockBackendClient.GET.mockResolvedValueOnce(ok(detailRes({ revision: 4, graph: theirs })));

			automationsStore.onEvent({ id: automationId, data: detailRes({ revision: 4, graph: theirs }) });

			await nextTick();
			await vi.waitFor(() => expect(editor.graph.value).toEqual(theirs));

			expect(editor.conflict.value).toBe(false);
			expect(editor.isDirty.value).toBe(false);
		});

		it('stays on its copy after a conflict on a clean canvas, and asks which version to keep', async () => {
			const editor = await createEditor();

			const theirs: IAutomationGraph = withDelay();

			mockBackendClient.PATCH.mockResolvedValueOnce(refused(409));
			// The store reads the automation again after the conflict
			mockBackendClient.GET.mockResolvedValueOnce(ok(detailRes({ name: 'Renamed elsewhere', revision: 5, graph: theirs })));

			await expect(editor.setEnabled(true)).resolves.toBe(false);

			await flushPromises();
			await nextTick();

			// The newer revision arrives while the save is still under way, so the editor does not follow it on
			// its own: nothing is read again, the copy stays as it was and the user chooses
			expect(mockFlash.warning).toHaveBeenCalledWith('automations.editor.messages.conflict Renamed elsewhere');
			expect(mockBackendClient.GET).toHaveBeenCalledTimes(2);
			expect(editor.conflict.value).toBe(true);
			expect(editor.isDirty.value).toBe(false);
			expect(editor.graph.value).toEqual(graph);
			expect(editor.automation.value).toMatchObject({ name: 'Renamed elsewhere', revision: 5, enabled: false });
		});

		it('is not raised by a write of the engine, which keeps the revision', async () => {
			const editor = await createEditor();

			editor.updateGraph(withDelay());

			automationsStore.onEvent({ id: automationId, data: detailRes({ status: AutomationStatus.invalid }) });

			await nextTick();

			expect(editor.conflict.value).toBe(false);
			expect(editor.automation.value?.status).toBe(AutomationStatus.invalid);
		});
	});

	describe('setEnabled', () => {
		it('enables the automation at the revision of the working copy and keeps the unsaved graph', async () => {
			const editor = await createEditor();

			editor.updateGraph(withDelay());

			mockBackendClient.PATCH.mockResolvedValue(ok(detailRes({ enabled: true, revision: 4 })));

			await expect(editor.setEnabled(true)).resolves.toBe(true);

			expect(mockBackendClient.PATCH).toHaveBeenCalledWith('/modules/automations/automations/{id}', {
				params: { path: { id: automationId } },
				body: { data: { revision: 3, enabled: true } },
			});

			await nextTick();

			expect(editor.automation.value?.enabled).toBe(true);
			expect(editor.conflict.value).toBe(false);
			expect(editor.graph.value).toEqual(withDelay());
			expect(editor.isDirty.value).toBe(true);
		});

		it('shows why an incomplete flow cannot be enabled', async () => {
			const editor = await createEditor();

			mockBackendClient.PATCH.mockResolvedValue(refused(422, { code: 'automation-graph-invalid', issues: [{ ...invalidConfig, node_id: 'a1' }] }));

			await expect(editor.setEnabled(true)).resolves.toBe(false);

			expect(editor.issues.value).toHaveLength(1);
			expect(mockFlash.error).toHaveBeenCalledWith('automations.messages.notEnabledIncomplete Hallway motion light');
		});

		it('validates the next save as the graph of an enabled automation', async () => {
			const editor = await createEditor(detailRes({ enabled: true }));

			editor.updateGraph(withDelay());

			mockBackendClient.PATCH.mockResolvedValue(ok(detailRes({ enabled: true, revision: 4, graph: withDelay() })));

			await editor.save();

			expect(mockBackendClient.POST.mock.calls[0]?.[1].body.data.enabled).toBe(true);
		});
	});
});
