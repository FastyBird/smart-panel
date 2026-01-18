import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';

import { useSpaceClimateState } from './useSpaceClimateState';

const mockGet = vi.fn();

vi.mock('../../../common', () => ({
	useBackend: () => ({
		client: {
			GET: mockGet,
		},
	}),
}));

describe('useSpaceClimateState', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const createMockClimateStateResponse = (overrides = {}) => ({
		data: {
			data: {
				has_climate: true,
				mode: 'heat',
				current_temperature: 21.5,
				current_humidity: 45,
				heating_setpoint: 22.0,
				cooling_setpoint: 25.0,
				min_setpoint: 5.0,
				max_setpoint: 35.0,
				can_set_setpoint: true,
				supports_heating: true,
				supports_cooling: true,
				is_mixed: false,
				devices_count: 2,
				last_applied_mode: 'heat',
				last_applied_at: '2024-01-01T12:00:00Z',
				...overrides,
			},
		},
		error: undefined,
	});

	describe('initial state', () => {
		it('should return null climate state initially', () => {
			const spaceId = ref<string | undefined>(undefined);
			const { climateState, isLoading, error } = useSpaceClimateState(spaceId);

			expect(climateState.value).toBeNull();
			expect(isLoading.value).toBe(false);
			expect(error.value).toBeNull();
		});

		it('should have correct computed properties when no data', () => {
			const spaceId = ref<string | undefined>(undefined);
			const { hasClimate, isHeating, isCooling, isAuto, isOff } = useSpaceClimateState(spaceId);

			expect(hasClimate.value).toBe(false);
			expect(isHeating.value).toBe(false);
			expect(isCooling.value).toBe(false);
			expect(isAuto.value).toBe(false);
			expect(isOff.value).toBe(false);
		});
	});

	describe('fetchClimateState', () => {
		it('should return null when spaceId is undefined', async () => {
			const spaceId = ref<string | undefined>(undefined);
			const { fetchClimateState } = useSpaceClimateState(spaceId);

			const result = await fetchClimateState();

			expect(result).toBeNull();
			expect(mockGet).not.toHaveBeenCalled();
		});

		it('should fetch and transform climate state successfully', async () => {
			mockGet.mockResolvedValueOnce(createMockClimateStateResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { fetchClimateState, climateState, isLoading, error } = useSpaceClimateState(spaceId);

			const resultPromise = fetchClimateState();
			expect(isLoading.value).toBe(true);

			const result = await resultPromise;

			expect(isLoading.value).toBe(false);
			expect(error.value).toBeNull();
			expect(result).not.toBeNull();
			expect(result?.currentTemperature).toBe(21.5);
			expect(result?.mode).toBe('heat');
			expect(result?.heatingSetpoint).toBe(22.0);
			expect(result?.hasClimate).toBe(true);
			expect(climateState.value).toEqual(result);
		});

		it('should handle API errors', async () => {
			mockGet.mockResolvedValueOnce({
				data: undefined,
				error: { message: 'Network error' },
			});

			const spaceId = ref<string | undefined>('space-123');
			const { fetchClimateState, error, isLoading } = useSpaceClimateState(spaceId);

			const result = await fetchClimateState();

			expect(result).toBeNull();
			expect(error.value).toBe('Failed to fetch climate state');
			expect(isLoading.value).toBe(false);
		});

		it('should handle exceptions', async () => {
			mockGet.mockRejectedValueOnce(new Error('Network failure'));

			const spaceId = ref<string | undefined>('space-123');
			const { fetchClimateState, error } = useSpaceClimateState(spaceId);

			const result = await fetchClimateState();

			expect(result).toBeNull();
			expect(error.value).toBe('Network failure');
		});
	});

	describe('computed properties', () => {
		it('should compute hasClimate correctly', async () => {
			mockGet.mockResolvedValueOnce(createMockClimateStateResponse({ has_climate: true }));

			const spaceId = ref<string | undefined>('space-123');
			const { fetchClimateState, hasClimate } = useSpaceClimateState(spaceId);

			await fetchClimateState();
			expect(hasClimate.value).toBe(true);
		});

		it('should compute isHeating correctly', async () => {
			mockGet.mockResolvedValueOnce(createMockClimateStateResponse({ mode: 'heat' }));

			const spaceId = ref<string | undefined>('space-123');
			const { fetchClimateState, isHeating, isCooling, isAuto, isOff } = useSpaceClimateState(spaceId);

			await fetchClimateState();
			expect(isHeating.value).toBe(true);
			expect(isCooling.value).toBe(false);
			expect(isAuto.value).toBe(false);
			expect(isOff.value).toBe(false);
		});

		it('should compute isCooling correctly', async () => {
			mockGet.mockResolvedValueOnce(createMockClimateStateResponse({ mode: 'cool' }));

			const spaceId = ref<string | undefined>('space-123');
			const { fetchClimateState, isHeating, isCooling } = useSpaceClimateState(spaceId);

			await fetchClimateState();
			expect(isHeating.value).toBe(false);
			expect(isCooling.value).toBe(true);
		});

		it('should compute canAdjustTemperature correctly', async () => {
			mockGet.mockResolvedValueOnce(createMockClimateStateResponse({ has_climate: true, can_set_setpoint: true }));

			const spaceId = ref<string | undefined>('space-123');
			const { fetchClimateState, canAdjustTemperature } = useSpaceClimateState(spaceId);

			await fetchClimateState();
			expect(canAdjustTemperature.value).toBe(true);
		});
	});

	describe('space change handling', () => {
		it('should clear state when space ID changes', async () => {
			mockGet.mockResolvedValueOnce(createMockClimateStateResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { fetchClimateState, climateState, error } = useSpaceClimateState(spaceId);

			await fetchClimateState();
			expect(climateState.value).not.toBeNull();

			spaceId.value = 'space-456';
			await nextTick();

			expect(climateState.value).toBeNull();
			expect(error.value).toBeNull();
		});

		it('should ignore stale requests when space changes during fetch', async () => {
			let resolveRequest: (value: unknown) => void;
			const pendingPromise = new Promise((resolve) => {
				resolveRequest = resolve;
			});
			mockGet.mockReturnValueOnce(pendingPromise);

			const spaceId = ref<string | undefined>('space-123');
			const { fetchClimateState, climateState } = useSpaceClimateState(spaceId);

			const fetchPromise = fetchClimateState();

			spaceId.value = 'space-456';
			await nextTick();

			resolveRequest!(createMockClimateStateResponse());
			const result = await fetchPromise;

			expect(result).toBeNull();
			expect(climateState.value).toBeNull();
		});
	});

	describe('concurrent request handling', () => {
		it('should handle multiple concurrent requests with counter', async () => {
			let resolveFirst: (value: unknown) => void;
			let resolveSecond: (value: unknown) => void;

			mockGet.mockReturnValueOnce(
				new Promise((resolve) => {
					resolveFirst = resolve;
				})
			);
			mockGet.mockReturnValueOnce(
				new Promise((resolve) => {
					resolveSecond = resolve;
				})
			);

			const spaceId = ref<string | undefined>('space-123');
			const { fetchClimateState, isLoading } = useSpaceClimateState(spaceId);

			const fetch1 = fetchClimateState();
			expect(isLoading.value).toBe(true);

			const fetch2 = fetchClimateState();
			expect(isLoading.value).toBe(true);

			resolveFirst!(createMockClimateStateResponse());
			await fetch1;
			expect(isLoading.value).toBe(true);

			resolveSecond!(createMockClimateStateResponse());
			await fetch2;
			expect(isLoading.value).toBe(false);
		});
	});
});
