/* eslint-disable vue/one-component-per-file -- stubs and a form around the frame */
import { defineComponent, h, reactive } from 'vue';

import { ElForm, ElSelect } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { DevicesModuleDeviceCategory } from '../../../../openapi.constants';

import type { IDeviceFormFrameModel, IDeviceFormFrameProps } from './device-form-frame.types';
import DeviceFormFrame from './device-form-frame.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../spaces/components/components', () => ({
	SpaceSelect: defineComponent({
		name: 'SpaceSelect',
		props: { modelValue: { type: String, default: null } },
		template: '<div data-test-id="space-select" />',
	}),
}));

const render = (props: Partial<IDeviceFormFrameProps> = {}, model: IDeviceFormFrameModel = {}) => {
	const state = reactive<IDeviceFormFrameModel>({
		id: 'device-1',
		identifier: 'lamp',
		name: 'Lamp',
		category: DevicesModuleDeviceCategory.lighting,
		enabled: true,
		description: '',
		roomId: null,
		...model,
	});

	const wrapper = mount(
		defineComponent({
			setup: () => () =>
				h(ElForm, { model: state }, () =>
					h(
						DeviceFormFrame,
						{
							model: state,
							categoriesOptions: [{ value: DevicesModuleDeviceCategory.lighting, label: 'Lighting' }],
							mode: 'add',
							...props,
						},
						() => h('section', { 'data-test-id': 'connection' }, 'Connection')
					)
				),
		})
	);

	return { wrapper, state };
};

const sectionOrder = (wrapper: ReturnType<typeof render>['wrapper']) =>
	wrapper
		.findAll('[data-test-id="device-form-general"], [data-test-id="connection"], [data-test-id="device-form-identifiers"]')
		.map((el) => el.attributes('data-test-id'));

describe('DeviceFormFrame', () => {
	it('puts General first, the plugin connection section next and Identifiers last', () => {
		const { wrapper } = render();

		expect(sectionOrder(wrapper)).toEqual(['device-form-general', 'connection', 'device-form-identifiers']);
	});

	it('edits the shared fields of the form model in place', async () => {
		const { wrapper, state } = render();

		await wrapper.get('input[name="name"]').setValue('Desk lamp');

		expect(state.name).toBe('Desk lamp');
	});

	it('picks the category and leaves the room out while adding', () => {
		const { wrapper } = render({ mode: 'add' });

		expect(wrapper.findComponent(ElSelect).props('disabled')).toBe(false);
		expect(wrapper.find('[data-test-id="space-select"]').exists()).toBe(false);
	});

	it('keeps the category and offers the room while editing', () => {
		const { wrapper } = render({ mode: 'edit' });

		expect(wrapper.findComponent(ElSelect).props('disabled')).toBe(true);
		expect(wrapper.find('[data-test-id="space-select"]').exists()).toBe(true);
	});

	it('shows the identifier only when asked, fixed on an existing device', () => {
		expect(render().wrapper.find('input[name="identifier"]').exists()).toBe(false);
		expect(render({ identifier: 'editable' }).wrapper.get('input[name="identifier"]').attributes('readonly')).toBeUndefined();
		expect(render({ identifier: 'readonly' }).wrapper.get('input[name="identifier"]').attributes('readonly')).toBeDefined();
	});

	it('leaves Identifiers out when it has nothing to show', () => {
		const { wrapper } = render({ showId: false });

		expect(wrapper.find('[data-test-id="device-form-identifiers"]').exists()).toBe(false);
		expect(wrapper.find('input[name="id"]').exists()).toBe(false);
	});
});
