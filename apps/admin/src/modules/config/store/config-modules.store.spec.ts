import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { IModule } from '../../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_MODULE_TYPE } from '../config.constants';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';
import type { IModulesComponents, IModulesSchemas } from '../config.types';

import { useConfigModule } from './config-modules.store';
import { ConfigModuleSchema, ConfigModuleUpdateReqSchema } from './config-modules.store.schemas';
import type { IConfigModule, IConfigModulesEditActionPayload, IConfigModulesSetActionPayload } from './config-modules.store.types';

const CustomModuleConfigSchema = ConfigModuleSchema.extend({
	mockValue: z.string(),
});

type ICustomModuleConfig = z.infer<typeof CustomModuleConfigSchema>;

const CustomModuleConfigUpdateReqSchema = ConfigModuleUpdateReqSchema.and(
	z.object({
		mock_value: z.string(),
	})
);

const mockModuleRes = {
	type: 'custom-module',
	enabled: true,
	mockValue: 'default value',
};

const mockModule = {
	type: 'custom-module',
	enabled: true,
	mockValue: 'default value',
};

const backendClient = {
	GET: vi.fn(),
	PATCH: vi.fn(),
};

const mockGetModules = vi.fn().mockReturnValue([
	{
		type: 'custom-module',
		modules: [CONFIG_MODULE_NAME],
		elements: [
			{
				type: CONFIG_MODULE_MODULE_TYPE,
				schemas: {
					moduleConfigSchema: CustomModuleConfigSchema,
					moduleConfigUpdateReqSchema: CustomModuleConfigUpdateReqSchema,
				},
			},
		],
	} as unknown as IModule<IModulesComponents, IModulesSchemas>,
]);

vi.mock('../composables/useModules', () => ({
	useModules: () => ({
		getElement: (type: string) => {
			const module = mockGetModules().find((m: IModule) => m.type === type);
			return module?.elements?.find((e: { type: string }) => e.type === CONFIG_MODULE_MODULE_TYPE);
		},
	}),
}));

const mockLoggerError = vi.fn();

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: vi.fn(() => ({
			client: backendClient,
		})),
		useLogger: vi.fn(() => ({
			error: mockLoggerError,
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: vi.fn(() => 'Some error'),
	};
});

