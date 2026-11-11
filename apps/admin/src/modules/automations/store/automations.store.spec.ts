import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AutomationMode, AutomationRunStatus, AutomationStatus } from '../automations.constants';
import {
	AutomationsApiException,
	AutomationsGraphInvalidException,
	AutomationsRevisionConflictException,
	AutomationsValidationException,
} from '../automations.exceptions';

import { useAutomationsStore } from './automations.store';
import type { IAutomationGraph, IAutomationRes, IAutomationSummaryRes } from './automations.store.types';

const mockBackendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
	DELETE: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: vi.fn(() => ({
			client: mockBackendClient,
		})),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		// The transformers log through the shared logger; a refused payload is expected here
		logger: {
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		},
	};
});

const automationId = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a01';
const otherAutomationId = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a02';
const spaceId = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a03';
const thirdAutomationId = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a04';

const graph: IAutomationGraph = {
	version: 1,
	nodes: [
		{ id: 'n1', type: 'device.property.changed', position: { x: 0, y: 0 }, config: { property_id: spaceId, to: true } },
		{ id: 'n2', type: 'notify', position: { x: 200, y: 0 }, config: { message_text: 'Hello' } },
	],
	edges: [{ id: 'e1', source: 'n1', source_port: 'out', target: 'n2', target_port: 'in' }],
};

const summaryRes = (overrides: Partial<IAutomationSummaryRes> = {}): IAutomationSummaryRes => ({
	id: automationId,
	name: 'Hallway motion light',
	description: null,
	icon: null,
	enabled: false,
	space_id: null,
	mode: AutomationMode.restart,
	revision: 1,
	status: AutomationStatus.ok,
	last_triggered_at: null,
	last_run_status: null,
	created_at: '2026-01-01T10:00:00.000Z',
	updated_at: null,
	...overrides,
});

const detailRes = (overrides: Partial<IAutomationRes> = {}): IAutomationRes => ({
	...summaryRes(),
	graph,
	...overrides,
});

const errorEnvelope = (details: unknown): { error: { code: string; message: string; details: unknown } } => ({
	error: { code: 'Error', message: 'Refused', details },
});

