import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemApiException, SystemValidationException } from '../system.exceptions';

import { useThrottleStatus } from './throttle-status.store';
import type { IThrottleStatusSetActionPayload } from './throttle-status.store.types';

const mockThrottleStatusRes = {
	undervoltage: false,
	frequency_capping: false,
	throttling: false,
	soft_temp_limit: false,
};

const mockThrottleStatus = {
	undervoltage: false,
	frequencyCapping: false,
	throttling: false,
	softTempLimit: false,
};

const backendClient = {
	GET: vi.fn(),
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

describe('ThrottleStatus Store', () => {
	let store: ReturnType<typeof useThrottleStatus>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useThrottleStatus();

		vi.clearAllMocks();
	});

	it('should set config audio data successfully', () => {
		const result = store.set({ data: mockThrottleStatus });

		expect(result).toEqual(mockThrottleStatus);
		expect(store.data).toEqual(mockThrottleStatus);
	});

	it('should throw validation error if set config audio with invalid data', () => {
		expect(() => store.set({ data: { ...mockThrottleStatus, undervoltage: 'invalid' } } as unknown as IThrottleStatusSetActionPayload)).toThrow(
			SystemValidationException
		);
	});

	it('should fetch config audio successfully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockThrottleStatusRes },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.get();

		expect(result).toEqual(mockThrottleStatus);
		expect(store.data).toEqual(mockThrottleStatus);
	});

	it('should throw error if fetch fails', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Network error'),
			response: { status: 400 },
		});

		const result = await store.get();

		expect(result).toEqual(null);
	});

	it('should throw error if fetch fails', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Network error'),
			response: { status: 500 },
		});

		await expect(store.get()).rejects.toThrow(SystemApiException);
	});
});
