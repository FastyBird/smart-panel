import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';

import { useSpaceUndo } from './useSpaceUndo';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../../../common', () => ({
	useBackend: () => ({
		client: {
			GET: mockGet,
			POST: mockPost,
		},
	}),
}));

describe('useSpaceUndo', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const createMockUndoStateResponse = (overrides = {}) => ({
		data: {
			data: {
				can_undo: true,
				action_description: 'Turn all lights off',
				intent_category: 'lighting',
				captured_at: new Date().toISOString(),
				expires_in_seconds: 30,
				...overrides,
			},
		},
		error: undefined,
	});

	const createMockUndoResultResponse = (overrides = {}) => ({
		data: {
			data: {
				success: true,
				message: 'Undo completed',
				restored_devices: 3,
				failed_devices: 0,
				...overrides,
			},
		},
		error: undefined,
	});

	describe('initial state', () => {
		it('should have correct initial state', () => {
			const spaceId = ref<string | undefined>(undefined);
			const { undoState, canUndo, isLoading, isExecuting, error } = useSpaceUndo(spaceId);

			expect(undoState.value).toBeNull();
			expect(canUndo.value).toBe(false);
			expect(isLoading.value).toBe(false);
			expect(isExecuting.value).toBe(false);
			expect(error.value).toBeNull();
		});
	});

	describe('fetchUndoState', () => {
		it('should return null when spaceId is undefined', async () => {
			const spaceId = ref<string | undefined>(undefined);
			const { fetchUndoState } = useSpaceUndo(spaceId);

			const result = await fetchUndoState();

			expect(result).toBeNull();
			expect(mockGet).not.toHaveBeenCalled();
		});

		it('should fetch undo state successfully', async () => {
			mockGet.mockResolvedValueOnce(createMockUndoStateResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { fetchUndoState, undoState, canUndo, isLoading } = useSpaceUndo(spaceId);

			const resultPromise = fetchUndoState();
			expect(isLoading.value).toBe(true);

			const result = await resultPromise;

			expect(isLoading.value).toBe(false);
			expect(result).not.toBeNull();
			expect(result?.canUndo).toBe(true);
			expect(result?.intentCategory).toBe('lighting');
			expect(result?.actionDescription).toBe('Turn all lights off');
			expect(undoState.value).toEqual(result);
			expect(canUndo.value).toBe(true);
		});

		it('should handle undo not available', async () => {
			mockGet.mockResolvedValueOnce(createMockUndoStateResponse({ can_undo: false }));

			const spaceId = ref<string | undefined>('space-123');
			const { fetchUndoState, canUndo } = useSpaceUndo(spaceId);

			await fetchUndoState();

			expect(canUndo.value).toBe(false);
		});

		it('should handle API errors', async () => {
			mockGet.mockResolvedValueOnce({
				data: undefined,
				error: { message: 'Server error' },
			});

			const spaceId = ref<string | undefined>('space-123');
			const { fetchUndoState, error } = useSpaceUndo(spaceId);

			const result = await fetchUndoState();

			expect(result).toBeNull();
			expect(error.value).toBe('Failed to fetch undo state');
		});
	});

	describe('executeUndo', () => {
		it('should return null when spaceId is undefined', async () => {
			const spaceId = ref<string | undefined>(undefined);
			const { executeUndo } = useSpaceUndo(spaceId);

			const result = await executeUndo();

			expect(result).toBeNull();
			expect(mockPost).not.toHaveBeenCalled();
		});

		it('should execute undo successfully', async () => {
			mockPost.mockResolvedValueOnce(createMockUndoResultResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { executeUndo, isExecuting } = useSpaceUndo(spaceId);

			const resultPromise = executeUndo();
			expect(isExecuting.value).toBe(true);

			const result = await resultPromise;

			expect(isExecuting.value).toBe(false);
			expect(result).not.toBeNull();
			expect(result?.success).toBe(true);
			expect(result?.restoredDevices).toBe(3);
		});

		it('should clear undo state after successful execution', async () => {
			mockGet.mockResolvedValueOnce(createMockUndoStateResponse());
			mockPost.mockResolvedValueOnce(createMockUndoResultResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { fetchUndoState, executeUndo, undoState, canUndo } = useSpaceUndo(spaceId);

			await fetchUndoState();
			expect(undoState.value).not.toBeNull();

			await executeUndo();

			expect(undoState.value).toBeNull();
			expect(canUndo.value).toBe(false);
		});

		it('should handle undo errors', async () => {
			mockPost.mockResolvedValueOnce({
				data: undefined,
				error: { message: 'Undo failed' },
			});

			const spaceId = ref<string | undefined>('space-123');
			const { executeUndo, error } = useSpaceUndo(spaceId);

			const result = await executeUndo();

			expect(result).toBeNull();
			expect(error.value).toBe('Failed to execute undo');
		});
	});

	describe('countdown timer', () => {
		it('should compute remaining seconds correctly', async () => {
			mockGet.mockResolvedValueOnce(createMockUndoStateResponse({ expires_in_seconds: 30 }));

			const spaceId = ref<string | undefined>('space-123');
			const { fetchUndoState, remainingSeconds } = useSpaceUndo(spaceId);

			await fetchUndoState();

			expect(remainingSeconds.value).toBe(30);

			// Advance time by 5 seconds
			vi.advanceTimersByTime(5000);

			expect(remainingSeconds.value).toBe(25);
		});

		it('should set canUndo to false when timer expires', async () => {
			mockGet.mockResolvedValueOnce(createMockUndoStateResponse({ expires_in_seconds: 5 }));

			const spaceId = ref<string | undefined>('space-123');
			const { fetchUndoState, canUndo, remainingSeconds } = useSpaceUndo(spaceId);

			await fetchUndoState();
			expect(canUndo.value).toBe(true);

			// Advance time past expiry
			vi.advanceTimersByTime(6000);

			expect(remainingSeconds.value).toBe(0);
			expect(canUndo.value).toBe(false);
		});
	});

	describe('space change handling', () => {
		it('should clear state when space ID changes', async () => {
			mockGet.mockResolvedValueOnce(createMockUndoStateResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { fetchUndoState, undoState, canUndo } = useSpaceUndo(spaceId);

			await fetchUndoState();
			expect(undoState.value).not.toBeNull();

			spaceId.value = 'space-456';
			await nextTick();

			expect(undoState.value).toBeNull();
			expect(canUndo.value).toBe(false);
		});

		it('should ignore stale requests when space changes', async () => {
			let resolveRequest: (value: unknown) => void;
			const pendingPromise = new Promise((resolve) => {
				resolveRequest = resolve;
			});
			mockGet.mockReturnValueOnce(pendingPromise);

			const spaceId = ref<string | undefined>('space-123');
			const { fetchUndoState, undoState } = useSpaceUndo(spaceId);

			const fetchPromise = fetchUndoState();

			spaceId.value = 'space-456';
			await nextTick();

			resolveRequest!(createMockUndoStateResponse());
			const result = await fetchPromise;

			expect(result).toBeNull();
			expect(undoState.value).toBeNull();
		});
	});

	describe('invalidateUndoState', () => {
		it('should clear undo state and stop timer', async () => {
			mockGet.mockResolvedValueOnce(createMockUndoStateResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { fetchUndoState, invalidateUndoState, undoState, canUndo } = useSpaceUndo(spaceId);

			await fetchUndoState();
			expect(undoState.value).not.toBeNull();

			invalidateUndoState();

			expect(undoState.value).toBeNull();
			expect(canUndo.value).toBe(false);
		});
	});

	describe('intent category detection', () => {
		it('should detect lighting undo', async () => {
			mockGet.mockResolvedValueOnce(createMockUndoStateResponse({ intent_category: 'lighting' }));

			const spaceId = ref<string | undefined>('space-123');
			const { fetchUndoState, isLightingUndo, isClimateUndo } = useSpaceUndo(spaceId);

			await fetchUndoState();

			expect(isLightingUndo.value).toBe(true);
			expect(isClimateUndo.value).toBe(false);
		});

		it('should detect climate undo', async () => {
			mockGet.mockResolvedValueOnce(createMockUndoStateResponse({ intent_category: 'climate' }));

			const spaceId = ref<string | undefined>('space-123');
			const { fetchUndoState, isLightingUndo, isClimateUndo } = useSpaceUndo(spaceId);

			await fetchUndoState();

			expect(isLightingUndo.value).toBe(false);
			expect(isClimateUndo.value).toBe(true);
		});
	});
});
