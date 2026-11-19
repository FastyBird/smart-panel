/* eslint-disable vue/one-component-per-file, vue/require-prop-types */
import { defineComponent, h, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import type { ICamera } from '../store';

import CameraLiveDialog from './camera-live-dialog.vue';

const mocks = vi.hoisted(() => ({
	stop: vi.fn(),
	message: vi.fn(),
	error: undefined as unknown as { value: string | null },
	reload: vi.fn(),
	url: undefined as unknown as { value: string | null },
	mimeType: undefined as unknown as { value: string | null },
	fullscreen: vi.fn(() => Promise.resolve()),
	playerProps: [] as Record<string, unknown>[],
	emitMime: undefined as unknown as (mime: string | null) => void,
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key}|${JSON.stringify(params)}` : key) }),
}));

vi.mock('../../../common', () => ({
	useFlashMessage: () => ({ error: mocks.message, success: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

vi.mock('./camera-player.vue', async () => {
	const { defineComponent: define, h: render } = await import('vue');

	return {
		default: define({
			name: 'CameraPlayer',
			props: { deviceId: String, profile: String, variant: String, autoStart: Boolean, muted: Boolean },
			emits: ['mime-change'],
			setup(props, { expose, emit }) {
				mocks.emitMime = (mime: string | null) => emit('mime-change', mime);
				mocks.playerProps.push(props);
				expose({ stop: mocks.stop });

				return () => render('div', { 'data-test-id': 'camera-player-stub' });
			},
		}),
	};
});

vi.mock('../composables/useCameraSnapshot', () => ({
	useCameraSnapshot: () => ({
		url: mocks.url,
		ageSeconds: ref(0),
		takenAt: ref(null),
		mimeType: mocks.mimeType,
		error: mocks.error,
		loading: ref(false),
		reload: mocks.reload,
	}),
}));

const ElDialogStub = defineComponent({
	name: 'ElDialog',
	props: ['modelValue', 'title', 'fullscreen'],
	emits: ['update:modelValue'],
	setup:
		(props, { slots, emit }) =>
		() =>
			props.modelValue
				? h('div', { 'data-test-id': 'dialog', 'data-fullscreen': String(props.fullscreen) }, [
						h('button', { 'data-test-id': 'dialog-close', onClick: () => emit('update:modelValue', false) }),
						slots.default?.(),
					])
				: null,
});
const ElSegmentedStub = defineComponent({
	name: 'ElSegmented',
	props: ['modelValue', 'options'],
	emits: ['update:modelValue'],
	setup:
		(props, { emit }) =>
		() =>
			h(
				'div',
				(props.options as { value: string; label: string }[]).map((option) =>
					h('button', {
						'data-test-id': `profile-${option.value}`,
						title: (option as { label: string }).label,
						onClick: () => emit('update:modelValue', option.value),
					})
				)
			),
});
const ElSelectStub = defineComponent({
	name: 'ElSelect',
	props: ['modelValue'],
	emits: ['update:modelValue'],
	setup:
		(_, { slots, emit }) =>
		() =>
			h('div', { 'data-test-id': 'switcher' }, [
				h('button', { 'data-test-id': 'switch-to-cam-2', onClick: () => emit('update:modelValue', 'cam-2') }),
				slots.default?.(),
			]),
});
const ElOptionStub = defineComponent({ name: 'ElOption', props: ['value', 'label'], setup: (props) => () => h('i', String(props.value)) });
const ElButtonStub = defineComponent({
	name: 'ElButton',
	setup:
		(_, { slots }) =>
		() =>
			h('button', slots.default?.()),
});

const profile = (id: string, available = true, width: number | null = 1280, height: number | null = 720, fps: number | null = 25) => ({
	id,
	channelId: null,
	width,
	height,
	fps,
	videoCodec: 'h264',
	audioCodec: null,
	available,
	unavailableReason: null,
});

const cameras: ICamera[] = [
	{
		deviceId: 'cam-1',
		name: 'Front door',
		category: 'camera',
		type: 't',
		liveView: true,
		profiles: [profile('low', false), profile('high'), profile('medium', true, null, null, null)],
	},
	{ deviceId: 'cam-2', name: 'Garage', category: 'camera', type: 't', liveView: true, profiles: [profile('main')] },
];

const mountDialog = (modelValue: string | null = 'cam-1'): VueWrapper =>
	mount(CameraLiveDialog, {
		props: { cameras, modelValue },
		global: {
			stubs: {
				ElDialog: ElDialogStub,
				ElSegmented: ElSegmentedStub,
				ElSelect: ElSelectStub,
				ElOption: ElOptionStub,
				ElButton: ElButtonStub,
				Icon: true,
			},
		},
	});

describe('CameraLiveDialog', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.playerProps.length = 0;
		mocks.url = ref<string | null>('blob:snap');
		mocks.mimeType = ref<string | null>('image/png');
		mocks.error = ref<string | null>(null);
		mocks.reload.mockResolvedValue(undefined);
	});

	it('plays the first available profile with auto start, muted', () => {
		const wrapper = mountDialog();
		const player = wrapper.findComponent({ name: 'CameraPlayer' });

		expect(player.props('profile')).toBe('high');
		expect(player.props('variant')).toBe('large');
		expect(player.props('autoStart')).toBe(true);
		expect(player.props('muted')).toBe(true);
	});

	it('switching profile restarts the player with the new profile', async () => {
		const wrapper = mountDialog();

		await wrapper.find('[data-test-id="profile-medium"]').trigger('click');

		expect(wrapper.findComponent({ name: 'CameraPlayer' }).props('profile')).toBe('medium');
		// The same player instance is kept: it restarts itself when the profile prop changes.
		expect(mocks.playerProps).toHaveLength(1);
	});

	it('switching camera keeps the dialog open on the other camera', async () => {
		const wrapper = mountDialog();

		await wrapper.find('[data-test-id="switch-to-cam-2"]').trigger('click');

		expect(wrapper.emitted('update:modelValue')).toEqual([['cam-2']]);

		await wrapper.setProps({ modelValue: 'cam-2' });

		expect(wrapper.find('[data-test-id="camera-live-dialog"]').exists()).toBe(true);
		expect(wrapper.findComponent({ name: 'CameraPlayer' }).props('deviceId')).toBe('cam-2');
		expect(wrapper.findComponent({ name: 'CameraPlayer' }).props('profile')).toBe('main');
	});

	it('builds the transport line from the mime type and the profile', async () => {
		const wrapper = mountDialog();

		mocks.emitMime('video/mp4; codecs="avc1.640029,mp4a.40.2"');
		await flushPromises();

		expect(wrapper.find('[data-test-id="camera-live-dialog-transport"]').text()).toBe(
			'MSE · H.264 · AAC · 1280×720 · camerasModule.dialog.fps|{"fps":25}'
		);
	});

	it('transport line omits unknown parts', async () => {
		const wrapper = mountDialog();

		await wrapper.find('[data-test-id="profile-medium"]').trigger('click');

		expect(wrapper.find('[data-test-id="camera-live-dialog-transport"]').text()).toBe('MSE');

		mocks.emitMime('video/mp4; codecs="avc1.640029"');
		await flushPromises();

		expect(wrapper.find('[data-test-id="camera-live-dialog-transport"]').text()).toBe('MSE · H.264');
	});

	it('closing stops the player', async () => {
		const wrapper = mountDialog();

		await wrapper.find('[data-test-id="dialog-close"]').trigger('click');

		expect(mocks.stop).toHaveBeenCalled();
		expect(wrapper.emitted('update:modelValue')).toEqual([[null]]);
	});

	it('stops the player when the parent clears the model', async () => {
		const wrapper = mountDialog();

		await wrapper.setProps({ modelValue: null });

		expect(mocks.stop).toHaveBeenCalled();
	});

	it('downloads a fresh snapshot named after the camera and the blob type', async () => {
		const wrapper = mountDialog();
		const clicks: HTMLAnchorElement[] = [];
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
			clicks.push(this);
		});

		await wrapper.find('[data-test-id="camera-live-dialog-snapshot"]').trigger('click');
		await flushPromises();

		expect(mocks.reload).toHaveBeenCalledWith({ hq: true });
		expect(clicks).toHaveLength(1);
		expect(clicks[0].href).toBe('blob:snap');
		expect(clicks[0].download).toMatch(/^Front door-\d{4}-\d{2}-\d{2}T[\d-]+Z\.png$/);

		click.mockRestore();
	});

	it('does not download the previous image when a new snapshot fails', async () => {
		const wrapper = mountDialog();
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

		mocks.reload.mockImplementation(() => {
			mocks.error.value = 'failed';

			return Promise.resolve();
		});

		await wrapper.find('[data-test-id="camera-live-dialog-snapshot"]').trigger('click');
		await flushPromises();

		expect(mocks.url.value).toBe('blob:snap');
		expect(click).not.toHaveBeenCalled();
		expect(mocks.message).toHaveBeenCalledWith('camerasModule.dialog.snapshotFailed');

		click.mockRestore();
	});

	it('reports a failed snapshot when there is no image at all', async () => {
		const wrapper = mountDialog();
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

		mocks.url.value = null;
		mocks.error.value = 'offline';

		await wrapper.find('[data-test-id="camera-live-dialog-snapshot"]').trigger('click');
		await flushPromises();

		expect(click).not.toHaveBeenCalled();
		expect(mocks.message).toHaveBeenCalledWith('camerasModule.dialog.snapshotFailed');

		click.mockRestore();
	});

	it('labels profiles with their resolution, falling back to the id', () => {
		const wrapper = mountDialog();

		expect(wrapper.find('[data-test-id="profile-high"]').attributes('title')).toBe('1280\u00d7720');
		expect(wrapper.find('[data-test-id="profile-medium"]').attributes('title')).toBe('medium');
	});

	it('clears the model when the open camera disappears', async () => {
		const wrapper = mountDialog();

		await wrapper.setProps({ cameras: [cameras[1]] });

		expect(wrapper.emitted('update:modelValue')).toEqual([[null]]);
	});

	it('toggles mute and requests full screen on the player element', async () => {
		const wrapper = mountDialog();

		await wrapper.find('[data-test-id="camera-live-dialog-mute"]').trigger('click');

		expect(wrapper.findComponent({ name: 'CameraPlayer' }).props('muted')).toBe(false);

		const element = wrapper.findComponent({ name: 'CameraPlayer' }).element as HTMLElement;

		element.requestFullscreen = mocks.fullscreen;

		await wrapper.find('[data-test-id="camera-live-dialog-fullscreen"]').trigger('click');

		expect(mocks.fullscreen).toHaveBeenCalledTimes(1);
	});

	it('goes full screen on tablet landscape widths', async () => {
		const listeners: ((event: { matches: boolean }) => void)[] = [];

		window.matchMedia = vi.fn(() => ({
			matches: true,
			addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.push(listener),
			removeEventListener: vi.fn(),
		})) as unknown as typeof window.matchMedia;

		const wrapper = mountDialog();

		await flushPromises();

		expect(wrapper.find('[data-test-id="camera-live-dialog"]').attributes('data-fullscreen')).toBe('true');
		expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1024px) and (max-width: 1279px)');

		// @ts-expect-error restore the jsdom default of no matchMedia
		delete window.matchMedia;
	});
});
