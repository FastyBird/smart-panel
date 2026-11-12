import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AutomationNodeKind } from '../automations.constants';
import { AutomationsApiException, AutomationsValidationException } from '../automations.exceptions';

import { useAutomationNodeTypesStore } from './node-types.store';
import type { IAutomationNodeTypeRes } from './node-types.store.types';
import { transformAutomationNodeTypeResponse } from './node-types.transformers';

const mockBackendClient = {
	GET: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: vi.fn(() => ({
			client: mockBackendClient,
		})),
		// The transformer logs through the shared logger; a refused payload is expected here
		logger: {
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		},
	};
});

const nodeTypeRes = (overrides: Partial<IAutomationNodeTypeRes> = {}): IAutomationNodeTypeRes => ({
	type: 'device.property.changed',
	kind: AutomationNodeKind.trigger,
	name: 'Device value changes',
	description: 'Starts the automation when a value of a device changes.',
	ports: { inputs: [], outputs: ['out'] },
	config_schema: {
		type: 'object',
		properties: { property_id: { type: 'string', format: 'uuid' }, for_seconds: { type: 'integer' } },
		required: ['property_id'],
		additionalProperties: false,
	},
	...overrides,
});

describe('transformAutomationNodeTypeResponse', () => {
	it('renames only the outer key and leaves the JSON Schema as it is', () => {
		const transformed = transformAutomationNodeTypeResponse(nodeTypeRes());

		expect(transformed).toEqual({
			type: 'device.property.changed',
			kind: AutomationNodeKind.trigger,
			name: 'Device value changes',
			description: 'Starts the automation when a value of a device changes.',
			ports: { inputs: [], outputs: ['out'] },
			configSchema: {
				type: 'object',
				properties: { property_id: { type: 'string', format: 'uuid' }, for_seconds: { type: 'integer' } },
				required: ['property_id'],
				additionalProperties: false,
			},
		});
	});

	it('gives a node type without a schema one that accepts any object', () => {
		const withoutSchema: Record<string, unknown> = { ...nodeTypeRes() };

		delete withoutSchema.config_schema;

		expect(transformAutomationNodeTypeResponse(withoutSchema).configSchema).toEqual({ type: 'object', additionalProperties: true });
	});

	it('refuses a node type it cannot read', () => {
		expect(() => transformAutomationNodeTypeResponse({ ...nodeTypeRes(), kind: 'loop' })).toThrow(AutomationsValidationException);
		expect(() => transformAutomationNodeTypeResponse({ type: 'x' })).toThrow(AutomationsValidationException);
	});
});

describe('Automation node types store', () => {
	let store: ReturnType<typeof useAutomationNodeTypesStore>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useAutomationNodeTypesStore();

		vi.clearAllMocks();
	});

	it('starts empty and not loaded', () => {
		expect(store.findAll()).toEqual([]);
		expect(store.findByType('device.property.changed')).toBeNull();
		expect(store.firstLoadFinished()).toBe(false);
		expect(store.isLoaded()).toBe(false);
	});

	it('fetches the catalogue', async () => {
		mockBackendClient.GET.mockResolvedValue({
			data: {
				data: [
					nodeTypeRes(),
					nodeTypeRes({ type: 'flow.delay', kind: AutomationNodeKind.flow, name: 'Delay', ports: { inputs: ['in'], outputs: ['out'] } }),
				],
			},
			response: { status: 200 },
		});

		const nodeTypes = await store.fetch();

		expect(mockBackendClient.GET).toHaveBeenCalledWith('/modules/automations/node-types');
		expect(nodeTypes.map((nodeType) => nodeType.type)).toEqual(['device.property.changed', 'flow.delay']);
		expect(store.findByType('flow.delay')).toMatchObject({ kind: AutomationNodeKind.flow, ports: { inputs: ['in'], outputs: ['out'] } });
		expect(store.firstLoadFinished()).toBe(true);
		expect(store.isLoaded()).toBe(true);
		expect(store.fetching()).toBe(false);
	});

	it('drops a node type that is no longer offered', async () => {
		mockBackendClient.GET.mockResolvedValueOnce({
			data: { data: [nodeTypeRes(), nodeTypeRes({ type: 'plugin.card', kind: AutomationNodeKind.action })] },
			response: { status: 200 },
		});

		await store.fetch();

		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [nodeTypeRes()] }, response: { status: 200 } });

		await store.refresh();

		expect(store.findAll().map((nodeType) => nodeType.type)).toEqual(['device.property.changed']);
	});

	it('shares one request between callers asking at the same time', async () => {
		mockBackendClient.GET.mockResolvedValue({ data: { data: [nodeTypeRes()] }, response: { status: 200 } });

		await Promise.all([store.fetch(), store.fetch()]);

		expect(mockBackendClient.GET).toHaveBeenCalledTimes(1);
	});

	it('reads the catalogue anew after a reconnect, also while the first read is still on its way', async () => {
		let answerFirst: (value: unknown) => void = () => {};

		mockBackendClient.GET.mockReturnValueOnce(
			new Promise((res) => {
				answerFirst = res;
			})
		);

		const first = store.fetch();

		// Answered from before the reconnect: whatever it says may already be out of date
		expect(store.isLoaded()).toBe(true);

		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [nodeTypeRes({ type: 'plugin.card' })] }, response: { status: 200 } });

		const refreshing = store.refresh();

		answerFirst({ data: { data: [nodeTypeRes()] }, response: { status: 200 } });

		await first;
		await refreshing;

		expect(mockBackendClient.GET).toHaveBeenCalledTimes(2);
		expect(store.findAll().map((nodeType) => nodeType.type)).toEqual(['plugin.card']);
	});

	it('reads anew after a reconnect even when the read before it failed', async () => {
		mockBackendClient.GET.mockResolvedValueOnce({ data: undefined, error: undefined, response: { status: 500 } });

		const first = store.fetch();

		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [nodeTypeRes()] }, response: { status: 200 } });

		const refreshing = store.refresh();

		await expect(first).rejects.toMatchObject({ code: 500 });
		await refreshing;

		expect(store.findAll()).toHaveLength(1);
	});

	it('throws and keeps what it holds when the fetch fails', async () => {
		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [nodeTypeRes()] }, response: { status: 200 } });

		await store.fetch();

		mockBackendClient.GET.mockResolvedValueOnce({ data: undefined, error: undefined, response: { status: 500 } });

		await expect(store.fetch()).rejects.toMatchObject({ code: 500 });

		mockBackendClient.GET.mockRejectedValueOnce(new Error('offline'));

		await expect(store.fetch()).rejects.toBeInstanceOf(AutomationsApiException);

		expect(store.findAll()).toHaveLength(1);
		expect(store.fetching()).toBe(false);
	});

	it('keeps the catalogue it holds when an entry of the new one cannot be read', async () => {
		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [nodeTypeRes()] }, response: { status: 200 } });

		await store.fetch();

		mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [{ type: 'broken' }] }, response: { status: 200 } });

		await expect(store.fetch()).rejects.toBeInstanceOf(AutomationsValidationException);
		expect(store.findAll().map((nodeType) => nodeType.type)).toEqual(['device.property.changed']);
	});
});
