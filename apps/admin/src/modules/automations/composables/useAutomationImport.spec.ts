import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { AUTOMATION_IMPORT_MAX_LENGTH, AutomationMode, AutomationReferenceKind } from '../automations.constants';
import { AutomationsApiException, AutomationsGraphInvalidException, AutomationsImportInvalidException } from '../automations.exceptions';
import { automationTransferStoreKey, automationsStoreKey } from '../store/keys';
import type { IAutomationImportPreparation } from '../store/transfer.store.types';

import { useAutomationImport } from './useAutomationImport';

const mockFlash = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
		useFlashMessage: vi.fn(() => mockFlash),
	};
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

const SCENE = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a01';
const OTHER_SCENE = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a02';
const SPACE = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a03';
const CREATED = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a09';

const graph = (scene: string) => ({
	version: 1,
	nodes: [{ id: 'run', type: 'scene.run', position: { x: 0, y: 0 }, config: { scene_id: scene } }],
	edges: [],
});

const preparation = (scene: string, missing: boolean): IAutomationImportPreparation => ({
	draft: { name: 'Evening', description: 'Dim it', icon: null, mode: AutomationMode.single, spaceId: null, graph: graph(scene) },
	missingReferences: [
		{ kind: AutomationReferenceKind.space, id: SPACE, usages: [{ nodeId: null, field: 'space_id' }], remappable: true },
		...(missing ? [{ kind: AutomationReferenceKind.scene, id: scene, usages: [{ nodeId: 'run', field: 'scene_id' }], remappable: true }] : []),
	],
	issues: [],
});

