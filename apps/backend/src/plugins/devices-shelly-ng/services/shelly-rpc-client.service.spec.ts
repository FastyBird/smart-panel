/*
eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment,
@typescript-eslint/no-unnecessary-type-assertion
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import type { Response } from 'node-fetch';
import fetch from 'node-fetch';

import { DevicesShellyNgException } from '../devices-shelly-ng.exceptions';

import { ShellyRpcClientService } from './shelly-rpc-client.service';

jest.mock('node-fetch', () => ({ __esModule: true, default: jest.fn() }));

const mockFetch = fetch as unknown as jest.MockedFunction<typeof fetch>;

/**
 * Minimal Response stubs the service actually touches
 */
const okJson = (obj: object): Response =>
	({
		ok: true,
		status: 200,
		statusText: 'OK',
		json: async () => obj,
		text: async () => JSON.stringify(obj),

		headers: new Map() as any,
		redirected: false,
		type: 'basic',
		url: 'http://test',
		clone() {
			return this as any;
		},
		body: null,
		bodyUsed: false,
		arrayBuffer: async () => new ArrayBuffer(0),
		blob: async () => ({}) as any,
		formData: async () => ({}) as any,
	}) as unknown as Response;

const notOkText = (status: number, statusText: string, body: string): Response =>
	({
		ok: false,
		status,
		statusText,
		json: async () => {
			throw new Error('no json');
		},
		text: async () => body,

		headers: new Map() as any,
		redirected: false,
		type: 'basic',
		url: 'http://test',
		clone() {
			return this as any;
		},
		body: null,
		bodyUsed: false,
		arrayBuffer: async () => new ArrayBuffer(0),
		blob: async () => ({}) as any,
		formData: async () => ({}) as any,
	}) as unknown as Response;

describe('ShellyRpcClientService', () => {
	const svc = new ShellyRpcClientService();

	afterEach(() => {
		mockFetch.mockReset();
		jest.useRealTimers();
	});

	test('Successful call returns result payload', async () => {
		mockFetch.mockResolvedValueOnce(okJson({ result: { ok: true, hello: 'world' } }));

		const res = await svc.getDeviceInfo('host');

		expect(res).toEqual({ ok: true, hello: 'world' });
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	test('HTTP error -> throws DevicesShellyNgException with status and text', async () => {
		mockFetch.mockResolvedValueOnce(notOkText(404, 'Not Found', 'nope'));

		const err = await svc.getDeviceInfo('host').catch((e) => e as Error);

		expect(err).toBeInstanceOf(DevicesShellyNgException);
		expect(String((err as Error).message)).toMatch(/HTTP 404 Not Found: nope/);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	test('RPC error envelope -> throws DevicesShellyNgException', async () => {
		mockFetch.mockResolvedValueOnce(okJson({ error: { code: 500, message: 'boom' } }));

		const err = await svc.getDeviceInfo('host').catch((e) => e as Error);

		expect(err).toBeInstanceOf(DevicesShellyNgException);
		expect((err as Error).message).toMatch(/Shelly RPC 500: boom/);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	test('Missing result in envelope -> throws DevicesShellyNgException', async () => {
		mockFetch.mockResolvedValueOnce(okJson({})); // no result & no error

		const err = await svc.getDeviceInfo('host').catch((e) => e as Error);

		expect(err).toBeInstanceOf(DevicesShellyNgException);
		expect((err as Error).message).toMatch(/Shelly RPC: missing result/);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	test('Timeout maps to DevicesShellyNgException with message', async () => {
		jest.useFakeTimers();

		// Simulate AbortError thrown by fetch due to AbortController
		const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });

		mockFetch.mockImplementationOnce(() => Promise.reject(abortErr));

		const err = await svc.call('host', 'Shelly.GetDeviceInfo', undefined, { timeoutSec: 1 }).catch((e: Error) => e);

		expect(err).toBeInstanceOf(DevicesShellyNgException);
		expect((err as Error).message).toMatch(/timeout after 1s/);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	test('getComponents: paginates until all components are fetched', async () => {
		// 3 pages: offsets 0,1,2 with total=3
		mockFetch
			.mockResolvedValueOnce(
				okJson({
					result: {
						components: [{ key: 'a', config: {}, status: {} }],
						cfg_rev: 1,
						offset: 0,
						total: 3,
					},
				}),
			)
			.mockResolvedValueOnce(
				okJson({
					result: {
						components: [{ key: 'b', config: {}, status: {} }],
						cfg_rev: 1,
						offset: 1,
						total: 3,
					},
				}),
			)
			.mockResolvedValueOnce(
				okJson({
					result: {
						components: [{ key: 'c', config: {}, status: {} }],
						cfg_rev: 1,
						offset: 2,
						total: 3,
					},
				}),
			);

		const out = await svc.getComponents('host');

		expect(out.map((c) => c.key)).toEqual(['a', 'b', 'c']);
		expect(mockFetch).toHaveBeenCalledTimes(3);
	});
});
