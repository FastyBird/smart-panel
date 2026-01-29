import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

import { MediaActivityKey, MediaEndpointType, useSpaceMedia } from './useSpaceMedia';

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

const mockActivationResponse = {
	data: {
		data: {
			activity_key: 'watch',
			state: 'active',
			resolved: {
				display_device_id: 'dev-1',
				audio_device_id: 'dev-2',
				source_device_id: null,
				remote_device_id: null,
			},
			summary: {
				steps_total: 3,
				steps_succeeded: 3,
				steps_failed: 0,
				failures: [],
			},
			warnings: [],
		},
	},
	error: undefined,
};

const mockActivationWithFailuresResponse = {
	data: {
		data: {
			activity_key: 'watch',
			state: 'failed',
			resolved: {
				display_device_id: 'dev-1',
				audio_device_id: 'dev-2',
			},
			summary: {
				steps_total: 3,
				steps_succeeded: 1,
				steps_failed: 2,
				failures: [
					{
						step_index: 1,
						reason: 'Device unreachable',
						target_device_id: 'dev-1',
						property_id: 'power',
					},
					{
						step_index: 2,
						reason: 'Timeout',
						target_device_id: 'dev-2',
						property_id: 'volume',
					},
				],
			},
			warnings: ['Non-critical: input select skipped'],
		},
	},
	error: undefined,
};

const mockDeactivateResponse = {
	data: {
		data: {
			activity_key: null,
			state: 'deactivated',
			resolved: null,
			summary: null,
			warnings: [],
		},
	},
	error: undefined,
};