describe('ConfigModule Store', () => {
	let store: ReturnType<typeof useConfigModule>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useConfigModule();

		vi.clearAllMocks();
		mockLoggerError.mockClear();
	});

	it('should set config Module data successfully', () => {
		const result = store.set({ data: mockModule });

		expect(result).toEqual(mockModule);
		expect(store.data).toEqual({ [mockModule.type]: mockModule });
	});

	it('should throw validation error if set config Module with invalid data', () => {
		expect(() => store.set({ data: { ...mockModule, mockValue: 0 } } as unknown as IConfigModulesSetActionPayload)).toThrow(
			ConfigValidationException
		);
	});

	it('should fetch config Module successfully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockModuleRes },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.get({ type: 'custom-module' });

		expect(result).toEqual(mockModule);

		const moduleConfig = store.data[mockModule.type] as ICustomModuleConfig;

		expect(moduleConfig).toEqual(mockModule);
	});

	it('should throw error if fetch fails', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Network error'),
			response: { status: 500 },
		});

		await expect(store.get({ type: 'custom-module' })).rejects.toThrow(ConfigApiException);
	});

	it('should update config Module successfully', async () => {
		store.data = { [mockModule.type]: { ...mockModule } };

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: { data: { ...mockModuleRes, mockValue: 'Updated value' } },
			error: undefined,
			response: { status: 200 },
		});

		const result = (await store.edit({
			data: { ...mockModule, mockValue: 'Updated value' },
		} as IConfigModulesEditActionPayload)) as ICustomModuleConfig;

		expect(result.mockValue).toBe('Updated value');

		const moduleConfig = store.data[mockModule.type] as ICustomModuleConfig;

		expect(moduleConfig.mockValue).toBe('Updated value');
	});

	it('should throw validation error if edit payload is invalid', async () => {
		store.data = { [mockModule.type]: mockModule };

		await expect(
			store.edit({
				data: { ...mockModule, mockValue: 100 },
			} as unknown as IConfigModulesEditActionPayload)
		).rejects.toThrow(ConfigValidationException);
	});

	it('should throw validation error if local data + edit is invalid', async () => {
		store.data = { [mockModule.type]: { ...mockModule, mockValue: 'Updated value' } as IConfigModule };

		await expect(
			store.edit({
				data: { ...mockModule, mockValue: 100 },
			} as unknown as IConfigModulesEditActionPayload)
		).rejects.toThrow(ConfigValidationException);
	});

	it('should refresh data and throw if API update fails', async () => {
		store.data = { [mockModule.type]: { ...mockModule } };

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Patch error'),
			response: { status: 500 },
		});

		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockModuleRes },
			error: undefined,
			response: { status: 200 },
		});

		await expect(store.edit({ data: { ...mockModule, mockValue: 'Updated value' } } as IConfigModulesEditActionPayload)).rejects.toThrow(
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

		store.data = { [mockModule.type]: { ...mockModule } };

		(backendClient.GET as Mock).mockReturnValueOnce(inFlightRequest).mockResolvedValueOnce({
			data: { data: { ...mockModuleRes, mockValue: 'server value' } },
			error: undefined,
			response: { status: 200 },
		});

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Patch error'),
			response: { status: 500 },
		});

		// Issued before the edit, so its answer describes the configuration from before it.
		const pendingGet = store.get({ type: 'custom-module' });

		const failedEdit = store.edit({ data: { ...mockModule, mockValue: 'optimistic value' } } as IConfigModulesEditActionPayload);

		resolveInFlight({ data: { data: mockModuleRes }, error: undefined, response: { status: 200 } });

		await expect(failedEdit).rejects.toThrow(ConfigApiException);
		await pendingGet;

		expect((store.data[mockModule.type] as ICustomModuleConfig).mockValue).toBe('server value');
	});

	// A read issued while an edit is in flight cannot be trusted to include it: the server may not
	// have committed the write when it answered. So for as long as the write is outstanding the
	// entry is held, and a refresh landing inside that window is dropped rather than applied.
	it('keeps a pending edit when a refresh is answered before the edit is', async () => {
		let resolvePatch!: (value: unknown) => void;

		const patchRequest = new Promise((resolve) => {
			resolvePatch = resolve;
		});

		store.data = { [mockModule.type]: { ...mockModule } };

		(backendClient.PATCH as Mock).mockReturnValueOnce(patchRequest);

		(backendClient.GET as Mock)
			// What the server still holds, because it has not committed the edit yet.
			.mockResolvedValueOnce({
				data: { data: mockModuleRes },
				error: undefined,
				response: { status: 200 },
			})
			// And what it holds once it has - the read the store asks for after the write settles.
			.mockResolvedValueOnce({
				data: { data: { ...mockModuleRes, mockValue: 'my value' } },
				error: undefined,
				response: { status: 200 },
			});

		const pendingEdit = store.edit({ data: { ...mockModule, mockValue: 'my value' } } as IConfigModulesEditActionPayload);

		await store.get({ type: 'custom-module', force: true });

		expect((store.data[mockModule.type] as ICustomModuleConfig).mockValue).toBe('my value');

		resolvePatch({
			data: { data: { ...mockModuleRes, mockValue: 'my value' } },
			error: undefined,
			response: { status: 200 },
		});

		await pendingEdit;

		await vi.waitFor(() => expect(backendClient.GET).toHaveBeenCalledTimes(2));

		expect((store.data[mockModule.type] as ICustomModuleConfig).mockValue).toBe('my value');
	});

	// The same window seen from the other end: a read issued while the write was outstanding is
	// dropped whenever it lands, not only when it lands first. Its snapshot may have been taken
	// either side of the write and nothing here can tell which, so the entry keeps the confirmed
	// edit - reverting one of those is the worse of the two mistakes.
	it('drops a refresh issued during an edit even when it lands after the edit', async () => {
		let resolvePatch!: (value: unknown) => void;
		let resolveGet!: (value: unknown) => void;

		const patchRequest = new Promise((resolve) => {
			resolvePatch = resolve;
		});

		const getRequest = new Promise((resolve) => {
			resolveGet = resolve;
		});

		store.data = { [mockModule.type]: { ...mockModule } };

		(backendClient.PATCH as Mock).mockReturnValueOnce(patchRequest);

		(backendClient.GET as Mock).mockReturnValueOnce(getRequest).mockResolvedValueOnce({
			data: { data: { ...mockModuleRes, mockValue: 'my value' } },
			error: undefined,
			response: { status: 200 },
		});

		const pendingEdit = store.edit({ data: { ...mockModule, mockValue: 'my value' } } as IConfigModulesEditActionPayload);

		// Issued while the PATCH is still outstanding.
		const pendingGet = store.get({ type: 'custom-module', force: true });

		resolvePatch({
			data: { data: { ...mockModuleRes, mockValue: 'my value' } },
			error: undefined,
			response: { status: 200 },
		});

		await pendingEdit;

		// And answered only afterwards, with what the server held before the edit was committed.
		resolveGet({ data: { data: mockModuleRes }, error: undefined, response: { status: 200 } });

		await pendingGet;

		// Dropped, and asked again now that the write is done.
		await vi.waitFor(() => expect(backendClient.GET).toHaveBeenCalledTimes(2));

		expect((store.data[mockModule.type] as ICustomModuleConfig).mockValue).toBe('my value');
	});

	// Dropping an overlapping read loses whatever prompted it. A change event is the backend saying
	// something changed without saying whose change it was, so a refresh reacting to one may be
	// carrying another client's edit - and silently discarding it would leave that lost until
	// something else happened to refresh. It is asked again once the write is out of the way.
	it('asks again after the edit when a change-driven refresh had to be dropped', async () => {
		let resolvePatch!: (value: unknown) => void;

		const patchRequest = new Promise((resolve) => {
			resolvePatch = resolve;
		});

		store.data = { [mockModule.type]: { ...mockModule } };

		(backendClient.PATCH as Mock).mockReturnValueOnce(patchRequest);

		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: { ...mockModuleRes, mockValue: 'someone else' } },
			error: undefined,
			response: { status: 200 },
		});

		const pendingEdit = store.edit({ data: { ...mockModule, mockValue: 'my value' } } as IConfigModulesEditActionPayload);

		// The change event's refresh, issued and answered while the PATCH is still outstanding.
		await store.get({ type: 'custom-module', force: true });

		// Dropped, because nothing here can tell it apart from a read taken before the edit landed.
		expect((store.data[mockModule.type] as ICustomModuleConfig).mockValue).toBe('my value');

		resolvePatch({
			data: { data: { ...mockModuleRes, mockValue: 'my value' } },
			error: undefined,
			response: { status: 200 },
		});

		await pendingEdit;

		// Asked again now that the write is done, and this time the answer stands.
		await vi.waitFor(() => expect((store.data[mockModule.type] as ICustomModuleConfig).mockValue).toBe('someone else'));

		expect(backendClient.GET).toHaveBeenCalledTimes(2);
	});

	// A reconnect refresh goes through `fetch()`, and it is exactly where another client's change
	// is most likely to be waiting. Skipping an overlapped entry without asking again would leave
	// that change sitting on the server until something else happened to look.
	it('asks again for an entry a list refresh had to skip', async () => {
		let resolvePatch!: (value: unknown) => void;

		const patchRequest = new Promise((resolve) => {
			resolvePatch = resolve;
		});

		store.data = { [mockModule.type]: { ...mockModule } };

		(backendClient.PATCH as Mock).mockReturnValueOnce(patchRequest);

		(backendClient.GET as Mock)
			// The reconnect refresh, answered while the edit is still outstanding.
			.mockResolvedValueOnce({
				data: { data: [mockModuleRes] },
				error: undefined,
				response: { status: 200 },
			})
			// The read that follows once the write is done.
			.mockResolvedValueOnce({
				data: { data: { ...mockModuleRes, mockValue: 'someone else' } },
				error: undefined,
				response: { status: 200 },
			});

		const pendingEdit = store.edit({ data: { ...mockModule, mockValue: 'my value' } } as IConfigModulesEditActionPayload);

		await store.fetch();

		// Skipped, because the answer cannot be told apart from one taken before the edit landed.
		expect((store.data[mockModule.type] as ICustomModuleConfig).mockValue).toBe('my value');

		resolvePatch({
			data: { data: { ...mockModuleRes, mockValue: 'my value' } },
			error: undefined,
			response: { status: 200 },
		});

		await pendingEdit;

		await vi.waitFor(() => expect((store.data[mockModule.type] as ICustomModuleConfig).mockValue).toBe('someone else'));
	});

	// That deferred read is the only attempt left that can bring in whatever the dropped one was
	// carrying, and the event handler that started it has long since resolved. A failure there has
	// nowhere else to surface, so it must not be swallowed.
	it('reports a deferred refresh that fails rather than losing it silently', async () => {
		let resolvePatch!: (value: unknown) => void;

		const patchRequest = new Promise((resolve) => {
			resolvePatch = resolve;
		});

		store.data = { [mockModule.type]: { ...mockModule } };

		(backendClient.PATCH as Mock).mockReturnValueOnce(patchRequest);

		(backendClient.GET as Mock)
			.mockResolvedValueOnce({
				data: { data: mockModuleRes },
				error: undefined,
				response: { status: 200 },
			})
			// The deferred read, which the backend refuses.
			.mockResolvedValueOnce({
				data: undefined,
				error: new Error('Read error'),
				response: { status: 500 },
			});

		const pendingEdit = store.edit({ data: { ...mockModule, mockValue: 'my value' } } as IConfigModulesEditActionPayload);

		await store.get({ type: 'custom-module', force: true });

		resolvePatch({
			data: { data: { ...mockModuleRes, mockValue: 'my value' } },
			error: undefined,
			response: { status: 200 },
		});

		await pendingEdit;

		await vi.waitFor(() => expect(mockLoggerError).toHaveBeenCalledWith(expect.stringContaining('re-read'), expect.anything()));

		// The entry keeps this client's confirmed value rather than being left in some other state.
		expect((store.data[mockModule.type] as ICustomModuleConfig).mockValue).toBe('my value');
	});

	// The hold is not permanent. Once the edit's answer is in hand the entry is released, and a
	// refresh issued after that overlaps nothing and is the newer story again.
	it('applies a refresh issued once the edit has settled', async () => {
		store.data = { [mockModule.type]: { ...mockModule } };

		(backendClient.PATCH as Mock).mockResolvedValueOnce({
			data: { data: { ...mockModuleRes, mockValue: 'my value' } },
			error: undefined,
			response: { status: 200 },
		});

		(backendClient.GET as Mock).mockResolvedValueOnce({
			data: { data: { ...mockModuleRes, mockValue: 'someone else' } },
			error: undefined,
			response: { status: 200 },
		});

		await store.edit({ data: { ...mockModule, mockValue: 'my value' } } as IConfigModulesEditActionPayload);

		await store.get({ type: 'custom-module', force: true });

		expect((store.data[mockModule.type] as ICustomModuleConfig).mockValue).toBe('someone else');
	});

	it('should fetch all modules successfully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: [mockModuleRes] },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.fetch();

		expect(result).toEqual([mockModule]);
		expect(store.data).toEqual({ [mockModule.type]: mockModule });
		expect(store.firstLoadFinished()).toBe(true);
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
			data: { data: { ...mockModuleRes, mockValue: 'fresh value' } },
			error: undefined,
			response: { status: 200 },
		});

		const pendingFetch = store.fetch();

		// The change-driven refresh lands before the response the server assembled ahead of it.
		await store.get({ type: 'custom-module' });

		resolveFetch({ data: { data: [mockModuleRes] } });
		await pendingFetch;

		expect((store.data[mockModule.type] as ICustomModuleConfig).mockValue).toBe('fresh value');
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

		store.data = { [mockModule.type]: { ...mockModule } };

		const pendingFetch = store.fetch();

		resolveFetch({ data: { data: [{ ...mockModuleRes, mockValue: 'server value' }] } });
		await pendingFetch;

		expect((store.data[mockModule.type] as ICustomModuleConfig).mockValue).toBe('server value');
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
			data: { data: { ...mockModuleRes, mockValue: 'forced value' } },
			error: undefined,
			response: { status: 200 },
		});

		const firstGet = store.get({ type: 'custom-module' });
		const forcedGet = store.get({ type: 'custom-module', force: true });

		resolveFirst({ data: { data: mockModuleRes } });

		const [firstResult, forcedResult] = await Promise.all([firstGet, forcedGet]);

		expect(backendClient.GET).toHaveBeenCalledTimes(2);
		expect(firstResult).toEqual(mockModule);
		expect((forcedResult as ICustomModuleConfig).mockValue).toBe('forced value');
		expect((store.data[mockModule.type] as ICustomModuleConfig).mockValue).toBe('forced value');
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

		const pendingGet = store.get({ type: 'custom-module' });
		const pendingFetch = store.fetch();

		// The earlier request is answered first, and with what the server held before the change.
		resolveGet({ data: { data: { ...mockModuleRes, mockValue: 'stale value' } } });
		await pendingGet;

		resolveFetch({ data: { data: [{ ...mockModuleRes, mockValue: 'current value' }] } });
		await pendingFetch;

		expect((store.data[mockModule.type] as ICustomModuleConfig).mockValue).toBe('current value');
	});

	// A list response asserts the whole set as of the moment it was asked, so an entry it leaves
	// out is gone. Tombstoning only what is held at that moment is not enough: a `get()` for a type
	// that is currently absent carries no number of its own, so nothing would stop its late answer
	// from reinstating an entry the newer list says no longer exists.
	it('does not let an older read reinstate an entry a newer fetch left out', async () => {
		let resolveGet!: (value: unknown) => void;

		const getRequest = new Promise((resolve) => {
			resolveGet = resolve;
		});

		store.data = {};

		(backendClient.GET as Mock).mockReturnValueOnce(getRequest).mockResolvedValueOnce({
			data: { data: [] },
			error: undefined,
			response: { status: 200 },
		});

		const pendingGet = store.get({ type: 'custom-module' });
		const pendingFetch = store.fetch();

		await pendingFetch;

		resolveGet({ data: { data: mockModuleRes }, error: undefined, response: { status: 200 } });
		await pendingGet;

		expect(store.data[mockModule.type]).toBeUndefined();
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
				data: { data: { ...mockModuleRes, mockValue: 'first refresh' } },
				error: undefined,
				response: { status: 200 },
			})
			.mockResolvedValueOnce({
				data: { data: { ...mockModuleRes, mockValue: 'second refresh' } },
				error: undefined,
				response: { status: 200 },
			});

		const firstGet = store.get({ type: 'custom-module' });
		const forcedFirst = store.get({ type: 'custom-module', force: true });
		const forcedSecond = store.get({ type: 'custom-module', force: true });

		resolveFirst({ data: { data: mockModuleRes } });

		const [, firstRefresh, secondRefresh] = await Promise.all([firstGet, forcedFirst, forcedSecond]);

		expect(backendClient.GET).toHaveBeenCalledTimes(3);
		expect((firstRefresh as ICustomModuleConfig).mockValue).toBe('first refresh');
		expect((secondRefresh as ICustomModuleConfig).mockValue).toBe('second refresh');
		expect((store.data[mockModule.type] as ICustomModuleConfig).mockValue).toBe('second refresh');
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

		const firstGet = store.get({ type: 'custom-module' });
		const forcedGet = store.get({ type: 'custom-module', force: true });

		resolveFirst({ data: { data: mockModuleRes } });
		await firstGet;

		// Wait for the forced successor to take over and issue its own request.
		await vi.waitFor(() => expect(backendClient.GET).toHaveBeenCalledTimes(2));

		// Arrives while that refresh is in flight, so it should be handed the same request.
		const joinedGet = store.get({ type: 'custom-module' });

		resolveForced({ data: { data: { ...mockModuleRes, mockValue: 'forced value' } } });

		const [forcedResult, joinedResult] = await Promise.all([forcedGet, joinedGet]);

		expect(backendClient.GET).toHaveBeenCalledTimes(2);
		expect((forcedResult as ICustomModuleConfig).mockValue).toBe('forced value');
		expect((joinedResult as ICustomModuleConfig).mockValue).toBe('forced value');
	});

	it('should handle onEvent and update module config', () => {
		const eventPayload = {
			type: 'custom-module',
			data: mockModuleRes,
		};

		const result = store.onEvent(eventPayload);

		expect(result).toEqual(mockModule);
		expect(store.data[mockModule.type]).toEqual(mockModule);
	});

	it('should find module by type', () => {
		store.data = { [mockModule.type]: mockModule };

		const found = store.findByType('custom-module');
		expect(found).toEqual(mockModule);

		const notFound = store.findByType('non-existent');
		expect(notFound).toBeNull();
	});

	it('should find all modules', () => {
		const module2 = { type: 'module-2', enabled: false };
		store.data = { [mockModule.type]: mockModule, [module2.type]: module2 };

		const all = store.findAll();
		expect(all).toHaveLength(2);
		expect(all).toContainEqual(mockModule);
		expect(all).toContainEqual(module2);
	});

	it('should track getting state', async () => {
		expect(store.getting('custom-module')).toBe(false);

		// Setup mock response
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockModuleRes },
			error: undefined,
			response: { status: 200 },
		});

		// Trigger a get operation which will set the getting state
		const getPromise = store.get({ type: 'custom-module' });
		expect(store.getting('custom-module')).toBe(true);

		// Wait for the operation to complete
		await getPromise;
		expect(store.getting('custom-module')).toBe(false);
	});

	it('should track fetching state', async () => {
		expect(store.fetching()).toBe(false);

		// Setup mock response for fetch
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: [mockModuleRes] },
			error: undefined,
			response: { status: 200 },
		});

		// Trigger a fetch operation which will set the fetching state
		const fetchPromise = store.fetch();
		expect(store.fetching()).toBe(true);

		// Wait for the operation to complete
		await fetchPromise;
		expect(store.fetching()).toBe(false);
	});

	it('should track updating state', async () => {
		store.data = { [mockModule.type]: { ...mockModule } };
		expect(store.updating('custom-module')).toBe(false);

		// Trigger an edit operation which will set the updating state
		(backendClient.PATCH as Mock).mockResolvedValue({
			data: { data: mockModuleRes },
			error: undefined,
			response: { status: 200 },
		});

		const editPromise = store.edit({ data: { ...mockModule, mockValue: 'Updated value' } } as IConfigModulesEditActionPayload);
		expect(store.updating('custom-module')).toBe(true);

		// Wait for the operation to complete
		await editPromise;
		expect(store.updating('custom-module')).toBe(false);
	});
});

