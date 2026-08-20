import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { IPlugin } from '../../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE } from '../config.constants';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';
import type { IPluginsComponents, IPluginsSchemas } from '../config.types';

import { useConfigPlugin } from './config-plugins.store';
import { ConfigPluginSchema, ConfigPluginUpdateReqSchema } from './config-plugins.store.schemas';
import type { IConfigPlugin, IConfigPluginsEditActionPayload, IConfigPluginsSetActionPayload } from './config-plugins.store.types';

const CustomPluginConfigSchema = ConfigPluginSchema.extend({
	mockValue: z.string(),
});

type ICustomPluginConfig = z.infer<typeof CustomPluginConfigSchema>;

const CustomPluginConfigUpdateReqSchema = ConfigPluginUpdateReqSchema.and(
	z.object({
		mock_value: z.string(),
	})
);

const mockPluginRes = {
	type: 'custom-plugin',
	enabled: true,
	mockValue: 'default value',
};

const mockPlugin = {
	type: 'custom-plugin',
	enabled: true,
	mockValue: 'default value',
};

const backendClient = {
	GET: vi.fn(),
	PATCH: vi.fn(),
};

const mockGetPlugins = vi.fn().mockReturnValue([
	{
		type: 'custom-plugin',
		modules: [CONFIG_MODULE_NAME],
		elements: [
			{
				type: CONFIG_MODULE_PLUGIN_TYPE,
				schemas: {
					pluginConfigSchema: CustomPluginConfigSchema,
					pluginConfigUpdateReqSchema: CustomPluginConfigUpdateReqSchema,
				},
			},
		],
	} as unknown as IPlugin<IPluginsComponents, IPluginsSchemas>,
]);

vi.mock('../../../common', async () => {
	const utils = await vi.importActual('../../../common/utils/utils');
	const composables = await vi.importActual('../../../common/composables/composables');
	const services = await vi.importActual('../../../common/services/services');
	const store = await vi.importActual('../../../common/store/stores');
	const constants = await vi.importActual('../../../common/common.constants');

	return {
		...utils,
		...composables,
		...services,
		...store,
		...constants,
		useBackend: vi.fn(() => ({
			client: backendClient,
		})),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: vi.fn(() => 'Some error'),
		injectPluginsManager: vi.fn(() => ({
			getPlugins: mockGetPlugins,
		})),
	};
});

