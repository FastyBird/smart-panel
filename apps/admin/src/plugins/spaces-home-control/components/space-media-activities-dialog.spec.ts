import { defineComponent, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { SpaceType } from '../../../modules/spaces/spaces.constants';
import type { IDerivedMediaEndpoint, IMediaActivityBinding } from '../composables/useSpaceMedia';

// --- Shared mutable state for mocks ---
const state: {
	endpoints: IDerivedMediaEndpoint[];
	bindings: IMediaActivityBinding[];
} = {
	endpoints: [],
	bindings: [],
};

const mockFetchEndpoints = vi.fn().mockResolvedValue(undefined);
const mockFetchBindings = vi.fn().mockResolvedValue(undefined);
const mockFetchActiveState = vi.fn().mockResolvedValue(undefined);

vi.mock('../composables/useSpaceMedia', async () => {
	const { computed, ref } = await import('vue');

	return {
		useSpaceMedia: () => ({
			endpoints: computed(() => state.endpoints),
			activeState: ref(null),
			fetchingEndpoints: ref(false),
			fetchingBindings: ref(false),
			activating: ref(false),
			deactivating: ref(false),
			applyingDefaults: ref(false),
			activationError: ref(null),
			fetchEndpoints: mockFetchEndpoints,
			fetchBindings: mockFetchBindings,
			fetchActiveState: mockFetchActiveState,
			activate: vi.fn().mockResolvedValue({}),
			saveBinding: vi.fn().mockResolvedValue({}),
			createBinding: vi.fn().mockResolvedValue({}),
			deleteBinding: vi.fn().mockResolvedValue(undefined),
			applyDefaults: vi.fn().mockResolvedValue(undefined),
			findBindingByActivity: (key: string) => state.bindings.find((b) => b.activityKey === key),
			endpointsByType: (type: string) => computed(() => state.endpoints.filter((ep) => ep.type === type)),
		}),
		MediaActivityKey: {
			watch: 'watch',
			listen: 'listen',
			gaming: 'gaming',
			background: 'background',
		},
		MediaEndpointType: {
			display: 'display',
			audio_output: 'audio_output',
			source: 'source',
			remote_target: 'remote_target',
		},
		getActivityColor: () => 'primary' as const,
		getActivityIcon: (key: string) => {
			const icons: Record<string, string> = {
				watch: 'mdi:television-play',
				listen: 'mdi:music',
				gaming: 'mdi:controller',
				background: 'mdi:music-note',
			};

			return icons[key] || 'mdi:help-circle';
		},
	};
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', () => ({
	useFlashMessage: () => ({
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
	}),
}));

import SpaceMediaActivitiesDialog from './space-media-activities-dialog.vue';

// --- Test fixtures ---

const mockDisplayEp: IDerivedMediaEndpoint = {
	endpointId: 'ep-display-1',
	spaceId: 'space-1',
	deviceId: 'dev-1',
	type: 'display' as IDerivedMediaEndpoint['type'],
	name: 'Living Room TV',
	capabilities: {
		power: true,
		volume: false,
		mute: false,
		playback: false,
		track: false,
		inputSelect: true,
		remoteCommands: false,
	},
	links: {
		inputSelect: {
			propertyId: 'prop-1',
			dataType: 'enum',
			format: ['hdmi1', 'hdmi2', 'hdmi3'],
		},
	},
};

const mockAudioEp: IDerivedMediaEndpoint = {
	endpointId: 'ep-audio-1',
	spaceId: 'space-1',
	deviceId: 'dev-2',
	type: 'audio_output' as IDerivedMediaEndpoint['type'],
	name: 'AV Receiver',
	capabilities: {
		power: true,
		volume: true,
		mute: true,
		playback: false,
		track: false,
		inputSelect: false,
		remoteCommands: false,
	},
};

const mockSourceEp: IDerivedMediaEndpoint = {
	endpointId: 'ep-source-1',
	spaceId: 'space-1',
	deviceId: 'dev-3',
	type: 'source' as IDerivedMediaEndpoint['type'],
	name: 'Apple TV',
	capabilities: {
		power: true,
		volume: false,
		mute: false,
		playback: true,
		track: true,
		inputSelect: false,
		remoteCommands: false,
	},
};

