import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';

import { useSpaceLightingState } from './useSpaceLightingState';

const mockGet = vi.fn();

vi.mock('../../../common', () => ({
	useBackend: () => ({
		client: {
			GET: mockGet,
		},
	}),
}));

describe('useSpaceLightingState', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const createMockLightingStateResponse = (overrides = {}) => ({
		data: {
			data: {
				detected_mode: 'work',
				mode_confidence: 'exact',
				mode_match_percentage: 100,
				last_applied_mode: 'work',
				last_applied_at: '2024-01-01T12:00:00Z',
				total_lights: 5,
				lights_on: 3,
				average_brightness: 75,
				roles: {
					main: {
						is_on: true,
						is_on_mixed: false,
						brightness: 80,
						color_temperature: 4000,
						color: null,
						devices_count: 2,
						devices_on: 2,
					},
				},
				other: {
					is_on: true,
					is_on_mixed: true,
					brightness: 50,
					devices_count: 3,
					devices_on: 1,
				},
				...overrides,
			},
		},
		error: undefined,
	});

	describe('initial state', () => {
		it('should return null lighting state initially', () => {
			const spaceId = ref<string | undefined>(undefined);
			const { lightingState, isLoading, error } = useSpaceLightingState(spaceId);

			expect(lightingState.value).toBeNull();
			expect(isLoading.value).toBe(false);
			expect(error.value).toBeNull();
		});

		it('should have correct computed properties when no data', () => {
			const spaceId = ref<string | undefined>(undefined);
			const { hasLights, anyOn, allOn, allOff } = useSpaceLightingState(spaceId);

			expect(hasLights.value).toBe(false);
			expect(anyOn.value).toBe(false);
			expect(allOn.value).toBe(false);
			expect(allOff.value).toBe(false);
		});
	});

	describe('fetchLightingState', () => {
		it('should return null when spaceId is undefined', async () => {
			const spaceId = ref<string | undefined>(undefined);
			const { fetchLightingState } = useSpaceLightingState(spaceId);

			const result = await fetchLightingState();

			expect(result).toBeNull();
			expect(mockGet).not.toHaveBeenCalled();
		});

		it('should fetch and transform lighting state successfully', async () => {
			mockGet.mockResolvedValueOnce(createMockLightingStateResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { fetchLightingState, lightingState, isLoading, error } = useSpaceLightingState(spaceId);

			const resultPromise = fetchLightingState();
			expect(isLoading.value).toBe(true);

			const result = await resultPromise;

			expect(isLoading.value).toBe(false);
			expect(error.value).toBeNull();
			expect(result).not.toBeNull();
			expect(result?.detectedMode).toBe('work');
			expect(result?.totalLights).toBe(5);
			expect(result?.lightsOn).toBe(3);
			expect(lightingState.value).toEqual(result);
		});

		it('should handle API errors', async () => {
			mockGet.mockResolvedValueOnce({
				data: undefined,
				error: { message: 'Network error' },
			});

			const spaceId = ref<string | undefined>('space-123');
			const { fetchLightingState, error, isLoading } = useSpaceLightingState(spaceId);

			const result = await fetchLightingState();

			expect(result).toBeNull();
			expect(error.value).toBe('Failed to fetch lighting state');
			expect(isLoading.value).toBe(false);
		});

		it('should handle exceptions', async () => {
			mockGet.mockRejectedValueOnce(new Error('Network failure'));

			const spaceId = ref<string | undefined>('space-123');
			const { fetchLightingState, error } = useSpaceLightingState(spaceId);

			const result = await fetchLightingState();

			expect(result).toBeNull();
			expect(error.value).toBe('Network failure');
		});
	});

	describe('computed properties', () => {
		it('should compute hasLights correctly', async () => {
			mockGet.mockResolvedValueOnce(createMockLightingStateResponse({ total_lights: 5 }));

			const spaceId = ref<string | undefined>('space-123');
			const { fetchLightingState, hasLights } = useSpaceLightingState(spaceId);

			await fetchLightingState();
			expect(hasLights.value).toBe(true);
		});

		it('should compute anyOn correctly', async () => {
			mockGet.mockResolvedValueOnce(createMockLightingStateResponse({ lights_on: 3 }));

			const spaceId = ref<string | undefined>('space-123');
			const { fetchLightingState, anyOn } = useSpaceLightingState(spaceId);

			await fetchLightingState();
			expect(anyOn.value).toBe(true);
		});

		it('should compute allOn correctly when all lights are on', async () => {
			mockGet.mockResolvedValueOnce(createMockLightingStateResponse({ total_lights: 5, lights_on: 5 }));

			const spaceId = ref<string | undefined>('space-123');
			const { fetchLightingState, allOn } = useSpaceLightingState(spaceId);

			await fetchLightingState();
			expect(allOn.value).toBe(true);
		});

		it('should compute allOff correctly when no lights are on', async () => {
			mockGet.mockResolvedValueOnce(createMockLightingStateResponse({ total_lights: 5, lights_on: 0 }));

			const spaceId = ref<string | undefined>('space-123');
			const { fetchLightingState, allOff } = useSpaceLightingState(spaceId);

			await fetchLightingState();
			expect(allOff.value).toBe(true);
		});

		it('should return false for allOff when lightingState is null', () => {
			const spaceId = ref<string | undefined>(undefined);
			const { allOff } = useSpaceLightingState(spaceId);

			expect(allOff.value).toBe(false);
		});
	});

	describe('space change handling', () => {
		it('should clear state when space ID changes', async () => {
			mockGet.mockResolvedValueOnce(createMockLightingStateResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { fetchLightingState, lightingState, error } = useSpaceLightingState(spaceId);

			await fetchLightingState();
			expect(lightingState.value).not.toBeNull();

			spaceId.value = 'space-456';
			await nextTick();

			expect(lightingState.value).toBeNull();
			expect(error.value).toBeNull();
		});

		it('should ignore stale requests when space changes during fetch', async () => {
			let resolveRequest: (value: unknown) => void;
			const pendingPromise = new Promise((resolve) => {
				resolveRequest = resolve;
			});
			mockGet.mockReturnValueOnce(pendingPromise);

			const spaceId = ref<string | undefined>('space-123');
			const { fetchLightingState, lightingState } = useSpaceLightingState(spaceId);

			const fetchPromise = fetchLightingState();

			// Change space while request is in flight
			spaceId.value = 'space-456';
			await nextTick();

			// Resolve the original request
			resolveRequest!(createMockLightingStateResponse());
			const result = await fetchPromise;

			// Should return null and not update state
			expect(result).toBeNull();
			expect(lightingState.value).toBeNull();
		});
	});

	describe('concurrent request handling', () => {
		it('should handle multiple concurrent requests with counter', async () => {
			let resolveFirst: (value: unknown) => void;
			let resolveSecond: (value: unknown) => void;

			const firstPromise = new Promise((resolve) => {
				resolveFirst = resolve;
			});
			const secondPromise = new Promise((resolve) => {
				resolveSecond = resolve;
			});

			mockGet.mockReturnValueOnce(firstPromise);
			mockGet.mockReturnValueOnce(secondPromise);

			const spaceId = ref<string | undefined>('space-123');
			const { fetchLightingState, isLoading } = useSpaceLightingState(spaceId);

			const fetch1 = fetchLightingState();
			expect(isLoading.value).toBe(true);

			const fetch2 = fetchLightingState();
			expect(isLoading.value).toBe(true);

			resolveFirst!(createMockLightingStateResponse());
			await fetch1;
			// Still loading because second request is pending
			expect(isLoading.value).toBe(true);

			resolveSecond!(createMockLightingStateResponse());
			await fetch2;
			expect(isLoading.value).toBe(false);
		});
	});
});
