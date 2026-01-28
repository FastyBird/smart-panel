import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

import { useSpaceMediaState } from './useSpaceMediaState';

// Note: useSpaceMediaState is currently stubbed for V2 media routing API migration
// These tests verify the stubbed behavior

describe('useSpaceMediaState', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns null state when spaceId is undefined', async () => {
		const spaceId = ref<string | undefined>(undefined);
		const { mediaState, fetchMediaState, isLoading, error } = useSpaceMediaState(spaceId);

		expect(mediaState.value).toBeNull();
		expect(isLoading.value).toBe(false);
		expect(error.value).toBeNull();
		expect(await fetchMediaState()).toBeNull();
	});

	it('returns null state when spaceId is defined (stubbed for V2)', async () => {
		const spaceId = ref('space-1');
		const { mediaState, fetchMediaState, hasMedia, anyOn, allOff } = useSpaceMediaState(spaceId);

		// Stubbed behavior - always returns null/false
		expect(await fetchMediaState()).toBeNull();
		expect(mediaState.value).toBeNull();
		expect(hasMedia.value).toBe(false);
		expect(anyOn.value).toBe(false);
		expect(allOff.value).toBe(true);
	});

	it('always returns false for hasMedia (stubbed for V2)', () => {
		const spaceId = ref('space-1');
		const { hasMedia } = useSpaceMediaState(spaceId);

		expect(hasMedia.value).toBe(false);
	});

	it('always returns true for allOff (stubbed for V2)', () => {
		const spaceId = ref('space-1');
		const { allOff } = useSpaceMediaState(spaceId);

		expect(allOff.value).toBe(true);
	});

	it('always returns false for anyOn (stubbed for V2)', () => {
		const spaceId = ref('space-1');
		const { anyOn } = useSpaceMediaState(spaceId);

		expect(anyOn.value).toBe(false);
	});
});
