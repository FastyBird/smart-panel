import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemModuleLogEntryType, ConfigModuleSystemType  } from '../../../openapi.constants';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';

import { useConfigSystem } from './config-system.store';
import type { IConfigSystemEditActionPayload, IConfigSystemSetActionPayload } from './config-system.store.types';

const mockSystemRes = {
	type: ConfigModuleSystemType.system,
	log_levels: [SystemModuleLogEntryType.info, SystemModuleLogEntryType.warn],
};

const mockSystem = {
	type: ConfigModuleSystemType.system,
	logLevels: [SystemModuleLogEntryType.info, SystemModuleLogEntryType.warn],
};

const backendClient = {
	GET: vi.fn(),
	PATCH: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({
			client: backendClient,
		}),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: () => 'Some error',
	};
});

describe('ConfigSystem Store', () => {
	let store: ReturnType<typeof useConfigSystem>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useConfigSystem();

		vi.clearAllMocks();
	});

	it('should set config system data successfully', () => {
		const result = store.set({ data: mockSystem });

		expect(result).toEqual(mockSystem);
		expect(store.data).toEqual(mockSystem);
	});

	it('should throw validation error if set config system with invalid data', () => {
		expect(() => store.set({ data: { ...mockSystem, logLevels: 'invalid' } } as unknown as IConfigSystemSetActionPayload)).toThrow(
			ConfigValidationException
		);
	});

	it('should fetch config system successfully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockSystemRes },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.get();

		expect(result).toEqual(mockSystem);
		expect(store.data).toEqual(mockSystem);
	});

	it('should throw error if fetch fails', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Network error'),
			response: { status: 500 },
		});

		await expect(store.get()).rejects.toThrow(ConfigApiException);
	});

	it('should update config system successfully', async () => {
		store.data = { ...mockSystem };

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: { data: { ...mockSystemRes, log_levels: [SystemModuleLogEntryType.error] } },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.edit({
			data: { ...mockSystem, logLevels: [SystemModuleLogEntryType.error] },
		});

		expect(result.logLevels).toStrictEqual([SystemModuleLogEntryType.error]);
		expect(store.data?.logLevels).toStrictEqual([SystemModuleLogEntryType.error]);
	});

	it('should throw validation error if edit payload is invalid', async () => {
		await expect(
			store.edit({
				data: { ...mockSystem, logLevels: ['invalid_level'] },
			} as unknown as IConfigSystemEditActionPayload)
		).rejects.toThrow(ConfigValidationException);
	});

	it('should throw validation error if local data + edit is invalid', async () => {
		store.data = { ...mockSystem, logLevels: [SystemModuleLogEntryType.error] };

		await expect(
			store.edit({
				data: { ...mockSystem, logLevels: undefined },
			} as unknown as IConfigSystemEditActionPayload)
		).rejects.toThrow(ConfigValidationException);
	});

	it('should refresh data and throw if API update fails', async () => {
		store.data = { ...mockSystem };

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Patch error'),
			response: { status: 500 },
		});

		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockSystemRes },
			error: undefined,
			response: { status: 200 },
		});

		await expect(store.edit({ data: { ...mockSystem, logLevels: [SystemModuleLogEntryType.error] } })).rejects.toThrow(ConfigApiException);
	});
});
