import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';

import { useSpaceMediaState } from './useSpaceMediaState';

const mockGet = vi.fn();

vi.mock('../../../common', () => ({
	useBackend: () => ({
		client: {
			GET: mockGet,
		},
	}),
}));

const createMockMediaStateResponse = (overrides = {}) => ({
	data: {
		data: {
			has_media: true,
			any_on: true,
			all_off: false,
			average_volume: 40,
			any_muted: false,
			devices_count: 3,
			devices_by_role: { primary: 1, secondary: 1, background: 1 },
			last_applied_mode: 'focused',
			last_applied_volume: 50,
			last_applied_muted: false,
			last_applied_at: '2024-01-01T12:00:00Z',
			detected_mode: 'background',
			mode_confidence: 'exact',
			mode_match_percentage: 90,
			roles: {
				primary: {
					role: 'primary',
					is_on: true,
					is_on_mixed: false,
					volume: 50,
					is_volume_mixed: false,
					is_muted: false,
					is_muted_mixed: false,
					devices_count: 1,
					devices_on: 1,
				},
			},
			other: {
				is_on: false,
				is_on_mixed: false,
				volume: null,
				is_volume_mixed: false,
				is_muted: false,
				is_muted_mixed: false,
				devices_count: 0,
				devices_on: 0,
			},
			...overrides,
		},
	},
	error: undefined,
});

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
		expect(mockGet).not.toHaveBeenCalled();
	});

	it('fetches and transforms media state', async () => {
		mockGet.mockResolvedValueOnce(createMockMediaStateResponse());

		const spaceId = ref('space-1');
		const { fetchMediaState, mediaState, hasMedia, anyOn, allOff } = useSpaceMediaState(spaceId);

		const result = await fetchMediaState();

		expect(result).not.toBeNull();
		expect(mediaState.value?.detectedMode).toBe('background');
		expect(mediaState.value?.roles.primary.volume).toBe(50);
		expect(hasMedia.value).toBe(true);
		expect(anyOn.value).toBe(true);
		expect(allOff.value).toBe(false);
	});

	it('handles API errors', async () => {
		mockGet.mockResolvedValueOnce({ data: undefined, error: { message: 'fail' } });

		const spaceId = ref('space-1');
		const { fetchMediaState, error } = useSpaceMediaState(spaceId);

		const result = await fetchMediaState();

		expect(result).toBeNull();
		expect(error.value).toBe('Failed to fetch media state');
	});

	it('handles exceptions', async () => {
		mockGet.mockRejectedValueOnce(new Error('boom'));

		const spaceId = ref('space-1');
		const { fetchMediaState, error } = useSpaceMediaState(spaceId);

		const result = await fetchMediaState();

		expect(result).toBeNull();
		expect(error.value).toBe('boom');
	});

	it('clears state when space changes', async () => {
		mockGet.mockResolvedValueOnce(createMockMediaStateResponse());

		const spaceId = ref('space-1');
		const { fetchMediaState, mediaState } = useSpaceMediaState(spaceId);

		await fetchMediaState();
		expect(mediaState.value).not.toBeNull();

		spaceId.value = 'space-2';
		await nextTick();

		expect(mediaState.value).toBeNull();
	});
});
