import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';

import { useSpaceIntents } from './useSpaceIntents';

const mockPost = vi.fn();

vi.mock('../../../common', () => ({
	useBackend: () => ({
		client: {
			POST: mockPost,
		},
	}),
}));

describe('useSpaceIntents', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const createMockLightingIntentResponse = (overrides = {}) => ({
		data: {
			data: {
				success: true,
				affected_devices: 3,
				failed_devices: 0,
				...overrides,
			},
		},
		error: undefined,
	});

	const createMockClimateIntentResponse = (overrides = {}) => ({
		data: {
			data: {
				success: true,
				affected_devices: 2,
				failed_devices: 0,
				mode: 'heat',
				new_setpoint: 22.5,
				heating_setpoint: 22.5,
				cooling_setpoint: 25.0,
				...overrides,
			},
		},
		error: undefined,
	});

	describe('initial state', () => {
		it('should have correct initial state', () => {
			const spaceId = ref<string | undefined>(undefined);
			const { isExecuting, error, lastResult } = useSpaceIntents(spaceId);

			expect(isExecuting.value).toBe(false);
			expect(error.value).toBeNull();
			expect(lastResult.value).toBeNull();
		});
	});

	describe('executeLightingIntent', () => {
		it('should return null when spaceId is undefined', async () => {
			const spaceId = ref<string | undefined>(undefined);
			const { executeLightingIntent } = useSpaceIntents(spaceId);

			const result = await executeLightingIntent({ type: 'off' });

			expect(result).toBeNull();
			expect(mockPost).not.toHaveBeenCalled();
		});

		it('should execute lighting intent successfully', async () => {
			mockPost.mockResolvedValueOnce(createMockLightingIntentResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { executeLightingIntent, isExecuting, lastResult, error } = useSpaceIntents(spaceId);

			const resultPromise = executeLightingIntent({ type: 'off' });
			expect(isExecuting.value).toBe(true);

			const result = await resultPromise;

			expect(isExecuting.value).toBe(false);
			expect(error.value).toBeNull();
			expect(result).not.toBeNull();
			expect(result?.success).toBe(true);
			expect(result?.affectedDevices).toBe(3);
			expect(lastResult.value).toEqual(result);
		});

		it('should handle API errors', async () => {
			mockPost.mockResolvedValueOnce({
				data: undefined,
				error: { message: 'Server error' },
			});

			const spaceId = ref<string | undefined>('space-123');
			const { executeLightingIntent, error } = useSpaceIntents(spaceId);

			const result = await executeLightingIntent({ type: 'off' });

			expect(result).toBeNull();
			expect(error.value).toBe('Failed to execute lighting intent');
		});
	});

	describe('lighting convenience methods', () => {
		it('should turn lights off', async () => {
			mockPost.mockResolvedValueOnce(createMockLightingIntentResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { turnLightsOff } = useSpaceIntents(spaceId);

			const result = await turnLightsOff();

			expect(result?.success).toBe(true);
			expect(mockPost).toHaveBeenCalledWith(
				expect.stringContaining('/intents/lighting'),
				expect.objectContaining({
					body: expect.objectContaining({
						data: expect.objectContaining({ type: 'off' }),
					}),
				})
			);
		});

		it('should turn lights on', async () => {
			mockPost.mockResolvedValueOnce(createMockLightingIntentResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { turnLightsOn } = useSpaceIntents(spaceId);

			const result = await turnLightsOn();

			expect(result?.success).toBe(true);
			expect(mockPost).toHaveBeenCalledWith(
				expect.stringContaining('/intents/lighting'),
				expect.objectContaining({
					body: expect.objectContaining({
						data: expect.objectContaining({ type: 'on' }),
					}),
				})
			);
		});

		it('should set lighting mode', async () => {
			mockPost.mockResolvedValueOnce(createMockLightingIntentResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { setLightingMode } = useSpaceIntents(spaceId);

			const result = await setLightingMode('relax');

			expect(result?.success).toBe(true);
			expect(mockPost).toHaveBeenCalledWith(
				expect.stringContaining('/intents/lighting'),
				expect.objectContaining({
					body: expect.objectContaining({
						data: expect.objectContaining({ type: 'set_mode', mode: 'relax' }),
					}),
				})
			);
		});

		it('should adjust brightness', async () => {
			mockPost.mockResolvedValueOnce(createMockLightingIntentResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { adjustBrightness } = useSpaceIntents(spaceId);

			const result = await adjustBrightness('medium', true);

			expect(result?.success).toBe(true);
			expect(mockPost).toHaveBeenCalledWith(
				expect.stringContaining('/intents/lighting'),
				expect.objectContaining({
					body: expect.objectContaining({
						data: expect.objectContaining({
							type: 'brightness_delta',
							delta: 'medium',
							increase: true,
						}),
					}),
				})
			);
		});
	});

	describe('executeClimateIntent', () => {
		it('should execute climate intent successfully', async () => {
			mockPost.mockResolvedValueOnce(createMockClimateIntentResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { executeClimateIntent, lastResult } = useSpaceIntents(spaceId);

			const result = await executeClimateIntent({ type: 'setpoint_set', value: 22.5 });

			expect(result).not.toBeNull();
			expect(result?.success).toBe(true);
			expect(result?.newSetpoint).toBe(22.5);
			expect(lastResult.value).toEqual(result);
		});
	});

	describe('climate convenience methods', () => {
		it('should adjust setpoint', async () => {
			mockPost.mockResolvedValueOnce(createMockClimateIntentResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { adjustSetpoint } = useSpaceIntents(spaceId);

			const result = await adjustSetpoint('small', true);

			expect(result?.success).toBe(true);
			expect(mockPost).toHaveBeenCalledWith(
				expect.stringContaining('/intents/climate'),
				expect.objectContaining({
					body: expect.objectContaining({
						data: expect.objectContaining({
							type: 'setpoint_delta',
							delta: 'small',
							increase: true,
						}),
					}),
				})
			);
		});

		it('should set exact setpoint', async () => {
			mockPost.mockResolvedValueOnce(createMockClimateIntentResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { setSetpoint } = useSpaceIntents(spaceId);

			const result = await setSetpoint(21.0);

			expect(result?.success).toBe(true);
			expect(mockPost).toHaveBeenCalledWith(
				expect.stringContaining('/intents/climate'),
				expect.objectContaining({
					body: expect.objectContaining({
						data: expect.objectContaining({
							type: 'setpoint_set',
							value: 21.0,
						}),
					}),
				})
			);
		});

		it('should set climate mode', async () => {
			mockPost.mockResolvedValueOnce(createMockClimateIntentResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { setClimateMode } = useSpaceIntents(spaceId);

			const result = await setClimateMode('heat');

			expect(result?.success).toBe(true);
			expect(mockPost).toHaveBeenCalledWith(
				expect.stringContaining('/intents/climate'),
				expect.objectContaining({
					body: expect.objectContaining({
						data: expect.objectContaining({
							type: 'set_mode',
							mode: 'heat',
						}),
					}),
				})
			);
		});
	});

	describe('space change handling', () => {
		it('should clear state when space ID changes', async () => {
			mockPost.mockResolvedValueOnce(createMockLightingIntentResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { executeLightingIntent, lastResult, error } = useSpaceIntents(spaceId);

			await executeLightingIntent({ type: 'off' });
			expect(lastResult.value).not.toBeNull();

			spaceId.value = 'space-456';
			await nextTick();

			expect(lastResult.value).toBeNull();
			expect(error.value).toBeNull();
		});

		it('should ignore stale requests when space changes during execution', async () => {
			let resolveRequest: (value: unknown) => void;
			const pendingPromise = new Promise((resolve) => {
				resolveRequest = resolve;
			});
			mockPost.mockReturnValueOnce(pendingPromise);

			const spaceId = ref<string | undefined>('space-123');
			const { executeLightingIntent, lastResult } = useSpaceIntents(spaceId);

			const executePromise = executeLightingIntent({ type: 'off' });

			spaceId.value = 'space-456';
			await nextTick();

			resolveRequest!(createMockLightingIntentResponse());
			const result = await executePromise;

			expect(result).toBeNull();
			expect(lastResult.value).toBeNull();
		});
	});

	describe('concurrent execution handling', () => {
		it('should track multiple concurrent executions with counter', async () => {
			let resolveFirst: (value: unknown) => void;
			let resolveSecond: (value: unknown) => void;

			mockPost.mockReturnValueOnce(
				new Promise((resolve) => {
					resolveFirst = resolve;
				})
			);
			mockPost.mockReturnValueOnce(
				new Promise((resolve) => {
					resolveSecond = resolve;
				})
			);

			const spaceId = ref<string | undefined>('space-123');
			const { executeLightingIntent, executeClimateIntent, isExecuting } = useSpaceIntents(spaceId);

			const exec1 = executeLightingIntent({ type: 'off' });
			expect(isExecuting.value).toBe(true);

			const exec2 = executeClimateIntent({ type: 'setpoint_set', value: 22 });
			expect(isExecuting.value).toBe(true);

			resolveFirst!(createMockLightingIntentResponse());
			await exec1;
			expect(isExecuting.value).toBe(true);

			resolveSecond!(createMockClimateIntentResponse());
			await exec2;
			expect(isExecuting.value).toBe(false);
		});
	});
});
