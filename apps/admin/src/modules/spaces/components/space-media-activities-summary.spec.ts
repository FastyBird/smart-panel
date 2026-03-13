import { defineComponent, h, ref } from 'vue';

import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaActivityKey, type IMediaActiveState, type IMediaStepFailure } from '../composables/useSpaceMedia';

import SpaceMediaActivitiesSummary from './space-media-activities-summary.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', () => ({
	useFlashMessage: () => ({
		success: vi.fn(),
		error: vi.fn(),
	}),
}));

const mockEndpoints = ref<{ endpointId: string; deviceId: string; name: string; type: string; capabilities: Record<string, boolean> }[]>([]);
const mockActiveState = ref<IMediaActiveState | null>(null);
const mockDeactivating = ref(false);
const mockFetchEndpoints = vi.fn().mockResolvedValue(undefined);
const mockFetchBindings = vi.fn().mockResolvedValue(undefined);
const mockFetchActiveState = vi.fn().mockResolvedValue(undefined);
const mockDeactivate = vi.fn().mockResolvedValue({ state: 'deactivated', activityKey: null });
const mockPreview = vi.fn().mockResolvedValue({ resolved: {}, plan: [], warnings: [] });
const mockFindBindingByActivity = vi.fn().mockReturnValue(undefined);

vi.mock('../composables/useSpaceMedia', async (importOriginal) => {
	const original = await importOriginal<typeof import('../composables/useSpaceMedia')>();

	return {
		...original,
		useSpaceMedia: () => ({
			endpoints: mockEndpoints,
			activeState: mockActiveState,
			fetchEndpoints: mockFetchEndpoints,
			fetchBindings: mockFetchBindings,
			fetchActiveState: mockFetchActiveState,
			deactivate: mockDeactivate,
			deactivating: mockDeactivating,
			findBindingByActivity: mockFindBindingByActivity,
			preview: mockPreview,
		}),
	};
});

// Stub that always renders its default slot (bypasses el-dialog teleport + v-model visibility)
const DialogStub = defineComponent({
	name: 'ElDialog',
	inheritAttrs: false,
	setup(_props, { slots }) {
		return () => h('div', { class: 'dialog-stub' }, slots.default?.());
	},
});

const mountOpts = {
	global: {
		stubs: {
			'el-dialog': DialogStub,
		},
	},
};

const openPreviewDialog = async (wrapper: ReturnType<typeof mount>): Promise<void> => {
	// Find the tag by its DOM element (el-tag renders as span.el-tag)
	const tagEls = wrapper.findAll('.el-tag');
	const watchTag = tagEls.find((el) => el.text().includes('spacesModule.media.activityLabels.watch'));

	if (watchTag) {
		await watchTag.trigger('click');
		await flushPromises();
		await new Promise((resolve) => setTimeout(resolve, 50));
		await flushPromises();
	}
};

