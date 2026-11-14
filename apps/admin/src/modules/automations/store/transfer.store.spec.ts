import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AutomationMode, AutomationReferenceKind } from '../automations.constants';
import {
	AutomationsApiException,
	AutomationsGraphInvalidException,
	AutomationsImportInvalidException,
	AutomationsValidationException,
} from '../automations.exceptions';

import { useAutomationTransferStore } from './transfer.store';

const mockBackendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	const silent = { error: vi.fn(), info: vi.fn(), warning: vi.fn(), log: vi.fn(), debug: vi.fn() };

	return {
		...actual,
		useBackend: vi.fn(() => ({ client: mockBackendClient })),
		useLogger: vi.fn(() => silent),
		logger: silent,
	};
});

const AUTOMATION = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a00';
const PROPERTY = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a03';
const OTHER_PROPERTY = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a04';

const preparationRes = {
	draft: {
		name: 'Night light',
		description: null,
		icon: 'mdi:lamp',
		mode: AutomationMode.parallel,
		space_id: null,
		graph: {
			version: 1,
			nodes: [{ id: 'n1', type: 'device.property.changed', position: { x: 0, y: 0 }, config: { property_id: PROPERTY, camelKey: true } }],
			edges: [],
		},
	},
	missing_references: [
		{ kind: 'property', id: PROPERTY, usages: [{ node_id: 'n1', field: 'property_id' }], remappable: true },
		{ kind: 'scene', id: PROPERTY, usages: [{ node_id: 'n2', field: null }], remappable: false },
	],
	issues: [{ severity: 'error', code: 'invalid_config', message: 'Choose a property.', blocking: false, node_id: 'n1', field: 'property_id' }],
};

const refused = (code: string, issues: unknown[]) => ({
	data: undefined,
	error: { error: { code: 'UnprocessableEntity', message: 'Refused', details: { reason: 'Refused', code, issues } } },
	response: { status: 422 },
});

describe('useAutomationTransferStore', () => {
	let store: ReturnType<typeof useAutomationTransferStore>;

	beforeEach(() => {
		vi.clearAllMocks();

		setActivePinia(createPinia());

		store = useAutomationTransferStore();
	});

	describe('exportYaml', () => {
		it('reads the YAML document of the automation with the name of its file', async () => {
			mockBackendClient.GET.mockResolvedValue({
				data: { data: { file_name: 'night-light.yaml', content_type: 'application/yaml', content: 'version: 1\n' } },
				response: { status: 200 },
			});

			const pending = store.exportYaml({ id: AUTOMATION });

			expect(store.exporting(AUTOMATION)).toBe(true);

			await expect(pending).resolves.toEqual({ fileName: 'night-light.yaml', contentType: 'application/yaml', content: 'version: 1\n' });

			expect(store.exporting(AUTOMATION)).toBe(false);
			expect(mockBackendClient.GET).toHaveBeenCalledWith('/modules/automations/automations/{id}/export', { params: { path: { id: AUTOMATION } } });
		});

		it('turns a failed read into an API exception', async () => {
			mockBackendClient.GET.mockResolvedValue({ data: undefined, error: undefined, response: { status: 404 } });

			await expect(store.exportYaml({ id: AUTOMATION })).rejects.toBeInstanceOf(AutomationsApiException);
		});

		it('refuses an id that is not one', async () => {
			await expect(store.exportYaml({ id: 'nope' })).rejects.toBeInstanceOf(AutomationsValidationException);

			expect(mockBackendClient.GET).not.toHaveBeenCalled();
		});
	});

	describe('prepareImport', () => {
		it('sends the file with the mappings and keeps the graph as received', async () => {
			mockBackendClient.POST.mockResolvedValue({ data: { data: preparationRes }, response: { status: 200 } });

			const mappings = [{ kind: AutomationReferenceKind.property, id: PROPERTY, to: OTHER_PROPERTY }];

			const preparation = await store.prepareImport({ yaml: 'version: 1', mappings });

			expect(mockBackendClient.POST).toHaveBeenCalledWith('/modules/automations/automations/import/prepare', {
				body: { data: { yaml: 'version: 1', mappings } },
			});
			expect(preparation).toEqual({
				draft: {
					name: 'Night light',
					description: null,
					icon: 'mdi:lamp',
					mode: AutomationMode.parallel,
					spaceId: null,
					graph: preparationRes.draft.graph,
				},
				missingReferences: [
					{ kind: AutomationReferenceKind.property, id: PROPERTY, usages: [{ nodeId: 'n1', field: 'property_id' }], remappable: true },
					{ kind: AutomationReferenceKind.scene, id: PROPERTY, usages: [{ nodeId: 'n2', field: null }], remappable: false },
				],
				issues: [preparationRes.issues[0]],
			});
			expect(store.preparing()).toBe(false);
		});

		it('leaves out mappings when there are none', async () => {
			mockBackendClient.POST.mockResolvedValue({ data: { data: preparationRes }, response: { status: 200 } });

			await store.prepareImport({ yaml: 'version: 1', mappings: [] });

			expect(mockBackendClient.POST.mock.calls[0][1]).toEqual({ body: { data: { yaml: 'version: 1' } } });
		});

		it('tells a file that could not be read from a graph that could not be saved', async () => {
			mockBackendClient.POST.mockResolvedValueOnce(refused('automation-import-invalid', [{ field: 'kind', reason: 'Wrong kind.' }, { nope: 1 }]));

			const invalid = await store.prepareImport({ yaml: 'x' }).catch((error: unknown) => error);

			expect(invalid).toBeInstanceOf(AutomationsImportInvalidException);
			expect((invalid as AutomationsImportInvalidException).issues).toEqual([{ field: 'kind', reason: 'Wrong kind.' }]);

			mockBackendClient.POST.mockResolvedValueOnce(
				refused('automation-graph-invalid', [{ severity: 'error', code: 'safety_reducing_action', message: 'No.', blocking: true, node_id: 'n1' }])
			);

			const unsafe = await store.prepareImport({ yaml: 'x' }).catch((error: unknown) => error);

			expect(unsafe).toBeInstanceOf(AutomationsGraphInvalidException);
			expect((unsafe as AutomationsGraphInvalidException).issues).toEqual([
				expect.objectContaining({ code: 'safety_reducing_action', node_id: 'n1', blocking: true }),
			]);
		});

		it('refuses an empty file before anything is sent', async () => {
			await expect(store.prepareImport({ yaml: '' })).rejects.toBeInstanceOf(AutomationsValidationException);

			expect(mockBackendClient.POST).not.toHaveBeenCalled();
		});
	});
});
