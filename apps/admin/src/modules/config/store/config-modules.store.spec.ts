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

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
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
	};
});

describe('ConfigModule Store', () => {
	let store: ReturnType<typeof useConfigModule>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useConfigModule();

		vi.clearAllMocks();
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

