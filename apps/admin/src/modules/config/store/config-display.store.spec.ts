import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigModuleDisplayType } from '../../../openapi';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';

import { useConfigDisplay } from './config-display.store';
import type { IConfigDisplayEditActionPayload, IConfigDisplaySetActionPayload } from './config-display.store.types';

const mockDisplayRes = {
	type: ConfigModuleDisplayType.display,
	dark_mode: true,
	brightness: 80,
	screen_lock_duration: 300,
	screen_saver: true,
};

const mockDisplay = {
	type: ConfigModuleDisplayType.display,
	darkMode: true,
	brightness: 80,
	screenLockDuration: 300,
	screenSaver: true,
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
		getErrorReason: () => 'Some error',
	};
});

describe('ConfigDisplay Store', () => {
	let store: ReturnType<typeof useConfigDisplay>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useConfigDisplay();

		vi.clearAllMocks();
	});

	it('should set config display data successfully', () => {
		const result = store.set({ data: mockDisplay });

		expect(result).toEqual(mockDisplay);
		expect(store.data).toEqual(mockDisplay);
	});

	it('should throw validation error if set config display with invalid data', () => {
		expect(() => store.set({ data: { ...mockDisplay, brightness: 'invalid' } } as unknown as IConfigDisplaySetActionPayload)).toThrow(
			ConfigValidationException
		);
	});

	it('should fetch config display successfully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockDisplayRes },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.get();

		expect(result).toEqual(mockDisplay);
		expect(store.data).toEqual(mockDisplay);
	});

	it('should throw error if fetch fails', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Network error'),
			response: { status: 500 },
		});

		await expect(store.get()).rejects.toThrow(ConfigApiException);
	});

	it('should update config display successfully', async () => {
		store.data = { ...mockDisplay };

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: { data: { ...mockDisplayRes, brightness: 50 } },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.edit({
			data: { ...mockDisplay, brightness: 50 },
		});

		expect(result.brightness).toBe(50);
		expect(store.data?.brightness).toBe(50);
	});

	it('should throw validation error if edit payload is invalid', async () => {
		await expect(
			store.edit({
				data: { ...mockDisplay, brightness: 'not-a-number' },
			} as unknown as IConfigDisplayEditActionPayload)
		).rejects.toThrow(ConfigValidationException);
	});

	it('should throw validation error if local data + edit is invalid', async () => {
		store.data = { ...mockDisplay, brightness: 75 };

		await expect(
			store.edit({
				data: { ...mockDisplay, brightness: undefined, darkMode: false },
			} as unknown as IConfigDisplayEditActionPayload)
		).rejects.toThrow(ConfigValidationException);
	});

	it('should refresh data and throw if API update fails', async () => {
		store.data = { ...mockDisplay };

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Patch error'),
			response: { status: 500 },
		});

		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockDisplayRes },
			error: undefined,
			response: { status: 200 },
		});

		await expect(store.edit({ data: { ...mockDisplay, brightness: 20 } })).rejects.toThrow(ConfigApiException);
	});
});
