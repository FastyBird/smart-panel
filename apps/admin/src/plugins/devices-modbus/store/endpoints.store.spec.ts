import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModbusApiException } from '../devices-modbus.exceptions';

import { useModbusEndpoints } from './endpoints.store';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({ client: { GET: get, POST: post, PATCH: patch, DELETE: del } }),
		getErrorReason: (_error: unknown, fallback: string) => (_error as { reason?: string })?.reason ?? fallback,
	};
});

const wireEndpoint = (overrides: Record<string, unknown> = {}) => ({
	id: '4a2515a6-7e87-4e51-96cc-832698237613',
	created_at: '2026-11-10T10:00:00.000Z',
	updated_at: null,
	name: 'Boiler room gateway',
	host: '10.10.0.230',
	port: 502,
	framing: 'tcp',
	connect_timeout_ms: 2000,
	request_timeout_ms: 1000,
	inter_request_delay_ms: 0,
	max_in_flight: 1,
	enabled: true,
	...overrides,
});

describe('Modbus endpoints store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
	});

	it('fetch maps snake_case endpoints to camelCase and indexes them by id', async () => {
		get.mockResolvedValue({ data: { data: [wireEndpoint()] }, response: { status: 200 } });
		const store = useModbusEndpoints();

		await store.fetch();

		expect(get).toHaveBeenCalledWith('/plugins/devices-modbus/endpoints');
		const endpoint = store.findById('4a2515a6-7e87-4e51-96cc-832698237613');
		expect(endpoint).toMatchObject({
			name: 'Boiler room gateway',
			host: '10.10.0.230',
			connectTimeoutMs: 2000,
			requestTimeoutMs: 1000,
			interRequestDelayMs: 0,
			maxInFlight: 1,
			enabled: true,
			updatedAt: null,
		});
		expect(endpoint?.createdAt).toEqual(new Date('2026-11-10T10:00:00.000Z'));
		expect(store.findAll()).toHaveLength(1);
	});

	it('fetch replaces entries that no longer exist', async () => {
		get.mockResolvedValueOnce({ data: { data: [wireEndpoint()] }, response: { status: 200 } });
		get.mockResolvedValueOnce({ data: { data: [] }, response: { status: 200 } });
		const store = useModbusEndpoints();

		await store.fetch();
		await store.fetch();

		expect(store.findAll()).toEqual([]);
	});

	it('add posts the data wrapper with snake_case fields and stores the created endpoint', async () => {
		post.mockResolvedValue({ data: { data: wireEndpoint({ framing: 'rtu_over_tcp' }) }, response: { status: 201 } });
		const store = useModbusEndpoints();

		const created = await store.add({ name: 'Boiler room gateway', host: '10.10.0.230', framing: 'rtu_over_tcp' as never, connectTimeoutMs: 2000 });

		expect(post).toHaveBeenCalledWith('/plugins/devices-modbus/endpoints', {
			body: { data: { name: 'Boiler room gateway', host: '10.10.0.230', framing: 'rtu_over_tcp', connect_timeout_ms: 2000 } },
		});
		expect(created.framing).toBe('rtu_over_tcp');
		expect(store.findById(created.id)).toEqual(created);
	});

	it.each([422, 400])('add surfaces the backend reason on a %s response', async (status) => {
		post.mockResolvedValue({ error: { reason: 'An endpoint with this host and port already exists.' }, response: { status } });
		const store = useModbusEndpoints();

		const failure = store.add({ name: 'Duplicate', host: '10.10.0.230' });

		await expect(failure).rejects.toThrow('An endpoint with this host and port already exists.');
		await expect(failure).rejects.toMatchObject({ code: status });
		await expect(failure).rejects.toBeInstanceOf(DevicesModbusApiException);
		expect(store.findAll()).toEqual([]);
	});

	it('edit patches only the changed fields and updates the stored endpoint', async () => {
		get.mockResolvedValue({ data: { data: [wireEndpoint()] }, response: { status: 200 } });
		patch.mockResolvedValue({ data: { data: wireEndpoint({ name: 'Renamed', enabled: false }) }, response: { status: 200 } });
		const store = useModbusEndpoints();
		await store.fetch();

		const edited = await store.edit('4a2515a6-7e87-4e51-96cc-832698237613', { name: 'Renamed', enabled: false });

		expect(patch).toHaveBeenCalledWith('/plugins/devices-modbus/endpoints/{id}', {
			params: { path: { id: '4a2515a6-7e87-4e51-96cc-832698237613' } },
			body: { data: { name: 'Renamed', enabled: false } },
		});
		expect(edited.name).toBe('Renamed');
		expect(store.findById('4a2515a6-7e87-4e51-96cc-832698237613')?.enabled).toBe(false);
	});

	it('fetch prunes health of endpoints that no longer exist', async () => {
		const keep = wireEndpoint({ id: 'keep' });
		const gone = wireEndpoint({ id: 'gone' });
		const wireHealth = {
			state: 'connected',
			last_error: null,
			last_error_at: null,
			average_latency_ms: 1,
			requests: 1,
			timeouts: 0,
			overloaded: false,
		};
		get.mockResolvedValueOnce({ data: { data: [keep, gone] }, response: { status: 200 } });
		get.mockResolvedValueOnce({ data: { data: wireHealth }, response: { status: 200 } });
		get.mockResolvedValueOnce({ data: { data: wireHealth }, response: { status: 200 } });
		get.mockResolvedValueOnce({ data: { data: [keep] }, response: { status: 200 } });
		const store = useModbusEndpoints();
		await store.fetch();
		await store.fetchHealth('keep');
		await store.fetchHealth('gone');

		await store.fetch();

		expect(Object.keys(store.health)).toEqual(['keep']);
	});

	it('add exposes backend field errors on the exception', async () => {
		post.mockResolvedValue({
			error: { error: { details: [{ field: 'host', reason: 'Host is invalid.' }] } },
			response: { status: 400 },
		});
		const store = useModbusEndpoints();

		const error = await store.add({ name: 'x', host: '' }).catch((e: unknown) => e);

		expect((error as DevicesModbusApiException).fields).toEqual([{ field: 'host', reason: 'Host is invalid.' }]);
	});

	it('remove drops the entry and its health', async () => {
		get.mockResolvedValueOnce({ data: { data: [wireEndpoint()] }, response: { status: 200 } });
		get.mockResolvedValueOnce({
			data: {
				data: { state: 'connected', last_error: null, last_error_at: null, average_latency_ms: 12.5, requests: 3, timeouts: 0, overloaded: false },
			},
			response: { status: 200 },
		});
		del.mockResolvedValue({ response: { status: 204 } });
		const store = useModbusEndpoints();
		await store.fetch();
		await store.fetchHealth('4a2515a6-7e87-4e51-96cc-832698237613');
		expect(store.health['4a2515a6-7e87-4e51-96cc-832698237613']?.averageLatencyMs).toBe(12.5);

		await store.remove('4a2515a6-7e87-4e51-96cc-832698237613');

		expect(del).toHaveBeenCalledWith('/plugins/devices-modbus/endpoints/{id}', {
			params: { path: { id: '4a2515a6-7e87-4e51-96cc-832698237613' } },
		});
		expect(store.findById('4a2515a6-7e87-4e51-96cc-832698237613')).toBeNull();
		expect(store.health['4a2515a6-7e87-4e51-96cc-832698237613']).toBeUndefined();
	});

	it('remove keeps the entry and throws when the backend refuses', async () => {
		get.mockResolvedValue({ data: { data: [wireEndpoint()] }, response: { status: 200 } });
		del.mockResolvedValue({ error: { reason: 'Endpoint is used by devices.' }, response: { status: 400 } });
		const store = useModbusEndpoints();
		await store.fetch();

		await expect(store.remove('4a2515a6-7e87-4e51-96cc-832698237613')).rejects.toThrow('Endpoint is used by devices.');
		expect(store.findAll()).toHaveLength(1);
	});

	it.each([
		['an HTTP failure', () => get.mockResolvedValue({ data: undefined, error: { reason: 'down' }, response: { status: 500 } })],
		['a network error', () => get.mockRejectedValue(new Error('offline'))],
	])('fetchHealth drops the last known health after %s', async (_label, fail) => {
		const store = useModbusEndpoints();

		store.health['abc'] = {
			state: 'connected',
			lastError: null,
			lastErrorAt: null,
			averageLatencyMs: 5,
			requests: 1,
			timeouts: 0,
			overloaded: false,
		} as never;
		fail();

		await expect(store.fetchHealth('abc')).rejects.toThrow();
		expect(store.health['abc']).toBeUndefined();
	});

	it('fetchHealth maps the health snapshot', async () => {
		get.mockResolvedValue({
			data: {
				data: {
					state: 'backoff',
					last_error: 'ECONNREFUSED',
					last_error_at: '2026-11-10T10:05:00.000Z',
					average_latency_ms: null,
					requests: 10,
					timeouts: 2,
					overloaded: true,
				},
			},
			response: { status: 200 },
		});
		const store = useModbusEndpoints();

		const health = await store.fetchHealth('abc');

		expect(get).toHaveBeenCalledWith('/plugins/devices-modbus/endpoints/{id}/health', { params: { path: { id: 'abc' } } });
		expect(health).toEqual({
			state: 'backoff',
			lastError: 'ECONNREFUSED',
			lastErrorAt: new Date('2026-11-10T10:05:00.000Z'),
			averageLatencyMs: null,
			requests: 10,
			timeouts: 2,
			overloaded: true,
		});
		expect(store.health['abc']).toEqual(health);
	});
});