describe('ConfigPlugin Store', () => {
	let store: ReturnType<typeof useConfigPlugin>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useConfigPlugin();

		vi.clearAllMocks();
	});

	it('should set config Plugin data successfully', () => {
		const result = store.set({ data: mockPlugin });

		expect(result).toEqual(mockPlugin);
		expect(store.data).toEqual({ [mockPlugin.type]: mockPlugin });
	});

	it('should throw validation error if set config Plugin with invalid data', () => {
		expect(() => store.set({ data: { ...mockPlugin, mockValue: 0 } } as unknown as IConfigPluginsSetActionPayload)).toThrow(
			ConfigValidationException
		);
	});

	it('should fetch config Plugin successfully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockPluginRes },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.get({ type: 'custom-plugin' });

		expect(result).toEqual(mockPlugin);

		const pluginConfig = store.data[mockPlugin.type] as ICustomPluginConfig;

		expect(pluginConfig).toEqual(mockPlugin);
	});

	it('should throw error if fetch fails', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Network error'),
			response: { status: 500 },
		});

		await expect(store.get({ type: 'custom-plugin' })).rejects.toThrow(ConfigApiException);
	});

	// The race the sequence exists to prevent: a change event fires a `get()` for the
	// changed type while an already-in-flight `fetch()` is still reading the pre-change configuration.
	// Without the ordering, `fetch()`'s wholesale replace lands after `get()` and wipes it out with
	// the older snapshot, so the admin stays stale until something else happens to refresh it.
	it('keeps an entry refreshed by get() while fetch() is in flight, rather than restoring the snapshot it answers with', async () => {
		let resolveFetch!: (value: unknown) => void;

		const fetchRequest = new Promise((resolve) => {
			resolveFetch = resolve;
		});

		(backendClient.GET as Mock).mockReturnValueOnce(fetchRequest).mockResolvedValueOnce({
			data: { data: { ...mockPluginRes, mockValue: 'fresh value' } },
			error: undefined,
			response: { status: 200 },
		});

		const pendingFetch = store.fetch();

		// The change-driven refresh lands before the response the server assembled ahead of it.
		await store.get({ type: 'custom-plugin' });

		resolveFetch({ data: { data: [mockPluginRes] } });
		await pendingFetch;

		expect((store.data[mockPlugin.type] as ICustomPluginConfig).mockValue).toBe('fresh value');
	});

	// The other half of the same rule: an entry the response *does* carry, and that nothing has
	// touched since the request went out, is still applied — otherwise this guard would freeze the
	// store rather than merely protecting entries genuinely written since the request was made.
	it('applies an entry the fetch response carries when nothing has written it since the request went out', async () => {
		let resolveFetch!: (value: unknown) => void;

		const fetchRequest = new Promise((resolve) => {
			resolveFetch = resolve;
		});

		(backendClient.GET as Mock).mockReturnValueOnce(fetchRequest);

		store.data = { [mockPlugin.type]: { ...mockPlugin } };

		const pendingFetch = store.fetch();

		resolveFetch({ data: { data: [{ ...mockPluginRes, mockValue: 'server value' }] } });
		await pendingFetch;

		expect((store.data[mockPlugin.type] as ICustomPluginConfig).mockValue).toBe('server value');
	});

	// The other race: a change event calling `get({ force: true })` while an earlier `get()` for the
	// same type is still in flight must not just hand back that older request's answer. It should wait
	// for it to settle, then issue a genuinely new request.
	it('issues a new request for a forced get() instead of reusing an in-flight one', async () => {
		let resolveFirst!: (value: unknown) => void;

		const firstRequest = new Promise((resolve) => {
			resolveFirst = resolve;
		});

		(backendClient.GET as Mock).mockReturnValueOnce(firstRequest).mockResolvedValueOnce({
			data: { data: { ...mockPluginRes, mockValue: 'forced value' } },
			error: undefined,
			response: { status: 200 },
		});

		const firstGet = store.get({ type: 'custom-plugin' });
		const forcedGet = store.get({ type: 'custom-plugin', force: true });

		resolveFirst({ data: { data: mockPluginRes } });

		const [firstResult, forcedResult] = await Promise.all([firstGet, forcedGet]);

		expect(backendClient.GET).toHaveBeenCalledTimes(2);
		expect(firstResult).toEqual(mockPlugin);
		expect((forcedResult as ICustomPluginConfig).mockValue).toBe('forced value');
		expect((store.data[mockPlugin.type] as ICustomPluginConfig).mockValue).toBe('forced value');
	});

	// Ordering by when a response lands is not the same as ordering by when it was asked for, and
	// only the second is meaningful: a read describes the moment its request went out. An entry
	// `get()` issued before this `fetch()` and answered during it is the older story of the two, so
	// the list response — asked for later — is the one worth keeping.
	it('applies the fetch response over an entry read that was issued before it', async () => {
		let resolveGet!: (value: unknown) => void;
		let resolveFetch!: (value: unknown) => void;

		const getRequest = new Promise((resolve) => {
			resolveGet = resolve;
		});

		const fetchRequest = new Promise((resolve) => {
			resolveFetch = resolve;
		});

		(backendClient.GET as Mock).mockReturnValueOnce(getRequest).mockReturnValueOnce(fetchRequest);

		const pendingGet = store.get({ type: 'custom-plugin' });
		const pendingFetch = store.fetch();

		// The earlier request is answered first, and with what the server held before the change.
		resolveGet({ data: { data: { ...mockPluginRes, mockValue: 'stale value' } } });
		await pendingGet;

		resolveFetch({ data: { data: [{ ...mockPluginRes, mockValue: 'current value' }] } });
		await pendingFetch;

		expect((store.data[mockPlugin.type] as ICustomPluginConfig).mockValue).toBe('current value');
	});

	// Two change events for the same type can land together. Both forced refreshes then wait on the
	// one request already in flight and both resume, so unless they are queued the second finds the
	// semaphore still held by the first and is rejected out of hand.
	it('serializes forced refreshes that arrive together instead of rejecting the second', async () => {
		let resolveFirst!: (value: unknown) => void;

		const firstRequest = new Promise((resolve) => {
			resolveFirst = resolve;
		});

		(backendClient.GET as Mock)
			.mockReturnValueOnce(firstRequest)
			.mockResolvedValueOnce({
				data: { data: { ...mockPluginRes, mockValue: 'first refresh' } },
				error: undefined,
				response: { status: 200 },
			})
			.mockResolvedValueOnce({
				data: { data: { ...mockPluginRes, mockValue: 'second refresh' } },
				error: undefined,
				response: { status: 200 },
			});

		const firstGet = store.get({ type: 'custom-plugin' });
		const forcedFirst = store.get({ type: 'custom-plugin', force: true });
		const forcedSecond = store.get({ type: 'custom-plugin', force: true });

		resolveFirst({ data: { data: mockPluginRes } });

		const [, firstRefresh, secondRefresh] = await Promise.all([firstGet, forcedFirst, forcedSecond]);

		expect(backendClient.GET).toHaveBeenCalledTimes(3);
		expect((firstRefresh as ICustomPluginConfig).mockValue).toBe('first refresh');
		expect((secondRefresh as ICustomPluginConfig).mockValue).toBe('second refresh');
		expect((store.data[mockPlugin.type] as ICustomPluginConfig).mockValue).toBe('second refresh');
	});

	// The registration a call retires has to be its own. A forced refresh registers itself in place
	// of the read it is waiting on, so that earlier read finishing would otherwise delete the
	// successor's entry — and the next caller, finding nothing registered, starts a competing
	// request that collides with the one still in flight.
	it('leaves a forced successor registered once the read it waited on finishes', async () => {
		let resolveFirst!: (value: unknown) => void;
		let resolveForced!: (value: unknown) => void;

		const firstRequest = new Promise((resolve) => {
			resolveFirst = resolve;
		});

		const forcedRequest = new Promise((resolve) => {
			resolveForced = resolve;
		});

		(backendClient.GET as Mock).mockReturnValueOnce(firstRequest).mockReturnValueOnce(forcedRequest);

		const firstGet = store.get({ type: 'custom-plugin' });
		const forcedGet = store.get({ type: 'custom-plugin', force: true });

		resolveFirst({ data: { data: mockPluginRes } });
		await firstGet;

		// Wait for the forced successor to take over and issue its own request.
		await vi.waitFor(() => expect(backendClient.GET).toHaveBeenCalledTimes(2));

		// Arrives while that refresh is in flight, so it should be handed the same request.
		const joinedGet = store.get({ type: 'custom-plugin' });

		resolveForced({ data: { data: { ...mockPluginRes, mockValue: 'forced value' } } });

		const [forcedResult, joinedResult] = await Promise.all([forcedGet, joinedGet]);

		expect(backendClient.GET).toHaveBeenCalledTimes(2);
		expect((forcedResult as ICustomPluginConfig).mockValue).toBe('forced value');
		expect((joinedResult as ICustomPluginConfig).mockValue).toBe('forced value');
	});

	it('should update config Plugin successfully', async () => {
		store.data = { [mockPlugin.type]: { ...mockPlugin } };

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: { data: { ...mockPluginRes, mockValue: 'Updated value' } },
			error: undefined,
			response: { status: 200 },
		});

		const result = (await store.edit({
			data: { ...mockPlugin, mockValue: 'Updated value' },
		} as IConfigPluginsEditActionPayload)) as ICustomPluginConfig;

		expect(result.mockValue).toBe('Updated value');

		const pluginConfig = store.data[mockPlugin.type] as ICustomPluginConfig;

		expect(pluginConfig.mockValue).toBe('Updated value');
	});

	it('should throw validation error if edit payload is invalid', async () => {
		store.data = { [mockPlugin.type]: mockPlugin };

		await expect(
			store.edit({
				data: { ...mockPlugin, mockValue: 100 },
			} as unknown as IConfigPluginsEditActionPayload)
		).rejects.toThrow(ConfigValidationException);
	});

	it('should throw validation error if local data + edit is invalid', async () => {
		store.data = { [mockPlugin.type]: { ...mockPlugin, mockValue: 'Updated value' } as IConfigPlugin };

		await expect(
			store.edit({
				data: { ...mockPlugin, mockValue: 100 },
			} as unknown as IConfigPluginsEditActionPayload)
		).rejects.toThrow(ConfigValidationException);
	});

	it('should refresh data and throw if API update fails', async () => {
		store.data = { [mockPlugin.type]: { ...mockPlugin } };

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Patch error'),
			response: { status: 500 },
		});

		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockPluginRes },
			error: undefined,
			response: { status: 200 },
		});

		await expect(store.edit({ data: { ...mockPlugin, mockValue: 'Updated value' } } as IConfigPluginsEditActionPayload)).rejects.toThrow(
			ConfigApiException
		);
	});

	// The rollback after a failed edit has to undo the optimistic write, and the optimistic write
	// is newer than any request already in flight. A plain read would be allowed to join one of
	// those, and its answer - correctly judged older - would be dropped, leaving the value the
	// failed edit put there sitting in the store while `edit()` reports failure.
	it('rolls back a failed edit even while an older read is in flight', async () => {
		let resolveInFlight!: (value: unknown) => void;

		const inFlightRequest = new Promise((resolve) => {
			resolveInFlight = resolve;
		});

		store.data = { [mockPlugin.type]: { ...mockPlugin } };

		(backendClient.GET as Mock).mockReturnValueOnce(inFlightRequest).mockResolvedValueOnce({
			data: { data: { ...mockPluginRes, mockValue: 'server value' } },
			error: undefined,
			response: { status: 200 },
		});

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Patch error'),
			response: { status: 500 },
		});

		// Issued before the edit, so its answer describes the configuration from before it.
		const pendingGet = store.get({ type: 'custom-plugin' });

		const failedEdit = store.edit({ data: { ...mockPlugin, mockValue: 'optimistic value' } } as IConfigPluginsEditActionPayload);

		resolveInFlight({ data: { data: mockPluginRes }, error: undefined, response: { status: 200 } });

		await expect(failedEdit).rejects.toThrow(ConfigApiException);
		await pendingGet;

		expect((store.data[mockPlugin.type] as ICustomPluginConfig).mockValue).toBe('server value');
	});

	// A successful PATCH answers with the configuration as of the moment the server was asked, so
	// in that respect it is a read like any other. A refresh issued after it - a change event
	// reacting to somebody else's edit, say - describes a later moment and must win, even when the
	// slower PATCH response lands after it.
	it('does not let a slow edit response overwrite a refresh issued after it', async () => {
		let resolvePatch!: (value: unknown) => void;

		const patchRequest = new Promise((resolve) => {
			resolvePatch = resolve;
		});

		store.data = { [mockPlugin.type]: { ...mockPlugin } };

		(backendClient.PATCH as Mock).mockReturnValueOnce(patchRequest);

		(backendClient.GET as Mock).mockResolvedValueOnce({
			data: { data: { ...mockPluginRes, mockValue: 'someone else' } },
			error: undefined,
			response: { status: 200 },
		});

		const pendingEdit = store.edit({ data: { ...mockPlugin, mockValue: 'my value' } } as IConfigPluginsEditActionPayload);

		// Issued after the PATCH went out, and answered before it comes back.
		await store.get({ type: 'custom-plugin', force: true });

		resolvePatch({
			data: { data: { ...mockPluginRes, mockValue: 'my value' } },
			error: undefined,
			response: { status: 200 },
		});

		await pendingEdit;

		expect((store.data[mockPlugin.type] as ICustomPluginConfig).mockValue).toBe('someone else');
	});
});
