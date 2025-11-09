import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { StatsApiException, StatsValidationException } from '../stats.exceptions';

import { useStats } from './stats.store';
import type { IStatsSetActionPayload } from './stats.store.types';

const mockStatsRes = {
	'api-module': {
		req_per_min: {
			value: 0,
			last_updated: '2025-11-02T09:13:40.439Z',
		},
		error_rate_5m: {
			value: 0,
			last_updated: '2025-11-02T09:13:40.439Z',
		},
		p95_ms_5m: {
			value: 0,
			last_updated: '2025-11-02T09:13:40.439Z',
		},
	},
};

const mockStats = {
	'api-module': {
		reqPerMin: {
			value: 0,
			lastUpdated: new Date('2025-11-02T09:13:40.439Z'),
		},
		errorRate5m: {
			value: 0,
			lastUpdated: new Date('2025-11-02T09:13:40.439Z'),
		},
		p95Ms5m: {
			value: 0,
			lastUpdated: new Date('2025-11-02T09:13:40.439Z'),
		},
	},
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

describe('Stats Store', () => {
	let store: ReturnType<typeof useStats>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useStats();

		vi.clearAllMocks();
	});

	it('should set stats data successfully', () => {
		const result = store.set({ data: mockStats });

		expect(result).toEqual(mockStats);
		expect(store.data).toEqual(mockStats);
	});

	it('should throw validation error if set stats with invalid data', () => {
		expect(() =>
			store.set({ data: { 'api-module': { ...mockStats['api-module'], reqPerMin: 'invalid' } } } as unknown as IStatsSetActionPayload)
		).toThrow(StatsValidationException);
	});

	it('should fetch stats successfully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockStatsRes },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.get();

		expect(result).toEqual(mockStats);
		expect(store.data).toEqual(mockStats);
	});

	it('should throw error if fetch fails', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Network error'),
			response: { status: 500 },
		});

		await expect(store.get()).rejects.toThrow(StatsApiException);
	});
});
