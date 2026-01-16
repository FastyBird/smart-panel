import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';

import { useSpaceSuggestion } from './useSpaceSuggestion';

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

describe('useSpaceSuggestion', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const createMockSuggestionResponse = (overrides = {}) => ({
		data: {
			data: {
				type: 'set_mode',
				title: 'Switch to Relax Mode',
				reason: 'It is evening time',
				lighting_mode: 'relax',
				...overrides,
			},
		},
		error: undefined,
	});

	const createMockFeedbackResponse = (overrides = {}) => ({
		data: {
			data: {
				success: true,
				intent_executed: true,
				...overrides,
			},
		},
		error: undefined,
	});

	describe('initial state', () => {
		it('should have correct initial state', () => {
			const spaceId = ref<string | undefined>(undefined);
			const { suggestion, hasSuggestion, isLoading, isSubmitting, error } = useSpaceSuggestion(spaceId);

			expect(suggestion.value).toBeNull();
			expect(hasSuggestion.value).toBe(false);
			expect(isLoading.value).toBe(false);
			expect(isSubmitting.value).toBe(false);
			expect(error.value).toBeNull();
		});
	});

	describe('fetchSuggestion', () => {
		it('should return null when spaceId is undefined', async () => {
			const spaceId = ref<string | undefined>(undefined);
			const { fetchSuggestion } = useSpaceSuggestion(spaceId);

			const result = await fetchSuggestion();

			expect(result).toBeNull();
			expect(mockGet).not.toHaveBeenCalled();
		});

		it('should fetch suggestion successfully', async () => {
			mockGet.mockResolvedValueOnce(createMockSuggestionResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { fetchSuggestion, suggestion, hasSuggestion, isLoading } = useSpaceSuggestion(spaceId);

			const resultPromise = fetchSuggestion();
			expect(isLoading.value).toBe(true);

			const result = await resultPromise;

			expect(isLoading.value).toBe(false);
			expect(result).not.toBeNull();
			expect(result?.type).toBe('set_mode');
			expect(result?.title).toBe('Switch to Relax Mode');
			expect(result?.lightingMode).toBe('relax');
			expect(suggestion.value).toEqual(result);
			expect(hasSuggestion.value).toBe(true);
		});

		it('should handle no suggestion available', async () => {
			mockGet.mockResolvedValueOnce({
				data: { data: null },
				error: undefined,
			});

			const spaceId = ref<string | undefined>('space-123');
			const { fetchSuggestion, suggestion, hasSuggestion } = useSpaceSuggestion(spaceId);

			const result = await fetchSuggestion();

			expect(result).toBeNull();
			expect(suggestion.value).toBeNull();
			expect(hasSuggestion.value).toBe(false);
		});

		it('should handle API errors', async () => {
			mockGet.mockResolvedValueOnce({
				data: undefined,
				error: { message: 'Server error' },
			});

			const spaceId = ref<string | undefined>('space-123');
			const { fetchSuggestion, error } = useSpaceSuggestion(spaceId);

			const result = await fetchSuggestion();

			expect(result).toBeNull();
			expect(error.value).toBe('Failed to fetch suggestion');
		});
	});

	describe('applySuggestion', () => {
		it('should apply suggestion and clear it', async () => {
			mockGet.mockResolvedValueOnce(createMockSuggestionResponse());
			mockPost.mockResolvedValueOnce(createMockFeedbackResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { fetchSuggestion, applySuggestion, suggestion, isSubmitting } = useSpaceSuggestion(spaceId);

			await fetchSuggestion();
			expect(suggestion.value).not.toBeNull();

			const resultPromise = applySuggestion();
			expect(isSubmitting.value).toBe(true);

			const result = await resultPromise;

			expect(isSubmitting.value).toBe(false);
			expect(result).not.toBeNull();
			expect(result?.success).toBe(true);
			expect(result?.intentExecuted).toBe(true);
			expect(suggestion.value).toBeNull();
		});

		it('should return null when no suggestion exists', async () => {
			const spaceId = ref<string | undefined>('space-123');
			const { applySuggestion } = useSpaceSuggestion(spaceId);

			const result = await applySuggestion();

			expect(result).toBeNull();
			expect(mockPost).not.toHaveBeenCalled();
		});

		it('should send correct feedback type', async () => {
			mockGet.mockResolvedValueOnce(createMockSuggestionResponse());
			mockPost.mockResolvedValueOnce(createMockFeedbackResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { fetchSuggestion, applySuggestion } = useSpaceSuggestion(spaceId);

			await fetchSuggestion();
			await applySuggestion();

			expect(mockPost).toHaveBeenCalledWith(
				expect.stringContaining('/suggestion/feedback'),
				expect.objectContaining({
					body: expect.objectContaining({
						data: expect.objectContaining({
							feedback: 'applied',
						}),
					}),
				})
			);
		});
	});

	describe('dismissSuggestion', () => {
		it('should dismiss suggestion and clear it', async () => {
			mockGet.mockResolvedValueOnce(createMockSuggestionResponse());
			mockPost.mockResolvedValueOnce(createMockFeedbackResponse({ intent_executed: false }));

			const spaceId = ref<string | undefined>('space-123');
			const { fetchSuggestion, dismissSuggestion, suggestion } = useSpaceSuggestion(spaceId);

			await fetchSuggestion();
			expect(suggestion.value).not.toBeNull();

			const result = await dismissSuggestion();

			expect(result?.success).toBe(true);
			expect(result?.intentExecuted).toBe(false);
			expect(suggestion.value).toBeNull();
		});

		it('should send correct feedback type', async () => {
			mockGet.mockResolvedValueOnce(createMockSuggestionResponse());
			mockPost.mockResolvedValueOnce(createMockFeedbackResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { fetchSuggestion, dismissSuggestion } = useSpaceSuggestion(spaceId);

			await fetchSuggestion();
			await dismissSuggestion();

			expect(mockPost).toHaveBeenCalledWith(
				expect.stringContaining('/suggestion/feedback'),
				expect.objectContaining({
					body: expect.objectContaining({
						data: expect.objectContaining({
							feedback: 'dismissed',
						}),
					}),
				})
			);
		});
	});

	describe('clearSuggestion', () => {
		it('should clear suggestion without API call', async () => {
			mockGet.mockResolvedValueOnce(createMockSuggestionResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { fetchSuggestion, clearSuggestion, suggestion, hasSuggestion } = useSpaceSuggestion(spaceId);

			await fetchSuggestion();
			expect(suggestion.value).not.toBeNull();

			clearSuggestion();

			expect(suggestion.value).toBeNull();
			expect(hasSuggestion.value).toBe(false);
			expect(mockPost).not.toHaveBeenCalled();
		});
	});

	describe('space change handling', () => {
		it('should clear state when space ID changes', async () => {
			mockGet.mockResolvedValueOnce(createMockSuggestionResponse());

			const spaceId = ref<string | undefined>('space-123');
			const { fetchSuggestion, suggestion, hasSuggestion } = useSpaceSuggestion(spaceId);

			await fetchSuggestion();
			expect(suggestion.value).not.toBeNull();

			spaceId.value = 'space-456';
			await nextTick();

			expect(suggestion.value).toBeNull();
			expect(hasSuggestion.value).toBe(false);
		});

		it('should ignore stale requests when space changes', async () => {
			let resolveRequest: (value: unknown) => void;
			const pendingPromise = new Promise((resolve) => {
				resolveRequest = resolve;
			});
			mockGet.mockReturnValueOnce(pendingPromise);

			const spaceId = ref<string | undefined>('space-123');
			const { fetchSuggestion, suggestion } = useSpaceSuggestion(spaceId);

			const fetchPromise = fetchSuggestion();

			spaceId.value = 'space-456';
			await nextTick();

			resolveRequest!(createMockSuggestionResponse());
			const result = await fetchPromise;

			expect(result).toBeNull();
			expect(suggestion.value).toBeNull();
		});

		it('should ignore stale feedback requests when space changes', async () => {
			mockGet.mockResolvedValueOnce(createMockSuggestionResponse());

			let resolveRequest: (value: unknown) => void;
			const pendingPromise = new Promise((resolve) => {
				resolveRequest = resolve;
			});
			mockPost.mockReturnValueOnce(pendingPromise);

			const spaceId = ref<string | undefined>('space-123');
			const { fetchSuggestion, applySuggestion } = useSpaceSuggestion(spaceId);

			await fetchSuggestion();
			const applyPromise = applySuggestion();

			spaceId.value = 'space-456';
			await nextTick();

			resolveRequest!(createMockFeedbackResponse());
			const result = await applyPromise;

			expect(result).toBeNull();
		});
	});

	describe('concurrent request handling', () => {
		it('should track loading state with counter', async () => {
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
			const { fetchSuggestion, isLoading } = useSpaceSuggestion(spaceId);

			const fetch1 = fetchSuggestion();
			expect(isLoading.value).toBe(true);

			const fetch2 = fetchSuggestion();
			expect(isLoading.value).toBe(true);

			resolveFirst!(createMockSuggestionResponse());
			await fetch1;
			expect(isLoading.value).toBe(true);

			resolveSecond!(createMockSuggestionResponse());
			await fetch2;
			expect(isLoading.value).toBe(false);
		});
	});
});