const mockRemoteEp: IDerivedMediaEndpoint = {
	endpointId: 'ep-remote-1',
	spaceId: 'space-1',
	deviceId: 'dev-4',
	type: 'remote_target' as IDerivedMediaEndpoint['type'],
	name: 'IR Blaster',
	capabilities: {
		power: false,
		volume: false,
		mute: false,
		playback: false,
		track: false,
		inputSelect: false,
		remoteCommands: true,
	},
};

const allEndpoints = [mockDisplayEp, mockAudioEp, mockSourceEp, mockRemoteEp];

const mockWatchBinding: IMediaActivityBinding = {
	id: 'binding-1',
	spaceId: 'space-1',
	activityKey: 'watch' as IMediaActivityBinding['activityKey'],
	displayEndpointId: 'ep-display-1',
	audioEndpointId: 'ep-audio-1',
	sourceEndpointId: 'ep-source-1',
	remoteEndpointId: 'ep-remote-1',
	displayInputId: 'hdmi1',
	audioInputId: null,
	sourceInputId: null,
	audioVolumePreset: 50,
	createdAt: '2024-01-01T00:00:00Z',
	updatedAt: null,
};

const mockSpace = {
	id: 'space-1',
	name: 'Living Room',
	description: null,
	type: SpaceType.ROOM,
	category: null,
	icon: null,
	displayOrder: 0,
	parentId: null,
	suggestionsEnabled: false,
	statusWidgets: null,
	createdAt: new Date(),
	updatedAt: null,
	draft: false,
};

// --- Lightweight Element Plus stubs ---

const elDialogStub = defineComponent({
	props: {
		modelValue: { type: Boolean },
	},
	emits: ['update:modelValue', 'open', 'close'],
	mounted() {
		this.$emit('open');
	},
	template: '<div class="el-dialog-stub"><slot /><slot name="footer" /></div>',
});

const stubs = {
	'el-dialog': elDialogStub,
	'el-collapse': { template: '<div class="collapse-stub"><slot /></div>' },
	'el-collapse-item': {
		template: '<div class="collapse-item-stub" :data-name="name"><slot name="title" /><slot /></div>',
		props: ['name'],
	},
	'el-form': { template: '<div class="form-stub"><slot /></div>' },
	'el-form-item': {
		template: '<div class="form-item-stub">{{ label }}<slot /></div>',
		props: ['label'],
	},
	'el-select': {
		template: '<div class="select-stub"><slot /></div>',
		props: ['modelValue', 'placeholder', 'clearable'],
	},
	'el-option': {
		template: '<div class="option-stub" :data-value="value">{{ label }}</div>',
		props: ['label', 'value'],
	},
	'el-slider': {
		template: '<div class="slider-stub"></div>',
		props: ['modelValue', 'min', 'max', 'showInput'],
	},
	'el-tag': {
		template: '<span class="tag-stub"><slot /></span>',
		props: ['type', 'size', 'round', 'effect'],
	},
	'el-button': {
		template: '<button class="button-stub"><slot /><slot name="icon" /></button>',
		props: ['size', 'type', 'circle', 'loading', 'disabled', 'title', 'plain'],
	},
	'el-alert': {
		template: '<div class="alert-stub">{{ title }} {{ description }}<slot /></div>',
		props: ['type', 'closable', 'showIcon', 'title', 'description'],
	},
	'el-input': {
		template: '<input class="input-stub" />',
		props: ['modelValue', 'placeholder', 'clearable'],
	},
	'el-icon': { template: '<i class="icon-stub"><slot /></i>' },
	Icon: { template: '<i />' },
};

