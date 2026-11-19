import { computed, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { SNAPSHOT_REFRESH_MS } from '../cameras.constants';
import type { LiveViewState } from '../live/live-view-machine';

import CameraPlayer from './camera-player.vue';

const mocks = vi.hoisted(() => ({
	state: undefined as unknown as { value: LiveViewState },
	retryInMs: undefined as unknown as { value: number | null },
	reconnect: undefined as unknown as { value: boolean },
	lastSeen: undefined as unknown as { value: Date | null },
	snapshot: { url: undefined as unknown as { value: string | null }, ageSeconds: undefined as unknown as { value: number | null } },
	snapshotArgs: [] as unknown[][],
	relayStatus: undefined as unknown as { value: unknown },
	mime: undefined as unknown as { value: string | null },
	role: undefined as unknown as { value: string },
	start: vi.fn(),
	stop: vi.fn(),
	retry: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string, params?: Record<string, unknown>) => (params ? `${key}|${JSON.stringify(params)}` : key),
	}),
}));

vi.mock('../../../common', () => ({
	injectStoresManager: () => ({
		getStore: () => ({
			get status() {
				return mocks.relayStatus.value;
			},
		}),
	}),
}));

vi.mock('../../auth/composables/useSession', () => ({
	useSession: () => ({ profile: computed(() => ({ role: mocks.role.value })) }),
}));

vi.mock('../composables/useLiveView', () => ({
	useLiveView: () => ({
		state: mocks.state,
		retryInMs: mocks.retryInMs,
		reconnect: mocks.reconnect,
		lastSeen: computed(() => mocks.lastSeen.value),
		mime: mocks.mime,
		start: mocks.start,
		stop: mocks.stop,
		retry: mocks.retry,
	}),
}));

vi.mock('../composables/useCameraSnapshot', () => ({
	useCameraSnapshot: (...args: unknown[]) => {
		mocks.snapshotArgs.push(args);

		return {
			url: mocks.snapshot.url,
			ageSeconds: mocks.snapshot.ageSeconds,
			takenAt: ref(null),
			error: ref(null),
			loading: ref(false),
			mimeType: ref(null),
			reload: vi.fn(),
		};
	},
}));

const RouterLinkStub = { props: ['to'], template: '<a data-test-id="settings-link" :data-to="JSON.stringify(to)"><slot /></a>' };

const mountPlayer = (props: Partial<InstanceType<typeof CameraPlayer>['$props']> = {}): VueWrapper =>
	mount(CameraPlayer, {
		props: { deviceId: 'cam-1', variant: 'large', ...props },
		global: { stubs: { RouterLink: RouterLinkStub, ElIcon: { template: '<i class="el-icon"><slot /></i>' }, Icon: true } },
	});

const setState = (state: LiveViewState): void => {
	mocks.state.value = state;
};

const find = (wrapper: VueWrapper, id: string) => wrapper.find(`[data-test-id="${id}"]`);