describe('useAutomationImport', () => {
	let prepareImport: Mock;
	let add: Mock;

	beforeEach(() => {
		vi.clearAllMocks();

		prepareImport = vi.fn().mockResolvedValue(preparation(SCENE, true));
		add = vi.fn().mockResolvedValue({ id: CREATED, name: 'Evening' });

		const stores = new Map<symbol, unknown>([
			[automationTransferStoreKey, { prepareImport }],
			[automationsStoreKey, { add }],
		]);

		(injectStoresManager as Mock).mockReturnValue({ getStore: (key: symbol) => stores.get(key) });
	});

	it('reads the file through the backend and lists what does not exist here', async () => {
		const form = useAutomationImport();

		form.setYaml('version: 1');

		expect(await form.prepare()).toBe(true);
		expect(prepareImport).toHaveBeenCalledWith({ yaml: 'version: 1' });
		expect(form.missingReferences.value.map((reference) => reference.kind)).toEqual(['space', 'scene']);
		expect(form.unresolved.value).toBe(2);
	});

	it('creates the automation disabled, with the references the administrator pointed elsewhere', async () => {
		const form = useAutomationImport();

		form.setYaml('version: 1');

		await form.prepare();

		prepareImport.mockResolvedValueOnce(preparation(OTHER_SCENE, false));

		form.setMapping({ kind: AutomationReferenceKind.scene, id: SCENE }, OTHER_SCENE);

		expect(form.mappingFor({ kind: AutomationReferenceKind.scene, id: SCENE })).toBe(OTHER_SCENE);
		expect(form.unresolved.value).toBe(1);

		expect(await form.create()).toBe(CREATED);

		expect(prepareImport).toHaveBeenLastCalledWith({
			yaml: 'version: 1',
			mappings: [{ kind: AutomationReferenceKind.scene, id: SCENE, to: OTHER_SCENE }],
		});
		expect(add).toHaveBeenCalledWith({
			data: {
				name: 'Evening',
				description: 'Dim it',
				icon: null,
				mode: AutomationMode.single,
				spaceId: null,
				enabled: false,
				graph: graph(OTHER_SCENE),
			},
		});
		expect(mockFlash.success).toHaveBeenCalled();
	});

	it('creates the automation from the first reading when nothing is pointed elsewhere', async () => {
		const form = useAutomationImport();

		form.setYaml('version: 1');

		await form.prepare();

		form.setMapping({ kind: AutomationReferenceKind.scene, id: SCENE }, OTHER_SCENE);
		form.setMapping({ kind: AutomationReferenceKind.scene, id: SCENE }, null);

		await form.create();

		expect(prepareImport).toHaveBeenCalledTimes(1);
		expect(add.mock.calls[0][0].data.graph).toEqual(graph(SCENE));
	});

	it('shows why a file was refused and why a graph could not be saved', async () => {
		const form = useAutomationImport();

		form.setYaml('nope');

		prepareImport.mockRejectedValueOnce(new AutomationsImportInvalidException('bad', [{ field: 'kind', reason: 'Wrong kind.' }]));

		expect(await form.prepare()).toBe(false);
		expect(form.fileIssues.value).toEqual([{ field: 'kind', reason: 'Wrong kind.' }]);
		expect(form.preparation.value).toBeNull();

		prepareImport.mockRejectedValueOnce(
			new AutomationsGraphInvalidException('unsafe', [
				{ severity: 'error', code: 'safety_reducing_action', message: 'No unlocking.', blocking: true, node_id: 'n1' },
				{ severity: 'warning', code: 'unreachable_node', message: 'Not wired.', blocking: false, node_id: 'n2' },
			])
		);

		expect(await form.prepare()).toBe(false);
		expect(form.fileIssues.value).toEqual([]);
		expect(form.graphIssues.value.map((issue) => issue.code)).toEqual(['safety_reducing_action']);

		// Typing again forgets what was said about the text before
		form.setYaml('again');

		expect(form.graphIssues.value).toEqual([]);
	});

	it('reports a create the backend refused and keeps the dialog where it is', async () => {
		const form = useAutomationImport();

		form.setYaml('version: 1');

		await form.prepare();

		add.mockRejectedValueOnce(new AutomationsApiException('limit', 422));

		expect(await form.create()).toBeNull();
		expect(mockFlash.error).toHaveBeenCalledWith('automations.transfer.messages.notImported');
		expect(form.preparation.value).not.toBeNull();
	});

	it('reads a chosen file and refuses one that is too large', async () => {
		const form = useAutomationImport();

		expect(await form.readFile(new Blob(['version: 1\n']))).toBe(true);
		expect(form.yaml.value).toBe('version: 1\n');

		expect(await form.readFile(new Blob(['x'.repeat(AUTOMATION_IMPORT_MAX_LENGTH + 1)]))).toBe(false);
		expect(form.yaml.value).toBe('version: 1\n');
		expect(mockFlash.error).toHaveBeenCalledWith('automations.transfer.messages.tooLarge');
	});

	describe('a file read that finishes late', () => {
		// A file whose content comes when the test says so
		const slowFile = (): { file: Blob; finish: (text: string) => Promise<void> } => {
			let resolve: (text: string) => void = () => undefined;

			const text = new Promise<string>((done) => {
				resolve = done;
			});

			return {
				file: { size: 10, text: () => text } as unknown as Blob,
				finish: async (content: string): Promise<void> => {
					resolve(content);

					await text;
					await Promise.resolve();
				},
			};
		};

		it('does not replace a file chosen after it', async () => {
			const form = useAutomationImport();

			const first = slowFile();
			const second = slowFile();

			const firstRead = form.readFile(first.file);
			const secondRead = form.readFile(second.file);

			await second.finish('second');
			await first.finish('first');

			expect(await secondRead).toBe(true);
			expect(await firstRead).toBe(false);
			expect(form.yaml.value).toBe('second');
		});

		it('does not replace text typed meanwhile, and does not fill a dialog that was reset', async () => {
			const form = useAutomationImport();

			const typedOver = slowFile();
			const pending = form.readFile(typedOver.file);

			form.setYaml('typed');

			await typedOver.finish('from the file');

			expect(await pending).toBe(false);
			expect(form.yaml.value).toBe('typed');

			const closed = slowFile();
			const late = form.readFile(closed.file);

			form.reset();

			await closed.finish('from the file');

			expect(await late).toBe(false);
			expect(form.yaml.value).toBe('');
		});

		it('does not change a preparation shown, nor what is imported, once it arrives', async () => {
			const form = useAutomationImport();

			form.setYaml('version: 1');

			const late = slowFile();
			const pending = form.readFile(late.file);

			// Typing settles what is there; the file read on its way no longer counts
			form.setYaml('version: 1');

			await form.prepare();

			await late.finish('something else');
			await pending;

			expect(form.yaml.value).toBe('version: 1');
			expect(form.preparation.value).not.toBeNull();

			await form.create();

			expect(add).toHaveBeenCalledTimes(1);
		});
	});

	it('creates only the document that was checked: changed text is checked again first', async () => {
		const form = useAutomationImport();

		form.setYaml('version: 1');

		await form.prepare();

		form.setYaml('version: 1\nname: Changed');

		expect(form.preparation.value).toBeNull();
		expect(await form.create()).toBeNull();
		expect(add).not.toHaveBeenCalled();
	});

	it('drops a check that comes back for text that changed while it was made', async () => {
		let answer: (value: IAutomationImportPreparation) => void = () => undefined;

		prepareImport.mockReturnValueOnce(
			new Promise<IAutomationImportPreparation>((resolve) => {
				answer = resolve;
			})
		);

		const form = useAutomationImport();

		form.setYaml('first');

		const pending = form.prepare();

		form.setYaml('second');

		answer(preparation(SCENE, true));

		expect(await pending).toBe(false);
		expect(form.preparation.value).toBeNull();
	});

	it('maps with the document that was checked', async () => {
		const form = useAutomationImport();

		form.setYaml('checked');

		await form.prepare();

		prepareImport.mockResolvedValueOnce(preparation(OTHER_SCENE, false));

		form.setMapping({ kind: AutomationReferenceKind.scene, id: SCENE }, OTHER_SCENE);

		await form.create();

		expect(prepareImport).toHaveBeenLastCalledWith({
			yaml: 'checked',
			mappings: [{ kind: AutomationReferenceKind.scene, id: SCENE, to: OTHER_SCENE }],
		});
	});

	it('never sends a mapping of a reference the backend can not point elsewhere', async () => {
		prepareImport.mockResolvedValueOnce({
			...preparation(SCENE, false),
			missingReferences: [{ kind: AutomationReferenceKind.scene, id: SCENE, usages: [{ nodeId: 'run', field: null }], remappable: false }],
		});

		const form = useAutomationImport();

		form.setYaml('version: 1');

		await form.prepare();

		form.setMapping({ kind: AutomationReferenceKind.scene, id: SCENE }, OTHER_SCENE);

		await form.create();

		expect(prepareImport).toHaveBeenCalledTimes(1);
	});
});