describe('SpaceMediaActivitiesDialog', () => {
	let wrapper: VueWrapper;

	const createWrapper = async (): Promise<void> => {
		wrapper = mount(SpaceMediaActivitiesDialog, {
			props: {
				visible: true,
				space: mockSpace,
			},
			global: {
				stubs,
				directives: {
					loading: () => {},
				},
			},
		});

		// Wait for onDialogOpen async handler to complete
		await flushPromises();
		await nextTick();
		await flushPromises();
	};

	const findCollapseItems = () => wrapper.findAll('.collapse-item-stub');

	const findCollapseItemByName = (name: string) => {
		return wrapper.findAll('.collapse-item-stub').find((el) => el.attributes('data-name') === name)!;
	};

	beforeEach(() => {
		state.endpoints = [...allEndpoints];
		state.bindings = [mockWatchBinding];
		vi.clearAllMocks();
		mockFetchEndpoints.mockResolvedValue(undefined);
		mockFetchBindings.mockResolvedValue(undefined);
		mockFetchActiveState.mockResolvedValue(undefined);
	});

	afterEach(() => {
		wrapper?.unmount();
	});

	describe('form rendering', () => {
		it('renders all 4 activity collapse panels', async () => {
			await createWrapper();

			const items = findCollapseItems();

			expect(items).toHaveLength(4);

			const names = items.map((item) => item.attributes('data-name'));

			expect(names).toEqual(['watch', 'listen', 'gaming', 'background']);
		});

		it('calls fetch methods when dialog opens', async () => {
			await createWrapper();

			expect(mockFetchEndpoints).toHaveBeenCalledOnce();
			expect(mockFetchBindings).toHaveBeenCalledOnce();
			expect(mockFetchActiveState).toHaveBeenCalledOnce();
		});

		it('shows configured status for activity with binding', async () => {
			await createWrapper();

			const watchPanel = findCollapseItemByName('watch');

			expect(watchPanel.text()).toContain('spacesModule.media.activities.status.configured');
		});

		it('shows unconfigured status for activity without binding', async () => {
			await createWrapper();

			const listenPanel = findCollapseItemByName('listen');

			expect(listenPanel.text()).toContain('spacesModule.media.activities.status.unconfigured');
		});
	});

	describe('filtering logic', () => {
		it('shows display input override when endpoint has inputSelect capability', async () => {
			await createWrapper();

			const watchPanel = findCollapseItemByName('watch');

			expect(watchPanel.text()).toContain('spacesModule.media.activities.overrides.displayInput');
		});

		it('shows volume slider when audio endpoint has volume capability', async () => {
			await createWrapper();

			const watchPanel = findCollapseItemByName('watch');
			const sliders = watchPanel.findAll('.slider-stub');

			expect(sliders).toHaveLength(1);
		});

		it('hides overrides for activity without configured endpoints', async () => {
			await createWrapper();

			const listenPanel = findCollapseItemByName('listen');

			expect(listenPanel.text()).not.toContain('spacesModule.media.activities.overrides.displayInput');
			expect(listenPanel.text()).not.toContain('spacesModule.media.activities.overrides.audioInput');
			expect(listenPanel.text()).not.toContain('spacesModule.media.activities.overrides.audioVolume');

			const sliders = listenPanel.findAll('.slider-stub');

			expect(sliders).toHaveLength(0);
		});

		it('configured activity has more options than unconfigured due to override selects', async () => {
			await createWrapper();

			const watchPanel = findCollapseItemByName('watch');
			const listenPanel = findCollapseItemByName('listen');

			const watchOptions = watchPanel.findAll('.option-stub');
			const listenOptions = listenPanel.findAll('.option-stub');

			// Watch: 4 main selects × 1 endpoint each + 3 input override options = 7
			expect(watchOptions.length).toBeGreaterThan(listenOptions.length);

			// Listen: 4 main selects × 1 endpoint each = 4
			expect(listenOptions).toHaveLength(4);
		});

		it('each endpoint type select shows only one option per type', async () => {
			await createWrapper();

			// With 1 endpoint per type, all unconfigured activities should have exactly 4 options
			// (display, audio, source, remote — one each)
			const gamingPanel = findCollapseItemByName('gaming');
			const backgroundPanel = findCollapseItemByName('background');

			expect(gamingPanel.findAll('.option-stub')).toHaveLength(4);
			expect(backgroundPanel.findAll('.option-stub')).toHaveLength(4);
		});
	});
});