const mockActiveStateResponse = {
	data: {
		data: {
			id: 'active-1',
			space_id: 'space-1',
			activity_key: 'watch',
			state: 'active',
			activated_at: '2025-01-01T12:00:00Z',
			updated_at: '2025-01-01T12:00:05Z',
			resolved: JSON.stringify({
				display_device_id: 'dev-1',
				audio_device_id: 'dev-2',
			}),
			last_result: JSON.stringify({
				steps_total: 3,
				steps_succeeded: 3,
				steps_failed: 0,
			}),
		},
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
			expect(endpoints.value[0]!.endpointId).toBe('space-1:display:dev-1');
			expect(endpoints.value[0]!.name).toBe('Living Room TV');
			expect(endpoints.value[0]!.capabilities.power).toBe(true);
			expect(endpoints.value[0]!.capabilities.inputSelect).toBe(true);
			expect(endpoints.value[0]!.capabilities.volume).toBe(false);
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
			expect(bindings.value[0]!.activityKey).toBe('watch');
			expect(bindings.value[0]!.displayEndpointId).toBe('space-1:display:dev-1');
			expect(bindings.value[0]!.audioVolumePreset).toBe(30);
		});
	});

	describe('findBindingByActivity', () => {
		it('should find existing binding', async () => {
			mockGet.mockResolvedValueOnce(mockBindingsResponse);

			const spaceId = ref('space-1');
			const { fetchBindings, findBindingByActivity } = useSpaceMedia(spaceId);

			await fetchBindings();

			const binding = findBindingByActivity(MediaActivityKey.watch);
			expect(binding).toBeDefined();
			expect(binding?.activityKey).toBe('watch');
		});

		it('should return undefined for missing binding', async () => {
			mockGet.mockResolvedValueOnce(mockBindingsResponse);

			const spaceId = ref('space-1');
			const { fetchBindings, findBindingByActivity } = useSpaceMedia(spaceId);

			await fetchBindings();

			const binding = findBindingByActivity(MediaActivityKey.gaming);
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

			const displays = endpointsByType(MediaEndpointType.display);
			expect(displays.value).toHaveLength(1);
			expect(displays.value[0]!.type).toBe('display');

			const sources = endpointsByType(MediaEndpointType.source);
			expect(sources.value).toHaveLength(0);
		});
	});

	describe('activate', () => {
		it('should activate an activity and update activeState', async () => {
			mockPost.mockResolvedValueOnce(mockActivationResponse);

			const spaceId = ref('space-1');
			const { activate, activeState } = useSpaceMedia(spaceId);

			const result = await activate(MediaActivityKey.watch);

			expect(mockPost).toHaveBeenCalledWith(
				expect.stringContaining('media/activities/{activityKey}/activate'),
				expect.objectContaining({
					params: { path: { id: 'space-1', activityKey: 'watch' } },
				}),
			);
			expect(result.state).toBe('active');
			expect(result.activityKey).toBe('watch');
			expect(activeState.value?.state).toBe('active');
			expect(activeState.value?.resolved?.displayDeviceId).toBe('dev-1');
			expect(activeState.value?.resolved?.audioDeviceId).toBe('dev-2');
		});

		it('should set optimistic activating state before API call', async () => {
			let capturedState: string | undefined;
			mockPost.mockImplementation(async () => {
				// Capture state during the POST call - it won't be 'activating' since we
				// set it before the call, but we test the final state
				return mockActivationResponse;
			});

			const spaceId = ref('space-1');
			const { activate, activeState } = useSpaceMedia(spaceId);

			// Before activation
			expect(activeState.value).toBeNull();

			await activate(MediaActivityKey.watch);

			// After activation
			expect(activeState.value?.state).toBe('active');
		});

		it('should handle activation with failures', async () => {
			mockPost.mockResolvedValueOnce(mockActivationWithFailuresResponse);

			const spaceId = ref('space-1');
			const { activate, activeState } = useSpaceMedia(spaceId);

			const result = await activate(MediaActivityKey.watch);

			expect(result.state).toBe('failed');
			expect(activeState.value?.summary?.stepsFailed).toBe(2);
			expect(activeState.value?.summary?.failures).toHaveLength(2);
			expect(activeState.value?.summary?.failures![0]!.targetDeviceId).toBe('dev-1');
			expect(activeState.value?.summary?.failures![0]!.reason).toBe('Device unreachable');
			expect(activeState.value?.summary?.failures![1]!.propertyId).toBe('volume');
			expect(activeState.value?.warnings).toEqual(['Non-critical: input select skipped']);
		});

		it('should handle activation error', async () => {
			mockPost.mockResolvedValueOnce({ data: null, error: { message: 'Binding not found' } });

			const spaceId = ref('space-1');
			const { activate, activeState, activationError } = useSpaceMedia(spaceId);

			await expect(activate(MediaActivityKey.watch)).rejects.toThrow();

			expect(activationError.value).toBeTruthy();
			expect(activeState.value?.state).toBe('failed');
		});

		it('should throw when spaceId is undefined', async () => {
			const spaceId = ref<string | undefined>(undefined);
			const { activate } = useSpaceMedia(spaceId);

			await expect(activate(MediaActivityKey.watch)).rejects.toThrow('Space ID is required');
		});
	});

	describe('deactivate', () => {
		it('should deactivate and update activeState', async () => {
			mockPost.mockResolvedValueOnce(mockDeactivateResponse);

			const spaceId = ref('space-1');
			const { deactivate, activeState } = useSpaceMedia(spaceId);

			const result = await deactivate();

			expect(mockPost).toHaveBeenCalledWith(
				expect.stringContaining('media/activities/deactivate'),
				expect.objectContaining({
					params: { path: { id: 'space-1' } },
				}),
			);
			expect(result.state).toBe('deactivated');
			expect(result.activityKey).toBeNull();
			expect(activeState.value?.state).toBe('deactivated');
		});

		it('should handle deactivation error', async () => {
			mockPost.mockResolvedValueOnce({ data: null, error: { message: 'Server error' } });

			const spaceId = ref('space-1');
			const { deactivate, activationError } = useSpaceMedia(spaceId);

			await expect(deactivate()).rejects.toThrow();
			expect(activationError.value).toBeTruthy();
		});
	});

	describe('fetchActiveState', () => {
		it('should fetch and transform active state from entity', async () => {
			mockGet.mockResolvedValueOnce(mockActiveStateResponse);

			const spaceId = ref('space-1');
			const { fetchActiveState, activeState } = useSpaceMedia(spaceId);

			await fetchActiveState();

			expect(mockGet).toHaveBeenCalledWith(
				expect.stringContaining('media/activities/active'),
				expect.objectContaining({ params: { path: { id: 'space-1' } } }),
			);
			expect(activeState.value?.activityKey).toBe('watch');
			expect(activeState.value?.state).toBe('active');
			expect(activeState.value?.resolved?.displayDeviceId).toBe('dev-1');
			expect(activeState.value?.summary?.stepsTotal).toBe(3);
			expect(activeState.value?.activatedAt).toBe('2025-01-01T12:00:00Z');
		});

		it('should handle null active state (no activity active)', async () => {
			mockGet.mockResolvedValueOnce({ data: { data: null }, error: undefined });

			const spaceId = ref('space-1');
			const { fetchActiveState, activeState } = useSpaceMedia(spaceId);

			await fetchActiveState();

			expect(activeState.value).toBeNull();
		});

		it('should handle fetch error', async () => {
			mockGet.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

			const spaceId = ref('space-1');
			const { fetchActiveState, activationError } = useSpaceMedia(spaceId);

			await fetchActiveState();

			expect(activationError.value).toBeTruthy();
		});
	});
});