describe('CameraPlayer', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.snapshotArgs.length = 0;
		mocks.state = ref<LiveViewState>('snapshot');
		mocks.retryInMs = ref<number | null>(null);
		mocks.reconnect = ref(false);
		mocks.lastSeen = ref<Date | null>(null);
		mocks.snapshot.url = ref<string | null>('blob:snapshot');
		mocks.snapshot.ageSeconds = ref<number | null>(3);
		mocks.relayStatus = ref(null);
		mocks.mime = ref<string | null>(null);
		mocks.role = ref(UsersModuleUserRole.admin);
	});

	it('shows the snapshot age and a play button in the snapshot state', async () => {
		const wrapper = mountPlayer();

		expect(wrapper.find('img').attributes('src')).toBe('blob:snapshot');
		expect(find(wrapper, 'camera-player-age').text()).toContain('camerasModule.states.snapshotAge|{"seconds":3}');

		await find(wrapper, 'camera-player-play').trigger('click');

		expect(mocks.start).toHaveBeenCalledTimes(1);
	});

	it('omits the age when the snapshot is fresh', () => {
		mocks.snapshot.ageSeconds.value = 0;

		expect(find(mountPlayer(), 'camera-player-age').exists()).toBe(false);
	});

	it.each(['connecting', 'requesting'] as const)('dims the snapshot and shows a spinner while %s', (state) => {
		setState(state);

		const wrapper = mountPlayer();

		expect(find(wrapper, 'camera-player-connecting').exists()).toBe(true);
		expect(wrapper.find('img').classes()).toContain('is-dimmed');
		expect(find(wrapper, 'camera-player-play').exists()).toBe(false);
	});

	it('shows no connecting overlay during a seamless reconnect and keeps the snapshot visible', () => {
		setState('connecting');
		mocks.reconnect.value = true;

		const wrapper = mountPlayer();

		expect(find(wrapper, 'camera-player-connecting').exists()).toBe(false);
		expect(wrapper.find('img').exists()).toBe(true);
		expect(wrapper.find('img').classes()).not.toContain('is-dimmed');
	});

	it('shows the LIVE pill and the video while playing', () => {
		setState('playing');

		const wrapper = mountPlayer();

		expect(find(wrapper, 'camera-player-live').text()).toBe('camerasModule.states.live');
		expect(wrapper.find('video').isVisible()).toBe(true);
	});

	it('keeps the video element mounted but hidden outside playing', () => {
		const wrapper = mountPlayer();

		expect(wrapper.find('video').exists()).toBe(true);
		expect(wrapper.find('video').isVisible()).toBe(false);
	});

	it('shows a play button when playback is blocked and plays the video on click', async () => {
		setState('playing');

		const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
		const wrapper = mountPlayer();

		expect(find(wrapper, 'camera-player-resume').exists()).toBe(true);

		await find(wrapper, 'camera-player-resume').trigger('click');

		expect(play).toHaveBeenCalledTimes(1);

		await wrapper.find('video').trigger('playing');

		expect(find(wrapper, 'camera-player-resume').exists()).toBe(false);

		play.mockRestore();
	});

	it('names the supported browsers when the codec is unsupported', () => {
		setState('codec_unsupported');

		expect(find(mountPlayer(), 'camera-player-codec_unsupported').text()).toContain('camerasModule.states.codecUnsupported');
	});

	it('shows that the camera is offline and when it was last seen', () => {
		setState('offline');
		mocks.lastSeen.value = new Date('2026-11-19T10:00:00Z');

		const text = find(mountPlayer(), 'camera-player-offline').text();

		expect(text).toContain('camerasModule.states.offline');
		expect(text).toContain('camerasModule.states.lastSeen');
	});

	it('shows the relay reason sentence, Retry and the settings link for an admin when the relay is unavailable', async () => {
		setState('relay_unavailable');
		mocks.relayStatus.value = { relay: { reason: 'binary_missing' }, sessions: { max: 8, maxPerCamera: 4 } };

		const wrapper = mountPlayer();
		const overlay = find(wrapper, 'camera-player-relay_unavailable');

		expect(overlay.text()).toContain('camerasModule.states.relayUnavailable');
		expect(overlay.text()).toContain('camerasModule.relayReasons.binary_missing');
		expect(JSON.parse(find(wrapper, 'settings-link').attributes('data-to')!)).toEqual({
			name: 'config_module-config_module_edit',
			params: { module: 'cameras-module' },
		});

		await find(wrapper, 'camera-player-retry').trigger('click');

		expect(mocks.retry).toHaveBeenCalledTimes(1);
	});

	it('omits the reason sentence when the relay reason is unknown', () => {
		setState('relay_unavailable');

		expect(find(mountPlayer(), 'camera-player-relay_unavailable').text()).not.toContain('relayReasons');
	});

	it('shows the smaller of the two limits and a Retry button for the camera limit', async () => {
		setState('camera_limit');
		mocks.relayStatus.value = { relay: { reason: null }, sessions: { max: 3, maxPerCamera: 4 } };

		const wrapper = mountPlayer();

		expect(find(wrapper, 'camera-player-camera_limit').text()).toContain('camerasModule.states.cameraLimit|{"max":3}');

		await find(wrapper, 'camera-player-retry').trigger('click');

		expect(mocks.retry).toHaveBeenCalledTimes(1);
	});

	it('uses the per camera limit when it is smaller', () => {
		setState('camera_limit');
		mocks.relayStatus.value = { relay: { reason: null }, sessions: { max: 8, maxPerCamera: 2 } };

		expect(find(mountPlayer(), 'camera-player-camera_limit').text()).toContain('{"max":2}');
	});

	it('shows the total limit and a Retry button', () => {
		setState('total_limit');
		mocks.relayStatus.value = { relay: { reason: null }, sessions: { max: 8, maxPerCamera: 2 } };

		const wrapper = mountPlayer();

		expect(find(wrapper, 'camera-player-total_limit').text()).toContain('camerasModule.states.totalLimit|{"max":8}');
		expect(find(wrapper, 'camera-player-retry').exists()).toBe(true);
	});

	it('leaves the number out of the limit text without a relay status', () => {
		setState('camera_limit');

		const text = find(mountPlayer(), 'camera-player-camera_limit').text();

		expect(text).toContain('camerasModule.states.cameraLimitNoMax');
		expect(text).not.toContain('{"max"');
	});

	it('shows the module turned off state with the settings link for an owner', () => {
		setState('module_disabled');
		mocks.role.value = UsersModuleUserRole.owner;

		const wrapper = mountPlayer();

		expect(find(wrapper, 'camera-player-module_disabled').text()).toContain('camerasModule.states.moduleDisabled');
		expect(find(wrapper, 'settings-link').exists()).toBe(true);
	});

	it('hides the settings link for a regular user', () => {
		mocks.role.value = UsersModuleUserRole.user;

		for (const state of ['module_disabled', 'relay_unavailable'] as const) {
			setState(state);

			expect(find(mountPlayer(), 'settings-link').exists()).toBe(false);
		}
	});

	it('shows the countdown while an error retries and Retry only after retries stopped', async () => {
		setState('error');
		mocks.retryInMs.value = 4000;

		const wrapper = mountPlayer();

		expect(find(wrapper, 'camera-player-error').text()).toContain('camerasModule.states.error');
		expect(find(wrapper, 'camera-player-error').text()).toContain('camerasModule.states.retryingIn|{"seconds":4}');
		expect(find(wrapper, 'camera-player-retry').exists()).toBe(false);

		mocks.retryInMs.value = null;
		await wrapper.vm.$nextTick();

		expect(find(wrapper, 'camera-player-retry').exists()).toBe(true);
		expect(find(wrapper, 'camera-player-error').text()).not.toContain('retryingIn');
	});

	it('refreshes the tile snapshot every 10 s and stops refreshing while playing', () => {
		const wrapper = mountPlayer({ variant: 'tile' });
		const options = mocks.snapshotArgs[0][1] as { refreshMs: number | null; active: () => boolean };

		expect(options.refreshMs).toBe(SNAPSHOT_REFRESH_MS);
		expect(options.active()).toBe(true);

		setState('playing');

		expect(options.active()).toBe(false);

		wrapper.unmount();
	});

	it('holds the snapshot back while snapshotActive is false', () => {
		const wrapper = mountPlayer({ variant: 'tile', snapshotActive: false });
		const options = mocks.snapshotArgs[0][1] as { active: () => boolean };

		expect(options.active()).toBe(false);

		wrapper.unmount();
	});

	it('emits the negotiated mime type', async () => {
		const wrapper = mountPlayer();

		mocks.mime.value = 'video/mp4; codecs="avc1.640029"';
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('mime-change')?.[0]).toEqual(['video/mp4; codecs="avc1.640029"']);
	});

	it('does not refresh the large player snapshot on a timer', () => {
		mountPlayer({ variant: 'large' });

		expect((mocks.snapshotArgs[0][1] as { refreshMs: number | null }).refreshMs).toBeNull();
	});

	it('starts again when the profile changes while the codec is unsupported', async () => {
		setState('codec_unsupported');

		const wrapper = mountPlayer({ profile: 'high' });

		await wrapper.setProps({ profile: 'low' });

		expect(mocks.start).toHaveBeenCalledTimes(1);
	});

	it('does not start on a profile change in another state', async () => {
		const wrapper = mountPlayer({ profile: 'high' });

		await wrapper.setProps({ profile: 'low' });

		expect(mocks.start).not.toHaveBeenCalled();
	});

	it('emits state-change when the state changes', async () => {
		const wrapper = mountPlayer();

		setState('connecting');
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('state-change')).toEqual([['connecting']]);
	});

	it('exposes start, stop, retry and the video element', () => {
		const wrapper = mountPlayer();
		const exposed = wrapper.vm as unknown as { start: () => void; stop: () => void; retry: () => void; video: HTMLVideoElement | null };

		exposed.start();
		exposed.stop();
		exposed.retry();

		expect(mocks.start).toHaveBeenCalled();
		expect(mocks.stop).toHaveBeenCalled();
		expect(mocks.retry).toHaveBeenCalled();
		expect(exposed.video).toBe(wrapper.find('video').element);
	});
});
