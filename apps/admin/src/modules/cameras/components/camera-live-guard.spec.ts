/* eslint-disable vue/require-prop-types */
import { computed, defineComponent, h, reactive } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { UsersModuleUserRole } from '../../../openapi.constants';
import type { ICamera } from '../store';

import CameraLiveDialog from './camera-live-dialog.vue';
import CameraTile from './camera-tile.vue';

// The dialog and the tile with the real player and the real live view: only the backend, the stores and the session are
// faked, so a session request shows up as a POST.

const mocks = vi.hoisted(() => ({
	post: vi.fn(),
	get: vi.fn(),
	cameras: {} as Record<string, unknown>,
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key, locale: { value: 'en-US' } }),
}));

vi.mock('../../../common', async () => {
	const { camerasStoreKey, relayStatusStoreKey } = await import('../store/keys');
	const { devicesStoreKey } = await import('../../devices/store/keys');
	const { DevicesModuleDeviceConnectionStatus: Status } = await import('../../../openapi.constants');

	const stores = new Map<symbol, unknown>([
		[camerasStoreKey, { findById: (id: string) => mocks.cameras[id] ?? null, get: vi.fn() }],
		[relayStatusStoreKey, { status: null, get: vi.fn(), startPolling: () => () => undefined }],
		[devicesStoreKey, { findById: (id: string) => ({ id, status: { online: true, status: Status.connected, lastChanged: null } }), get: vi.fn() }],
	]);

	return {
		useBackend: () => ({ client: { POST: mocks.post, GET: mocks.get } }),
		useLogger: () => ({ log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
		useFlashMessage: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() }),
		injectStoresManager: () => ({ getStore: (key: symbol) => stores.get(key) }),
	};
});

vi.mock('../../auth/composables/useSession', () => ({
	useSession: () => ({ profile: computed(() => ({ role: UsersModuleUserRole.user })) }),
}));

const ElDialogStub = defineComponent({
	name: 'ElDialog',
	props: ['modelValue'],
	setup:
		(props, { slots }) =>
		() =>
			props.modelValue ? h('div', slots.default?.()) : null,
});

const profile = (id: string, available: boolean): ICamera['profiles'][number] => ({
	id,
	channelId: null,
	width: 1280,
	height: 720,
	fps: 25,
	videoCodec: 'h264',
	audioCodec: null,
	available,
	unavailableReason: available ? null : 'stream_not_enabled',
});

const camera = (deviceId: string, overrides: Partial<ICamera> = {}): ICamera => ({
	deviceId,
	name: deviceId,
	category: 'camera',
	type: 't',
	liveView: true,
	profiles: [profile('high', true)],
	...overrides,
});

const stubs = { ElDialog: ElDialogStub, Icon: true, RouterLink: true };

describe('live view guard for cameras that cannot stream', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.cameras = reactive({
			'cam-live': camera('cam-live'),
			'cam-no-provider': camera('cam-no-provider', { liveView: false, profiles: [] }),
			'cam-no-profile': camera('cam-no-profile', { profiles: [profile('high', false)] }),
		});
		mocks.post.mockReturnValue(new Promise(() => undefined));
		mocks.get.mockReturnValue(new Promise(() => undefined));
		vi.stubGlobal('MediaSource', { isTypeSupported: () => true });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it.each(['cam-no-provider', 'cam-no-profile'])('the dialog never posts a session for %s', async (deviceId) => {
		const wrapper = mount(CameraLiveDialog, {
			props: { cameras: Object.values(mocks.cameras) as ICamera[], modelValue: deviceId },
			global: { stubs },
		});

		await flushPromises();

		expect(mocks.post).not.toHaveBeenCalled();
		expect(wrapper.find('[data-test-id="camera-player-live-off"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="camera-player-error"]').exists()).toBe(false);

		wrapper.unmount();
	});

	it('the dialog posts a session for a camera that can stream', async () => {
		const wrapper = mount(CameraLiveDialog, {
			props: { cameras: Object.values(mocks.cameras) as ICamera[], modelValue: 'cam-live' },
			global: { stubs },
		});

		await flushPromises();

		expect(mocks.post).toHaveBeenCalledTimes(1);

		wrapper.unmount();
	});

	it.each([
		['cam-no-provider', true],
		['cam-no-profile', true],
		['cam-live', false],
	])('the tile of %s shows the live view off badge: %s', (deviceId, expected) => {
		const wrapper = mount(CameraTile, { props: { camera: mocks.cameras[deviceId] as ICamera }, global: { stubs } });

		const badge = wrapper.find('[data-test-id="camera-player-live-off"]');

		expect(badge.exists()).toBe(expected);

		if (expected) {
			expect(badge.text()).toContain('camerasModule.states.liveOff');
		}

		expect(mocks.post).not.toHaveBeenCalled();

		wrapper.unmount();
	});
});
