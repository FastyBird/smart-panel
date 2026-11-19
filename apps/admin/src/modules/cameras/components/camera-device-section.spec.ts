/* eslint-disable vue/one-component-per-file, vue/require-prop-types */
import { computed, defineComponent, h, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { DevicesModuleDeviceCategory, UsersModuleUserRole } from '../../../openapi.constants';
import type { IDevice } from '../../devices/store/devices.store.types';
import { CamerasApiException } from '../cameras.exceptions';
import type { ICamera } from '../store';

import CameraDeviceSection from './camera-device-section.vue';

const mocks = vi.hoisted(() => ({
	cameras: {} as Record<string, unknown>,
	get: vi.fn(),
	role: undefined as unknown as { value: string },
}));

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

vi.mock('../../../common', async () => {
	const { defineComponent: define, h: render } = await import('vue');

	return {
		injectStoresManager: () => ({
			getStore: () => ({
				get: mocks.get,
				findById: (id: string) => mocks.cameras[id] ?? null,
			}),
		}),
		EmptyState: define({
			props: ['description'],
			setup:
				(props, { slots }) =>
				() =>
					render('div', [render('p', { 'data-test-id': 'empty-state' }, props.description), slots.default?.()]),
		}),
	};
});

vi.mock('../../auth/composables/useSession', () => ({
	useSession: () => ({ profile: computed(() => ({ role: mocks.role.value })) }),
}));

vi.mock('../composables/useCameraSnapshot', () => ({
	useCameraSnapshot: () => ({
		url: ref('blob:snapshot'),
		ageSeconds: ref(0),
		takenAt: ref(null),
		error: ref(null),
		loading: ref(false),
		reload: vi.fn(),
	}),
}));

const CameraPlayerStub = defineComponent({
	name: 'CameraPlayer',
	props: ['deviceId', 'profile', 'variant'],
	setup: () => () => h('div', { 'data-test-id': 'camera-player-stub' }),
});

const ElSelectStub = defineComponent({
	name: 'ElSelect',
	props: ['modelValue'],
	setup:
		(_, { slots }) =>
		() =>
			h('div', { 'data-test-id': 'select' }, slots.default?.()),
});
const ElOptionStub = defineComponent({
	name: 'ElOption',
	props: ['value', 'label'],
	setup: (props) => () => h('i', { 'data-test-id': 'profile-option' }, String(props.value)),
});
const CameraProfilesTableStub = defineComponent({
	name: 'CameraProfilesTable',
	props: ['camera'],
	setup: () => () => h('div', { 'data-test-id': 'profiles-table' }),
});

const profile = (id: string, available = true, unavailableReason: string | null = null): ICamera['profiles'][number] => ({
	id,
	channelId: null,
	width: 1280,
	height: 720,
	fps: 25,
	videoCodec: 'h264',
	audioCodec: null,
	available,
	unavailableReason,
});

const camera = (overrides: Partial<ICamera> = {}): ICamera => ({
	deviceId: 'cam-1',
	name: 'Front door',
	category: 'camera',
	type: 'devices-unifi-protect',
	liveView: true,
	profiles: [profile('low', false, 'stream_not_enabled'), profile('high'), profile('medium')],
	...overrides,
});

const device = { id: 'cam-1', category: DevicesModuleDeviceCategory.camera } as IDevice;

const mountSection = async (): Promise<VueWrapper> => {
	const wrapper = mount(CameraDeviceSection, {
		props: { device },
		global: {
			stubs: {
				CameraPlayer: CameraPlayerStub,
				CameraProfilesTable: CameraProfilesTableStub,
				ElSelect: ElSelectStub,
				ElOption: ElOptionStub,
				RouterLink: { template: '<a data-test-id="settings-link"><slot /></a>' },
				Icon: true,
			},
		},
	});

	await flushPromises();

	return wrapper;
};

describe('CameraDeviceSection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.cameras = {};
		mocks.role = ref(UsersModuleUserRole.admin);
		mocks.get.mockImplementation(() => Promise.resolve(mocks.cameras['cam-1']));
	});

	it('lists only available profiles in the selector and selects the first one', async () => {
		mocks.cameras['cam-1'] = camera();

		const wrapper = await mountSection();

		expect(wrapper.findAll('[data-test-id="profile-option"]').map((option) => option.text())).toEqual(['high', 'medium']);
		expect(wrapper.findComponent(CameraPlayerStub).props()).toMatchObject({ deviceId: 'cam-1', profile: 'high', variant: 'large' });
		expect(mocks.get).toHaveBeenCalledWith({ deviceId: 'cam-1' });
	});

	it('renders the profiles table', async () => {
		mocks.cameras['cam-1'] = camera();

		expect((await mountSection()).find('[data-test-id="profiles-table"]').exists()).toBe(true);
	});

	it('never offers live view for a camera without an available profile', async () => {
		mocks.cameras['cam-1'] = camera({ profiles: [profile('high', false, 'camera_offline')] });

		const wrapper = await mountSection();

		expect(wrapper.findComponent(CameraPlayerStub).exists()).toBe(false);
		expect(wrapper.find('img').attributes('src')).toBe('blob:snapshot');
		expect(wrapper.find('[data-test-id="camera-section-reason"]').text()).toContain('camerasModule.reasons.camera_offline');
		expect(wrapper.find('[data-test-id="camera-player-play"]').exists()).toBe(false);
	});

	it('never offers live view for a camera with live view turned off', async () => {
		mocks.cameras['cam-1'] = camera({ liveView: false });

		const wrapper = await mountSection();

		expect(wrapper.findComponent(CameraPlayerStub).exists()).toBe(false);
		expect(wrapper.find('img').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="camera-section-reason"]').exists()).toBe(true);
	});

	it('shows the empty state on 404', async () => {
		mocks.get.mockRejectedValue(new CamerasApiException('Camera not found', 404));

		const wrapper = await mountSection();

		expect(wrapper.find('[data-test-id="empty-state"]').text()).toBe('camerasModule.section.noStream');
		expect(wrapper.findComponent(CameraPlayerStub).exists()).toBe(false);
	});

	it('shows the module turned off state on a disabled module 404', async () => {
		mocks.get.mockRejectedValue(new CamerasApiException('Cameras module is disabled', 404));

		const wrapper = await mountSection();

		expect(wrapper.find('[data-test-id="empty-state"]').text()).toBe('camerasModule.states.moduleDisabled');
		expect(wrapper.find('[data-test-id="settings-link"]').exists()).toBe(true);
	});

	it('hides the settings link from a regular user', async () => {
		mocks.role.value = UsersModuleUserRole.user;
		mocks.get.mockRejectedValue(new CamerasApiException('Cameras module is disabled', 404));

		expect((await mountSection()).find('[data-test-id="settings-link"]').exists()).toBe(false);
	});
});