describe('Automations Store', () => {
	let store: ReturnType<typeof useAutomationsStore>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useAutomationsStore();

		vi.clearAllMocks();
	});

	describe('fetch', () => {
		it('loads the list and marks the first load as finished', async () => {
			mockBackendClient.GET.mockResolvedValue({
				data: { data: [summaryRes(), summaryRes({ id: otherAutomationId, name: 'Night mode', space_id: spaceId })] },
				response: { status: 200 },
			});

			const result = await store.fetch();

			expect(mockBackendClient.GET).toHaveBeenCalledWith('/modules/automations/automations');
			expect(result).toHaveLength(2);
			expect(store.firstLoadFinished()).toBe(true);
			expect(store.isLoaded()).toBe(true);
			expect(store.fetching()).toBe(false);
			expect(store.findById(automationId)).toMatchObject({
				name: 'Hallway motion light',
				spaceId: null,
				graph: null,
				revision: 1,
				lastTriggeredAt: null,
				lastRunStatus: null,
			});
			expect(store.findBySpace(spaceId).map((automation) => automation.id)).toEqual([otherAutomationId]);
		});

		it('drops automations that are no longer in the list', async () => {
			store.set({ id: otherAutomationId, data: { name: 'Gone', createdAt: new Date() } });

			mockBackendClient.GET.mockResolvedValue({ data: { data: [summaryRes()] }, response: { status: 200 } });

			await store.fetch();

			expect(store.findAll().map((automation) => automation.id)).toEqual([automationId]);
		});

		it('keeps a graph read earlier while the revision has not moved, and drops it once it has', async () => {
			mockBackendClient.GET.mockResolvedValueOnce({ data: { data: detailRes() }, response: { status: 200 } });

			await store.get({ id: automationId });

			expect(store.findById(automationId)?.graph).toEqual(graph);

			mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [summaryRes()] }, response: { status: 200 } });

			await store.fetch();

			expect(store.findById(automationId)?.graph).toEqual(graph);

			mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [summaryRes({ revision: 2 })] }, response: { status: 200 } });

			await store.fetch();

			expect(store.findById(automationId)).toMatchObject({ revision: 2, graph: null });
		});

		it('shares one request between concurrent callers', async () => {
			mockBackendClient.GET.mockResolvedValue({ data: { data: [summaryRes()] }, response: { status: 200 } });

			await Promise.all([store.fetch(), store.fetch()]);

			expect(mockBackendClient.GET).toHaveBeenCalledTimes(1);
		});

		it('keeps an automation created while the list was on its way', async () => {
			let resolve: (value: unknown) => void = () => {};

			mockBackendClient.GET.mockReturnValue(
				new Promise((res) => {
					resolve = res;
				})
			);
			mockBackendClient.POST.mockResolvedValue({
				data: { data: detailRes({ id: otherAutomationId, name: 'Night mode' }) },
				response: { status: 201 },
			});

			const pending = store.fetch();

			// One is created here, another one is announced by the backend - neither is in the snapshot
			await store.add({ id: otherAutomationId, data: { name: 'Night mode' } });
			store.onEvent({ id: thirdAutomationId, data: detailRes({ id: thirdAutomationId, name: 'Away heating' }) });

			resolve({ data: { data: [summaryRes()] }, response: { status: 200 } });

			await pending;

			expect(
				store
					.findAll()
					.map((automation) => automation.name)
					.sort()
			).toEqual(['Away heating', 'Hallway motion light', 'Night mode']);
		});

		it('does not bring back an automation removed while the list was on its way', async () => {
			store.set({ id: automationId, data: { name: 'Hallway motion light', createdAt: new Date() } });

			let resolve: (value: unknown) => void = () => {};

			mockBackendClient.GET.mockReturnValue(
				new Promise((res) => {
					resolve = res;
				})
			);

			const pending = store.fetch();

			store.unset({ id: automationId });

			resolve({ data: { data: [summaryRes(), summaryRes({ id: otherAutomationId, name: 'Night mode' })] }, response: { status: 200 } });

			await expect(pending).resolves.toHaveLength(1);

			expect(store.findAll().map((automation) => automation.id)).toEqual([otherAutomationId]);
		});

		it('still removes what is missing from a later list', async () => {
			mockBackendClient.GET.mockResolvedValue({ data: { data: [summaryRes()] }, response: { status: 200 } });

			await store.fetch();

			// Written between two reads, so the next list is the one that decides about it
			store.onEvent({ id: otherAutomationId, data: detailRes({ id: otherAutomationId, name: 'Night mode' }) });

			await store.fetch();

			expect(store.findAll().map((automation) => automation.id)).toEqual([automationId]);
		});

		it('does not put an older revision from the list over a newer one', async () => {
			let resolve: (value: unknown) => void = () => {};

			mockBackendClient.GET.mockReturnValue(
				new Promise((res) => {
					resolve = res;
				})
			);

			const pending = store.fetch();

			store.onEvent({ id: automationId, data: detailRes({ name: 'Renamed', revision: 4 }) });

			resolve({ data: { data: [summaryRes({ revision: 3 })] }, response: { status: 200 } });

			await pending;

			expect(store.findById(automationId)).toMatchObject({ name: 'Renamed', revision: 4, graph });
		});

		it('throws when the backend refuses the request', async () => {
			mockBackendClient.GET.mockResolvedValue({ data: undefined, error: errorEnvelope(null), response: { status: 403 } });

			await expect(store.fetch()).rejects.toMatchObject({ name: 'AutomationsApiException', code: 403 });
			expect(store.firstLoadFinished()).toBe(false);
			expect(store.fetching()).toBe(false);
		});

		it('wraps a network failure', async () => {
			mockBackendClient.GET.mockRejectedValue(new Error('offline'));

			await expect(store.fetch()).rejects.toBeInstanceOf(AutomationsApiException);
		});
	});

	describe('get', () => {
		it('reads one automation with its graph and leaves node configurations untouched', async () => {
			mockBackendClient.GET.mockResolvedValue({
				data: {
					data: detailRes({
						space_id: spaceId,
						last_triggered_at: '2026-01-02T08:30:00.000Z',
						last_run_status: AutomationRunStatus.completed,
					}),
				},
				response: { status: 200 },
			});

			const automation = await store.get({ id: automationId });

			expect(mockBackendClient.GET).toHaveBeenCalledWith('/modules/automations/automations/{id}', { params: { path: { id: automationId } } });
			expect(automation.spaceId).toBe(spaceId);
			expect(automation.lastTriggeredAt).toEqual(new Date('2026-01-02T08:30:00.000Z'));
			expect(automation.lastRunStatus).toBe(AutomationRunStatus.completed);
			// Snake case keys of the graph and of the node configurations survive the transformer
			expect(automation.graph).toEqual(graph);
			expect(store.getting(automationId)).toBe(false);
		});

		it('does not let a late response put an older revision over a newer one', async () => {
			let resolve: (value: unknown) => void = () => {};

			mockBackendClient.GET.mockReturnValue(
				new Promise((res) => {
					resolve = res;
				})
			);

			const pending = store.get({ id: automationId });

			// The automation is saved elsewhere after the backend has answered the read, and its event gets here first
			store.onEvent({ id: automationId, data: detailRes({ name: 'Renamed', revision: 4 }) });

			resolve({ data: { data: detailRes({ name: 'Hallway motion light', revision: 3 }) }, response: { status: 200 } });

			await expect(pending).resolves.toMatchObject({ name: 'Renamed', revision: 4 });

			expect(store.findById(automationId)).toMatchObject({ name: 'Renamed', revision: 4 });
		});

		it('removes the automation from the store when it no longer exists', async () => {
			store.set({ id: automationId, data: { name: 'Gone', createdAt: new Date() } });

			mockBackendClient.GET.mockResolvedValue({ data: undefined, error: errorEnvelope(null), response: { status: 404 } });

			await expect(store.get({ id: automationId })).rejects.toMatchObject({ code: 404 });
			expect(store.findById(automationId)).toBeNull();
		});
	});

	describe('add', () => {
		it('creates the automation and stores the response', async () => {
			mockBackendClient.POST.mockResolvedValue({ data: { data: detailRes({ space_id: spaceId }) }, response: { status: 201 } });

			const automation = await store.add({
				id: automationId,
				data: { name: '  Hallway motion light ', description: '', spaceId, mode: AutomationMode.restart },
			});

			expect(mockBackendClient.POST).toHaveBeenCalledWith('/modules/automations/automations', {
				body: {
					data: { id: automationId, name: 'Hallway motion light', description: null, space_id: spaceId, mode: AutomationMode.restart },
				},
			});
			expect(automation.id).toBe(automationId);
			expect(store.findById(automationId)?.graph).toEqual(graph);
			expect(store.semaphore.creating).toEqual([]);
		});

		it('rejects an invalid payload without calling the backend', async () => {
			await expect(store.add({ data: { name: '   ' } })).rejects.toBeInstanceOf(AutomationsValidationException);
			expect(mockBackendClient.POST).not.toHaveBeenCalled();
		});

		it('reports a graph the backend refused together with its issues', async () => {
			mockBackendClient.POST.mockResolvedValue({
				data: undefined,
				error: errorEnvelope({
					code: 'automation-graph-invalid',
					reason: 'The graph is not valid',
					issues: [{ severity: 'error', code: 'no_trigger', message: 'The automation has no trigger', blocking: true }, { nonsense: true }],
				}),
				response: { status: 422 },
			});

			const error = await store.add({ data: { name: 'Broken', enabled: true } }).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(AutomationsGraphInvalidException);
			expect((error as AutomationsGraphInvalidException).message).toBe('The graph is not valid');
			expect((error as AutomationsGraphInvalidException).issues).toEqual([
				{ severity: 'error', code: 'no_trigger', message: 'The automation has no trigger', blocking: true },
			]);
			expect(store.findAll()).toEqual([]);
		});
	});

	describe('edit', () => {
		beforeEach(() => {
			store.set({ id: automationId, data: { name: 'Hallway motion light', revision: 3, graph, createdAt: new Date() } });
		});

		it('sends the revision it is based on and stores the new one', async () => {
			mockBackendClient.PATCH.mockResolvedValue({ data: { data: detailRes({ enabled: true, revision: 4 }) }, response: { status: 200 } });

			const automation = await store.edit({ id: automationId, data: { enabled: true } });

			expect(mockBackendClient.PATCH).toHaveBeenCalledWith('/modules/automations/automations/{id}', {
				params: { path: { id: automationId } },
				body: { data: { revision: 3, enabled: true } },
			});
			expect(automation).toMatchObject({ enabled: true, revision: 4 });
			expect(store.findById(automationId)).toMatchObject({ enabled: true, revision: 4 });
			expect(store.semaphore.updating).toEqual([]);
		});

		it('sends the revision the caller based its change on, not the one held', async () => {
			// The automation has moved on since the caller copied it at revision 2
			mockBackendClient.PATCH.mockResolvedValue({ data: undefined, error: errorEnvelope({ reason: 'Changed' }), response: { status: 409 } });
			mockBackendClient.GET.mockResolvedValue({ data: { data: detailRes({ revision: 3 }) }, response: { status: 200 } });

			await expect(store.edit({ id: automationId, revision: 2, data: { name: 'Hallway light' } })).rejects.toBeInstanceOf(
				AutomationsRevisionConflictException
			);

			expect(mockBackendClient.PATCH).toHaveBeenCalledWith('/modules/automations/automations/{id}', {
				params: { path: { id: automationId } },
				body: { data: { revision: 2, name: 'Hallway light' } },
			});
		});

		it('does not let a late response of a save put an older revision over a newer one', async () => {
			let resolve: (value: unknown) => void = () => {};

			mockBackendClient.PATCH.mockReturnValue(
				new Promise((res) => {
					resolve = res;
				})
			);

			const pending = store.edit({ id: automationId, data: { enabled: true } });

			store.onEvent({ id: automationId, data: detailRes({ name: 'Renamed', enabled: true, revision: 5 }) });

			resolve({ data: { data: detailRes({ enabled: true, revision: 4 }) }, response: { status: 200 } });

			await pending;

			expect(store.findById(automationId)).toMatchObject({ name: 'Renamed', revision: 5 });
		});

		it('does not touch the store before the backend has accepted the change', async () => {
			let resolve: (value: unknown) => void = () => {};

			mockBackendClient.PATCH.mockReturnValue(
				new Promise((res) => {
					resolve = res;
				})
			);

			const pending = store.edit({ id: automationId, data: { enabled: true } });

			expect(store.findById(automationId)?.enabled).toBe(false);
			expect(store.semaphore.updating).toEqual([automationId]);

			resolve({ data: { data: detailRes({ enabled: true, revision: 4 }) }, response: { status: 200 } });

			await pending;

			expect(store.findById(automationId)?.enabled).toBe(true);
		});

		it('reloads the automation and reports a conflict when the revision has moved', async () => {
			mockBackendClient.PATCH.mockResolvedValue({ data: undefined, error: errorEnvelope({ reason: 'Changed' }), response: { status: 409 } });
			mockBackendClient.GET.mockResolvedValue({ data: { data: detailRes({ name: 'Renamed elsewhere', revision: 5 }) }, response: { status: 200 } });

			await expect(store.edit({ id: automationId, data: { enabled: true } })).rejects.toBeInstanceOf(AutomationsRevisionConflictException);

			expect(mockBackendClient.GET).toHaveBeenCalledTimes(1);
			expect(store.findById(automationId)).toMatchObject({ name: 'Renamed elsewhere', revision: 5, enabled: false });
			expect(store.semaphore.updating).toEqual([]);
		});

		it('still reports the conflict when the reload fails', async () => {
			mockBackendClient.PATCH.mockResolvedValue({ data: undefined, error: errorEnvelope(null), response: { status: 409 } });
			mockBackendClient.GET.mockRejectedValue(new Error('offline'));

			await expect(store.edit({ id: automationId, data: { enabled: true } })).rejects.toBeInstanceOf(AutomationsRevisionConflictException);
		});

		it('reports an automation that cannot be enabled because of its graph and leaves it as it was', async () => {
			mockBackendClient.PATCH.mockResolvedValue({
				data: undefined,
				error: errorEnvelope({ code: 'automation-graph-invalid', issues: [] }),
				response: { status: 422 },
			});

			await expect(store.edit({ id: automationId, data: { enabled: true } })).rejects.toBeInstanceOf(AutomationsGraphInvalidException);

			expect(store.findById(automationId)).toMatchObject({ enabled: false, revision: 3 });
		});

		it('treats any other 422 as a plain API failure', async () => {
			mockBackendClient.PATCH.mockResolvedValue({
				data: undefined,
				error: errorEnvelope({ reason: 'Space does not exist' }),
				response: { status: 422 },
			});

			const error = await store.edit({ id: automationId, data: { spaceId } }).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(AutomationsApiException);
			expect(error).not.toBeInstanceOf(AutomationsGraphInvalidException);
			expect(error).toMatchObject({ code: 422, message: 'Space does not exist' });
		});

		it('removes an automation the backend no longer knows', async () => {
			mockBackendClient.PATCH.mockResolvedValue({ data: undefined, error: errorEnvelope(null), response: { status: 404 } });

			await expect(store.edit({ id: automationId, data: { enabled: true } })).rejects.toMatchObject({ code: 404 });
			expect(store.findById(automationId)).toBeNull();
		});

		it('throws for an automation that is not in the store', async () => {
			await expect(store.edit({ id: otherAutomationId, data: { enabled: true } })).rejects.toBeInstanceOf(AutomationsApiException);
			expect(mockBackendClient.PATCH).not.toHaveBeenCalled();
		});

		it('sends a graph as it is, without rewriting its keys', async () => {
			mockBackendClient.PATCH.mockResolvedValue({ data: { data: detailRes({ revision: 4 }) }, response: { status: 200 } });

			await store.edit({ id: automationId, data: { graph } });

			expect(mockBackendClient.PATCH).toHaveBeenCalledWith('/modules/automations/automations/{id}', {
				params: { path: { id: automationId } },
				body: { data: { revision: 3, graph } },
			});
		});
	});

	describe('remove', () => {
		beforeEach(() => {
			store.set({ id: automationId, data: { name: 'Hallway motion light', createdAt: new Date() } });
		});

		it('deletes the automation', async () => {
			mockBackendClient.DELETE.mockResolvedValue({ response: { status: 204 } });

			await store.remove({ id: automationId });

			expect(mockBackendClient.DELETE).toHaveBeenCalledWith('/modules/automations/automations/{id}', { params: { path: { id: automationId } } });
			expect(store.findById(automationId)).toBeNull();
			expect(store.semaphore.deleting).toEqual([]);
		});

		it('treats an automation already gone on the backend as removed', async () => {
			mockBackendClient.DELETE.mockResolvedValue({ error: errorEnvelope(null), response: { status: 404 } });

			await store.remove({ id: automationId });

			expect(store.findById(automationId)).toBeNull();
		});

		it('keeps the automation when the backend fails', async () => {
			mockBackendClient.DELETE.mockResolvedValue({ error: errorEnvelope(null), response: { status: 500 } });

			await expect(store.remove({ id: automationId })).rejects.toMatchObject({ code: 500 });
			expect(store.findById(automationId)).not.toBeNull();
		});

		it('does nothing for an automation that is not in the store', async () => {
			await store.remove({ id: otherAutomationId });

			expect(mockBackendClient.DELETE).not.toHaveBeenCalled();
		});
	});

	describe('onEvent', () => {
		it('inserts an automation announced by the backend', () => {
			const automation = store.onEvent({ id: automationId, data: detailRes() });

			expect(automation.graph).toEqual(graph);
			expect(store.findById(automationId)?.name).toBe('Hallway motion light');
		});

		it('applies a status written by the engine at the same revision', () => {
			store.onEvent({ id: automationId, data: detailRes({ revision: 2 }) });

			store.onEvent({
				id: automationId,
				data: detailRes({
					revision: 2,
					status: AutomationStatus.suspended,
					last_triggered_at: '2026-01-02T08:30:00.000Z',
					last_run_status: AutomationRunStatus.failed,
				}),
			});

			expect(store.findById(automationId)).toMatchObject({
				status: AutomationStatus.suspended,
				lastRunStatus: AutomationRunStatus.failed,
				lastTriggeredAt: new Date('2026-01-02T08:30:00.000Z'),
			});
		});

		it('ignores an event older than what is held', () => {
			store.onEvent({ id: automationId, data: detailRes({ name: 'New name', revision: 3 }) });

			const automation = store.onEvent({ id: automationId, data: detailRes({ name: 'Old name', revision: 2 }) });

			expect(automation.name).toBe('New name');
			expect(store.findById(automationId)).toMatchObject({ name: 'New name', revision: 3 });
		});

		it('throws on a payload that is not an automation', () => {
			expect(() => store.onEvent({ id: automationId, data: { id: automationId } })).toThrow(AutomationsValidationException);
		});
	});

	describe('set and unset', () => {
		it('merges into an existing automation', () => {
			store.set({ id: automationId, data: { name: 'Hallway motion light', createdAt: new Date() } });
			store.set({ id: automationId, data: { enabled: true } });

			expect(store.findById(automationId)).toMatchObject({ name: 'Hallway motion light', enabled: true });
		});

		it('rejects data that does not make an automation', () => {
			expect(() => store.set({ id: automationId, data: { enabled: true } })).toThrow(AutomationsValidationException);
		});

		it('removes an automation', () => {
			store.set({ id: automationId, data: { name: 'Hallway motion light', createdAt: new Date() } });

			store.unset({ id: automationId });

			expect(store.findAll()).toEqual([]);
		});
	});

	describe('refresh contract', () => {
		it('is not loaded before anything was read', () => {
			expect(store.isLoaded()).toBe(false);
		});

		it('re-reads the list on refresh', async () => {
			mockBackendClient.GET.mockResolvedValue({ data: { data: [summaryRes()] }, response: { status: 200 } });

			await store.refresh();

			expect(mockBackendClient.GET).toHaveBeenCalledWith('/modules/automations/automations');
			expect(store.isLoaded()).toBe(true);
		});
	});
});
