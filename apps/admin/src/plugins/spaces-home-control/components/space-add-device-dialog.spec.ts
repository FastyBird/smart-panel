import { defineComponent, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import type { IDevice } from '../../../modules/devices/store/devices.store.types';
import { SpaceType } from '../../../modules/spaces/spaces.constants';

import SpaceAddDeviceDialog from './space-add-device-dialog.vue';

// el-dialog teleports its slot content to document.body by default (outside the mounted
// wrapper's root), which wrapper.text()/wrapper.find() cannot see. Stubbing it with a template
// that renders its slots inline — the same technique used by space-media-activities-dialog.spec.ts
// — keeps the table content reachable without fighting Element Plus's teleport internals.
const elDialogStub = defineComponent({
	props: {
		modelValue: { type: Boolean },
	},
	emits: ['update:modelValue', 'close'],
	template: '<div class="el-dialog-stub"><slot /><slot name="footer" /></div>',
});

const mockDevices = ref<IDevice[]>([]);
const mockSpaceDevices = ref<IDevice[]>([]);
const mockAddDevice = vi.fn().mockResolvedValue(undefined);
const mockFindById = vi.fn(() => undefined);

vi.mock('../../../modules/devices/composables/composables', () => ({
	useDevices: () => ({
		devices: mockDevices,
	}),
}));

vi.mock('../../../modules/spaces/composables', () => ({
	useSpaceDevices: () => ({
		devices: mockSpaceDevices,
		addDevice: mockAddDevice,
	}),
	useSpaces: () => ({
		findById: mockFindById,
	}),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useFlashMessage: () => ({ success: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
	};
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

describe('SpaceAddDeviceDialog.vue', () => {
	beforeEach(() => {
		mockDevices.value = [];
		mockSpaceDevices.value = [];
	});

	it('does not offer a hidden device for a room', async () => {
		mockDevices.value = [
			{ id: 'visible', name: 'Visible device', roomId: null, hidden: false } as IDevice,
			{ id: 'concealed', name: 'Concealed device', roomId: null, hidden: true } as IDevice,
		];

		const wrapper = mount(SpaceAddDeviceDialog, {
			global: {
				stubs: {
					'el-dialog': elDialogStub,
				},
			},
			props: {
				visible: true,
				spaceId: 'room-1',
				spaceType: SpaceType.ROOM,
			},
		});

		await flushPromises();

		expect(wrapper.text()).toContain('Visible device');
		expect(wrapper.text()).not.toContain('Concealed device');
	});

	it('does not offer a hidden device for a zone', async () => {
		mockDevices.value = [
			{ id: 'visible', name: 'Visible device', roomId: null, zoneIds: [], hidden: false } as unknown as IDevice,
			{ id: 'concealed', name: 'Concealed device', roomId: null, zoneIds: [], hidden: true } as unknown as IDevice,
		];

		const wrapper = mount(SpaceAddDeviceDialog, {
			global: {
				stubs: {
					'el-dialog': elDialogStub,
				},
			},
			props: {
				visible: true,
				spaceId: 'zone-1',
				spaceType: SpaceType.ZONE,
			},
		});

		await flushPromises();

		expect(wrapper.text()).toContain('Visible device');
		expect(wrapper.text()).not.toContain('Concealed device');
	});
});