describe('SpaceMediaActivitiesSummary', () => {
	let wrapper: ReturnType<typeof mount>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockEndpoints.value = [
			{
				endpointId: 'space-1:display:dev-1',
				deviceId: 'dev-1',
				name: 'Living Room TV',
				type: 'display',
				capabilities: { power: true, inputSelect: true, volume: false, mute: false, playback: false, track: false, remoteCommands: false },
			},
			{
				endpointId: 'space-1:audio_output:dev-2',
				deviceId: 'dev-2',
				name: 'AV Receiver',
				type: 'audio_output',
				capabilities: { power: true, volume: true, mute: true, inputSelect: true, playback: false, track: false, remoteCommands: false },
			},
		];
		mockActiveState.value = null;
		mockDeactivating.value = false;
	});

	afterEach(() => {
		wrapper?.unmount();
	});

	it('renders the component when endpoints are loaded', async () => {
		wrapper = mount(SpaceMediaActivitiesSummary, {
			props: { space: { id: 'space-1' } as never },
			...mountOpts,
		});
		await flushPromises();

		expect(wrapper.exists()).toBe(true);
	});

	it('renders failed state tag when active state is failed', async () => {
		mockActiveState.value = {
			activityKey: MediaActivityKey.watch,
			state: 'failed',
			resolved: { displayDeviceId: 'dev-1', audioDeviceId: 'dev-2' },
			summary: {
				stepsTotal: 3,
				stepsSucceeded: 1,
				stepsFailed: 2,
				failures: [
					{ stepIndex: 1, critical: true, reason: 'Device unreachable', targetDeviceId: 'dev-1', propertyId: 'power' },
					{ stepIndex: 2, critical: false, reason: 'Timeout', targetDeviceId: 'dev-2', propertyId: 'volume' },
				],
			},
			warnings: ['Non-critical: input select skipped'],
			activatedAt: '2025-01-01T12:00:00Z',
		};

		mockFindBindingByActivity.mockReturnValue({
			activityKey: MediaActivityKey.watch,
			displayEndpointId: 'space-1:display:dev-1',
			audioEndpointId: 'space-1:audio_output:dev-2',
			sourceEndpointId: null,
			remoteEndpointId: null,
		});

		mockPreview.mockResolvedValue({
			resolved: { displayDeviceId: 'dev-1', audioDeviceId: 'dev-2' },
			plan: [],
			warnings: [],
		});

		wrapper = mount(SpaceMediaActivitiesSummary, {
			props: { space: { id: 'space-1' } as never },
			...mountOpts,
		});
		await flushPromises();

		await openPreviewDialog(wrapper);

		const html = wrapper.html();

		expect(html).toContain('spacesModule.media.activities.activationState.failed');
	});

	it('renders failures table with step details in preview dialog', async () => {
		const failures: IMediaStepFailure[] = [
			{ stepIndex: 1, critical: true, reason: 'Device unreachable', targetDeviceId: 'dev-1', propertyId: 'power' },
			{ stepIndex: 2, critical: false, reason: 'Timeout', targetDeviceId: 'dev-2', propertyId: 'volume' },
		];

		mockActiveState.value = {
			activityKey: MediaActivityKey.watch,
			state: 'failed',
			resolved: { displayDeviceId: 'dev-1', audioDeviceId: 'dev-2' },
			summary: { stepsTotal: 3, stepsSucceeded: 1, stepsFailed: 2, failures },
			activatedAt: '2025-01-01T12:00:00Z',
		};

		mockFindBindingByActivity.mockReturnValue({
			activityKey: MediaActivityKey.watch,
			displayEndpointId: 'space-1:display:dev-1',
			audioEndpointId: 'space-1:audio_output:dev-2',
			sourceEndpointId: null,
			remoteEndpointId: null,
		});

		mockPreview.mockResolvedValue({
			resolved: { displayDeviceId: 'dev-1', audioDeviceId: 'dev-2' },
			plan: [],
			warnings: [],
		});

		wrapper = mount(SpaceMediaActivitiesSummary, {
			props: { space: { id: 'space-1' } as never },
			...mountOpts,
		});
		await flushPromises();

		await openPreviewDialog(wrapper);

		const html = wrapper.html();

		// Should render the failures section
		expect(html).toContain('spacesModule.media.activities.failures.title');
		// Should show failure reasons
		expect(html).toContain('Device unreachable');
		expect(html).toContain('Timeout');
		// Should show failure stats
		expect(html).toContain('spacesModule.media.activities.failures.total');
		expect(html).toContain('spacesModule.media.activities.failures.succeeded');
		expect(html).toContain('spacesModule.media.activities.failures.failed');
	});

	it('does not render failures section when there are no failures', async () => {
		mockActiveState.value = {
			activityKey: MediaActivityKey.watch,
			state: 'active',
			resolved: { displayDeviceId: 'dev-1', audioDeviceId: 'dev-2' },
			summary: { stepsTotal: 3, stepsSucceeded: 3, stepsFailed: 0, failures: [] },
			activatedAt: '2025-01-01T12:00:00Z',
		};

		mockFindBindingByActivity.mockReturnValue({
			activityKey: MediaActivityKey.watch,
			displayEndpointId: 'space-1:display:dev-1',
			audioEndpointId: 'space-1:audio_output:dev-2',
			sourceEndpointId: null,
			remoteEndpointId: null,
		});

		mockPreview.mockResolvedValue({
			resolved: { displayDeviceId: 'dev-1', audioDeviceId: 'dev-2' },
			plan: [],
			warnings: [],
		});

		wrapper = mount(SpaceMediaActivitiesSummary, {
			props: { space: { id: 'space-1' } as never },
			...mountOpts,
		});
		await flushPromises();

		await openPreviewDialog(wrapper);

		const html = wrapper.html();

		// Should NOT render failures section when no failures
		expect(html).not.toContain('spacesModule.media.activities.failures.title');
	});

	it('shows deactivate button when an activity is active', async () => {
		mockActiveState.value = {
			activityKey: MediaActivityKey.watch,
			state: 'active',
			resolved: { displayDeviceId: 'dev-1' },
			summary: { stepsTotal: 1, stepsSucceeded: 1, stepsFailed: 0 },
			activatedAt: '2025-01-01T12:00:00Z',
		};

		mockFindBindingByActivity.mockReturnValue({
			activityKey: MediaActivityKey.watch,
			displayEndpointId: 'space-1:display:dev-1',
			audioEndpointId: null,
			sourceEndpointId: null,
			remoteEndpointId: null,
		});

		mockPreview.mockResolvedValue({
			resolved: { displayDeviceId: 'dev-1' },
			plan: [],
			warnings: [],
		});

		wrapper = mount(SpaceMediaActivitiesSummary, {
			props: { space: { id: 'space-1' } as never },
			...mountOpts,
		});
		await flushPromises();

		await openPreviewDialog(wrapper);

		const html = wrapper.html();

		expect(html).toContain('spacesModule.media.activities.deactivate');
	});

	it('resolves device names from endpoints for failures', async () => {
		mockActiveState.value = {
			activityKey: MediaActivityKey.watch,
			state: 'failed',
			resolved: { displayDeviceId: 'dev-1' },
			summary: {
				stepsTotal: 1,
				stepsSucceeded: 0,
				stepsFailed: 1,
				failures: [
					{ stepIndex: 0, critical: true, reason: 'Connection refused', targetDeviceId: 'dev-1', propertyId: 'power' },
				],
			},
			activatedAt: '2025-01-01T12:00:00Z',
		};

		mockFindBindingByActivity.mockReturnValue({
			activityKey: MediaActivityKey.watch,
			displayEndpointId: 'space-1:display:dev-1',
			audioEndpointId: null,
			sourceEndpointId: null,
			remoteEndpointId: null,
		});

		mockPreview.mockResolvedValue({
			resolved: { displayDeviceId: 'dev-1' },
			plan: [],
			warnings: [],
		});

		wrapper = mount(SpaceMediaActivitiesSummary, {
			props: { space: { id: 'space-1' } as never },
			...mountOpts,
		});
		await flushPromises();

		await openPreviewDialog(wrapper);

		const html = wrapper.html();

		// Should resolve device ID to name
		expect(html).toContain('Living Room TV');
		expect(html).toContain('Connection refused');
	});
});
