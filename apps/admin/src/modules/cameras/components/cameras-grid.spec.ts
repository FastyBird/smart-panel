/* eslint-disable vue/one-component-per-file, vue/require-prop-types */
import { computed, defineComponent, h, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { CamerasApiException } from '../cameras.exceptions';
import type { ICamera } from '../store';

import CamerasGrid from './cameras-grid.vue';

const mocks = vi.hoisted(() => ({
	cameras: undefined as unknown as { value: unknown[] },
	rooms: {} as Record<string, string>,
	deviceRooms: undefined as unknown as { value: Record<string, string | null> },
	fetch: vi.fn(),
	devicesFetch: vi.fn(),
	spacesFetch: vi.fn(),
	release: vi.fn(),
	startPolling: vi.fn(),
	role: undefined as unknown as { value: string },
}));

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

vi.mock('../../../common', async () => {
	const { defineComponent: define, h: render } = await import('vue');
	const { camerasStoreKey, relayStatusStoreKey } = await import('../store/keys');
	const { devicesStoreKey } = await import('../../devices/store/keys');
	const { spacesStoreKey } = await import('../../spaces/store/keys');

	const stores = new Map<symbol, unknown>([
		[camerasStoreKey, { fetch: mocks.fetch, findAll: () => mocks.cameras.value }],
		[relayStatusStoreKey, { status: null, startPolling: mocks.startPolling }],
		[devicesStoreKey, { fetch: mocks.devicesFetch, findById: (id: string) => ({ roomId: mocks.deviceRooms.value[id] ?? null }) }],
		[spacesStoreKey, { fetch: mocks.spacesFetch, findById: (id: string) => (mocks.rooms[id] ? { id, name: mocks.rooms[id] } : null) }],
	]);

	return {
		injectStoresManager: () => ({ getStore: (key: symbol) => stores.get(key) }),
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

const CameraTileStub = defineComponent({
	name: 'CameraTile',
	props: ['camera', 'roomName'],
	emits: ['open'],
	setup:
		(props, { emit }) =>
		() =>
			h('button', { 'data-test-id': 'tile', onClick: () => emit('open', (props.camera as ICamera).deviceId) }, String(props.roomName)),
});
const CameraLiveDialogStub = defineComponent({
	name: 'CameraLiveDialog',
	props: ['modelValue', 'cameras'],
	setup: (props) => () => h('div', { 'data-test-id': 'dialog', 'data-open': String(props.modelValue) }),
});
const ElCheckTagStub = defineComponent({
	name: 'ElCheckTag',
	props: ['checked'],
	emits: ['change'],
	setup:
		(props, { slots, emit }) =>
		() =>
			h('button', { 'data-test-id': 'chip', 'data-checked': String(props.checked), onClick: () => emit('change', true) }, slots.default?.()),
});

const camera = (deviceId: string, name: string): ICamera => ({ deviceId, name, category: 'camera', type: 't', liveView: true, profiles: [] });

const mountGrid = async (): Promise<VueWrapper> => {
	const wrapper = mount(CamerasGrid, {
		global: {
			stubs: {
				CameraTile: CameraTileStub,
				CameraLiveDialog: CameraLiveDialogStub,
				RelayStatusChip: true,
				ElCheckTag: ElCheckTagStub,
				ElLink: { template: '<span><slot /></span>' },
				RouterLink: { template: '<a data-test-id="settings-link"><slot /></a>' },
			},
		},
	});

	await flushPromises();

	return wrapper;
};

describe('CamerasGrid', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.cameras = ref([camera('cam-1', 'Front door'), camera('cam-2', 'Kitchen'), camera('cam-3', 'Yard')]);
		mocks.rooms = { 'room-a': 'Hall', 'room-b': 'Kitchen room' };
		mocks.deviceRooms = ref<Record<string, string | null>>({ 'cam-1': 'room-a', 'cam-2': 'room-b', 'cam-3': null });
		mocks.fetch.mockResolvedValue([]);
		mocks.devicesFetch.mockResolvedValue([]);
		mocks.spacesFetch.mockResolvedValue([]);
		mocks.startPolling.mockReturnValue(mocks.release);
		mocks.role = ref(UsersModuleUserRole.admin);
	});

	it('fetches the cameras, devices and spaces on mount', async () => {
		await mountGrid();

		expect(mocks.fetch).toHaveBeenCalledTimes(1);
		expect(mocks.devicesFetch).toHaveBeenCalledTimes(1);
		expect(mocks.spacesFetch).toHaveBeenCalledTimes(1);
	});

	it('shows a chip per room that has a camera, plus All', async () => {
		const wrapper = await mountGrid();

		expect(wrapper.findAll('.cameras-grid__chips button').map((chip) => chip.text())).toEqual([
			'camerasModule.grid.allSpaces',
			'Hall',
			'Kitchen room',
		]);
		expect(wrapper.findAll('[data-test-id="tile"]')).toHaveLength(3);
	});

	it('filters cameras by space chip', async () => {
		const wrapper = await mountGrid();

		await wrapper.findAll('.cameras-grid__chips button')[2].trigger('click');

		expect(wrapper.findAll('[data-test-id="tile"]').map((tile) => tile.text())).toEqual(['Kitchen room']);

		await wrapper.findAll('.cameras-grid__chips button')[0].trigger('click');

		expect(wrapper.findAll('[data-test-id="tile"]')).toHaveLength(3);
	});

	it('resets the selection to All when the selected room loses its cameras', async () => {
		const wrapper = await mountGrid();

		await wrapper.findAll('.cameras-grid__chips button')[2].trigger('click');

		mocks.cameras.value = [camera('cam-1', 'Front door'), camera('cam-3', 'Yard')];
		await flushPromises();

		expect(wrapper.findAll('.cameras-grid__chips button')[0].attributes('data-checked')).toBe('true');
		expect(wrapper.findAll('[data-test-id="tile"]')).toHaveLength(2);
	});

	it('opens the dialog for the clicked tile', async () => {
		const wrapper = await mountGrid();

		expect(wrapper.find('[data-test-id="dialog"]').attributes('data-open')).toBe('null');

		await wrapper.findAll('[data-test-id="tile"]')[1].trigger('click');

		expect(wrapper.find('[data-test-id="dialog"]').attributes('data-open')).toBe('cam-2');
	});

	it('shows the empty state without cameras', async () => {
		mocks.cameras.value = [];

		const wrapper = await mountGrid();

		expect(wrapper.find('[data-test-id="cameras-grid-empty"] [data-test-id="empty-state"]').text()).toBe('camerasModule.grid.empty');
	});

	it('shows the module turned off state with a settings link for admins', async () => {
		mocks.cameras.value = [];
		mocks.fetch.mockRejectedValue(new CamerasApiException('Cameras module is disabled', 404));

		const wrapper = await mountGrid();

		expect(wrapper.find('[data-test-id="cameras-grid-module-disabled"]').text()).toContain('camerasModule.states.moduleDisabled');
		expect(wrapper.find('[data-test-id="settings-link"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="cameras-grid-empty"]').exists()).toBe(false);

		mocks.role.value = UsersModuleUserRole.user;

		expect((await mountGrid()).find('[data-test-id="settings-link"]').exists()).toBe(false);
	});

	it('shows a load failure for any other error', async () => {
		mocks.cameras.value = [];
		mocks.fetch.mockRejectedValue(new CamerasApiException('boom', 500));

		const wrapper = await mountGrid();

		expect(wrapper.find('[data-test-id="cameras-grid-load-failed"]').exists()).toBe(true);
	});

	it('offers Retry after a load failure and shows the cameras once a retry succeeds', async () => {
		mocks.cameras.value = [];
		mocks.fetch.mockRejectedValueOnce(new CamerasApiException('Service unavailable', 503));

		const wrapper = await mountGrid();

		expect(wrapper.find('[data-test-id="cameras-grid-load-failed"]').exists()).toBe(true);

		mocks.fetch.mockImplementationOnce(async () => {
			mocks.cameras.value = [camera('cam-1', 'Front door')];

			return mocks.cameras.value;
		});

		await wrapper.find('[data-test-id="cameras-grid-retry"]').trigger('click');
		await flushPromises();

		expect(mocks.fetch).toHaveBeenCalledTimes(2);
		expect(wrapper.find('[data-test-id="cameras-grid-load-failed"]').exists()).toBe(false);
		expect(wrapper.findAll('[data-test-id="tile"]')).toHaveLength(1);
	});

	it('keeps the cached cameras on a failed refresh, shows the failure with Retry and clears it once a retry succeeds', async () => {
		mocks.fetch.mockRejectedValueOnce(new CamerasApiException('Service unavailable', 503));

		const wrapper = await mountGrid();

		expect(wrapper.findAll('[data-test-id="tile"]')).toHaveLength(3);
		expect(wrapper.find('[data-test-id="cameras-grid-load-failed"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="cameras-grid-refresh-failed"]').text()).toContain('camerasModule.grid.loadFailed');

		await wrapper.find('[data-test-id="cameras-grid-refresh-retry"]').trigger('click');
		await flushPromises();

		expect(mocks.fetch).toHaveBeenCalledTimes(2);
		expect(wrapper.find('[data-test-id="cameras-grid-refresh-failed"]').exists()).toBe(false);
		expect(wrapper.findAll('[data-test-id="tile"]')).toHaveLength(3);
	});

	it('shows no refresh failure after a successful load', async () => {
		const wrapper = await mountGrid();

		expect(wrapper.find('[data-test-id="cameras-grid-refresh-failed"]').exists()).toBe(false);
	});

	it('holds relay polling while mounted and releases it on unmount', async () => {
		const wrapper = await mountGrid();

		expect(mocks.startPolling).toHaveBeenCalledTimes(1);
		expect(mocks.release).not.toHaveBeenCalled();

		wrapper.unmount();

		expect(mocks.release).toHaveBeenCalledTimes(1);
	});
});
