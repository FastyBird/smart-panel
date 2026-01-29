import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

import { useSpaceMedia } from './useSpaceMedia';

const mockGet = vi.fn();
const mockPatch = vi.fn();
const mockPost = vi.fn();

vi.mock('../../../common', () => ({
	useBackend: () => ({
		client: {
			GET: mockGet,
			PATCH: mockPatch,
			POST: mockPost,
		},
	}),
	useFlashMessage: () => ({
		success: vi.fn(),
		error: vi.fn(),
	}),
}));

const mockEndpointsResponse = {
	data: {
		data: {
			space_id: 'space-1',
			endpoints: [
				{
					endpoint_id: 'space-1:display:dev-1',
					space_id: 'space-1',
					device_id: 'dev-1',
					type: 'display',
					name: 'Living Room TV',
					capabilities: {
						power: true,
						volume: false,
						mute: false,
						playback: false,
						track: false,
						input_select: true,
						remote_commands: false,
					},
				},
				{
					endpoint_id: 'space-1:audio_output:dev-2',
					space_id: 'space-1',
					device_id: 'dev-2',
					type: 'audio_output',
					name: 'AV Receiver',
					capabilities: {
						power: true,
						volume: true,
						mute: true,
						playback: false,
						track: false,
						input_select: true,
						remote_commands: false,
					},
				},
			],
		},
	},
	error: undefined,
};

const mockBindingsResponse = {
	data: {
		data: [
			{
				id: 'binding-1',
				space_id: 'space-1',
				activity_key: 'watch',
				display_endpoint_id: 'space-1:display:dev-1',
				audio_endpoint_id: 'space-1:audio_output:dev-2',
				source_endpoint_id: null,
				remote_endpoint_id: null,
				display_input_id: 'HDMI1',
				audio_volume_preset: 30,
				created_at: '2025-01-01T00:00:00Z',
				updated_at: null,
			},
		],
	},
	error: undefined,
};

describe('useSpaceMedia', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('fetchEndpoints', () => {
		it('should fetch and transform endpoints', async () => {
			mockGet.mockResolvedValueOnce(mockEndpointsResponse);

			const spaceId = ref('space-1');
			const { endpoints, fetchEndpoints } = useSpaceMedia(spaceId);

			await fetchEndpoints();

			expect(mockGet).toHaveBeenCalledWith(
				expect.stringContaining('media/endpoints'),
				expect.objectContaining({ params: { path: { id: 'space-1' } } }),
			);
			expect(endpoints.value).toHaveLength(2);
			expect(endpoints.value[0].endpointId).toBe('space-1:display:dev-1');
			expect(endpoints.value[0].name).toBe('Living Room TV');
			expect(endpoints.value[0].capabilities.power).toBe(true);
			expect(endpoints.value[0].capabilities.inputSelect).toBe(true);
			expect(endpoints.value[0].capabilities.volume).toBe(false);
		});

		it('should not fetch when spaceId is undefined', async () => {
			const spaceId = ref<string | undefined>(undefined);
			const { fetchEndpoints } = useSpaceMedia(spaceId);

			await fetchEndpoints();

			expect(mockGet).not.toHaveBeenCalled();
		});

		it('should handle fetch error', async () => {
			mockGet.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

			const spaceId = ref('space-1');
			const { endpointsError, fetchEndpoints } = useSpaceMedia(spaceId);

			await fetchEndpoints();

			expect(endpointsError.value).toBeTruthy();
		});
	});

	describe('fetchBindings', () => {
		it('should fetch and transform bindings', async () => {
			mockGet.mockResolvedValueOnce(mockBindingsResponse);

			const spaceId = ref('space-1');
			const { bindings, fetchBindings } = useSpaceMedia(spaceId);

			await fetchBindings();

			expect(bindings.value).toHaveLength(1);
			expect(bindings.value[0].activityKey).toBe('watch');
			expect(bindings.value[0].displayEndpointId).toBe('space-1:display:dev-1');
			expect(bindings.value[0].audioVolumePreset).toBe(30);
		});
	});

	describe('findBindingByActivity', () => {
		it('should find existing binding', async () => {
			mockGet.mockResolvedValueOnce(mockBindingsResponse);

			const spaceId = ref('space-1');
			const { fetchBindings, findBindingByActivity } = useSpaceMedia(spaceId);

			await fetchBindings();

			const binding = findBindingByActivity('watch' as any);
			expect(binding).toBeDefined();
			expect(binding?.activityKey).toBe('watch');
		});

		it('should return undefined for missing binding', async () => {
			mockGet.mockResolvedValueOnce(mockBindingsResponse);

			const spaceId = ref('space-1');
			const { fetchBindings, findBindingByActivity } = useSpaceMedia(spaceId);

			await fetchBindings();

			const binding = findBindingByActivity('gaming' as any);
			expect(binding).toBeUndefined();
		});
	});

	describe('saveBinding', () => {
		it('should update existing binding', async () => {
			const updatedBinding = {
				...mockBindingsResponse.data.data[0],
				audio_volume_preset: 50,
			};
			mockPatch.mockResolvedValueOnce({ data: { data: updatedBinding }, error: undefined });
			mockGet.mockResolvedValueOnce(mockBindingsResponse);

			const spaceId = ref('space-1');
			const { fetchBindings, saveBinding } = useSpaceMedia(spaceId);

			await fetchBindings();

			const result = await saveBinding('binding-1', { audioVolumePreset: 50 });

			expect(mockPatch).toHaveBeenCalledWith(
				expect.stringContaining('media/bindings'),
				expect.objectContaining({
					params: { path: { id: 'space-1', bindingId: 'binding-1' } },
				}),
			);
			expect(result.audioVolumePreset).toBe(50);
		});
	});

	describe('applyDefaults', () => {
		it('should call apply-defaults and update bindings', async () => {
			mockPost.mockResolvedValueOnce(mockBindingsResponse);

			const spaceId = ref('space-1');
			const { bindings, applyDefaults } = useSpaceMedia(spaceId);

			await applyDefaults();

			expect(mockPost).toHaveBeenCalledWith(
				expect.stringContaining('apply-defaults'),
				expect.objectContaining({ params: { path: { id: 'space-1' } } }),
			);
			expect(bindings.value).toHaveLength(1);
		});
	});

	describe('endpointsByType', () => {
		it('should filter endpoints by type', async () => {
			mockGet.mockResolvedValueOnce(mockEndpointsResponse);

			const spaceId = ref('space-1');
			const { fetchEndpoints, endpointsByType } = useSpaceMedia(spaceId);

			await fetchEndpoints();

			const displays = endpointsByType('display' as any);
			expect(displays.value).toHaveLength(1);
			expect(displays.value[0].type).toBe('display');

			const sources = endpointsByType('source' as any);
			expect(sources.value).toHaveLength(0);
		});
	});
});
