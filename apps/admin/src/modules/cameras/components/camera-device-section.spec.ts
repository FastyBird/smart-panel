/* eslint-disable vue/one-component-per-file, vue/require-prop-types */
import { computed, defineComponent, h, reactive, ref } from 'vue';

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
	stop: vi.fn(),
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

const CameraPlayerStub = defineComponent({
	name: 'CameraPlayer',
	props: ['deviceId', 'profile', 'variant', 'snapshotActive'],
	setup: (_, { expose }) => {
		expose({ stop: mocks.stop });

		return () => h('div', { 'data-test-id': 'camera-player-stub' });
	},
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
	setup: (props) => () => h('i', { 'data-test-id': 'profile-option', title: props.label }, String(props.value)),
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

const mountSection = async (props: { active?: boolean } = {}): Promise<VueWrapper> => {
	const wrapper = mount(CameraDeviceSection, {
		props: { device, ...props },
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
		mocks.cameras = reactive({});
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

	it('labels the profiles by resolution like the live dialog', async () => {
		mocks.cameras['cam-1'] = camera({ profiles: [profile('high'), { ...profile('medium'), width: null, height: null }] });

		const wrapper = await mountSection();

		expect(wrapper.findAll('[data-test-id="profile-option"]').map((option) => option.attributes('title'))).toEqual(['1280\u00d7720', 'medium']);
	});

	it.each([
		['without an available profile', { profiles: [profile('high', false, 'camera_offline')] }],
		['with live view turned off', { liveView: false }],
	])('leaves a camera %s to the player and offers no profile selector', async (_, overrides) => {
		mocks.cameras['cam-1'] = camera(overrides);

		const wrapper = await mountSection();

		// The player shows the snapshot and the reason itself; the section keeps no second snapshot of its own.
		expect(wrapper.findComponent(CameraPlayerStub).exists()).toBe(true);
		expect(wrapper.find('[data-test-id="select"]').exists()).toBe(false);
		expect(wrapper.find('img').exists()).toBe(false);
	});

	it('stops the player and pauses snapshots while its tab is hidden', async () => {
		mocks.cameras['cam-1'] = camera();

		const wrapper = await mountSection();

		expect(wrapper.findComponent(CameraPlayerStub).props('snapshotActive')).toBe(true);
		expect(mocks.stop).not.toHaveBeenCalled();

		await wrapper.setProps({ active: false });

		expect(mocks.stop).toHaveBeenCalledTimes(1);
		expect(wrapper.findComponent(CameraPlayerStub).props('snapshotActive')).toBe(false);
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

	it('shows a load failure with Retry for a 503 and reloads on Retry', async () => {
		mocks.get.mockRejectedValueOnce(new CamerasApiException('Service unavailable', 503));

		const wrapper = await mountSection();

		expect(wrapper.find('[data-test-id="empty-state"]').text()).toBe('camerasModule.section.loadFailed');

		mocks.cameras['cam-1'] = camera();

		await wrapper.find('[data-test-id="camera-section-retry"]').trigger('click');
		await flushPromises();

		expect(mocks.get).toHaveBeenCalledTimes(2);
		expect(wrapper.find('[data-test-id="empty-state"]').exists()).toBe(false);
		expect(wrapper.findComponent(CameraPlayerStub).exists()).toBe(true);
	});

	it.each([
		['a failed load', new CamerasApiException('Service unavailable', 503), 'camerasModule.section.loadFailed'],
		['a 404', new CamerasApiException('Camera not found', 404), 'camerasModule.section.noStream'],
	])('shows the camera once a store refresh brings fresh data after %s', async (_, error, sentence) => {
		mocks.cameras['cam-1'] = camera();
		mocks.get.mockRejectedValueOnce(error);

		const wrapper = await mountSection();

		expect(wrapper.find('[data-test-id="empty-state"]').text()).toBe(sentence);

		// What the store does when a reconnect refresh or the cameras list reads the camera again.
		mocks.cameras['cam-1'] = camera();
		await flushPromises();

		expect(wrapper.find('[data-test-id="empty-state"]').exists()).toBe(false);
		expect(wrapper.findComponent(CameraPlayerStub).exists()).toBe(true);
		expect(mocks.get).toHaveBeenCalledTimes(1);
	});

	it('shows a load failure for a rejected network call, not the no stream state', async () => {
		mocks.get.mockRejectedValueOnce(new TypeError('Failed to fetch'));

		const wrapper = await mountSection();

		expect(wrapper.find('[data-test-id="empty-state"]').text()).toBe('camerasModule.section.loadFailed');
		expect(wrapper.find('[data-test-id="camera-section-retry"]').exists()).toBe(true);
	});

	it('ignores a slow failure for the previous device after a switch', async () => {
		let rejectFirst: (error: Error) => void = () => undefined;

		mocks.get.mockImplementationOnce(() => new Promise((_, reject) => (rejectFirst = reject)));
		mocks.get.mockImplementationOnce(() => Promise.resolve(mocks.cameras['cam-2']));
		mocks.cameras['cam-2'] = camera({ deviceId: 'cam-2' });

		const wrapper = await mountSection();

		await wrapper.setProps({ device: { id: 'cam-2', category: DevicesModuleDeviceCategory.camera } });
		await flushPromises();

		rejectFirst(new CamerasApiException('Service unavailable', 503));
		await flushPromises();

		expect(wrapper.find('[data-test-id="empty-state"]').exists()).toBe(false);
	});
});
