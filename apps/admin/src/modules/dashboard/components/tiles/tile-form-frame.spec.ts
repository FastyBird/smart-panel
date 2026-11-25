import { defineComponent, h, reactive } from 'vue';

import { ElForm } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { ITileFormFrameModel, ITileFormFrameProps } from './tile-form-frame.types';
import TileFormFrame from './tile-form-frame.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

const render = (props: Partial<Omit<ITileFormFrameProps, 'model'>> = {}) => {
	const state = reactive<ITileFormFrameModel>({ id: 'tile-1', row: 1, col: 2, rowSpan: 1, colSpan: 1 });

	const wrapper = mount(
		defineComponent({
			setup: () => () =>
				h(ElForm, { model: state }, () => h(TileFormFrame, { model: state, ...props }, () => h('section', { 'data-test-id': 'plugin' }, 'Scene'))),
		})
	);

	return { wrapper, state };
};

describe('TileFormFrame', () => {
	it('puts Position and size first, the plugin sections next and Identifiers last', () => {
		const { wrapper } = render();

		expect(
			wrapper
				.findAll('[data-test-id="tile-form-placement"], [data-test-id="plugin"], [data-test-id="tile-form-identifiers"]')
				.map((el) => el.attributes('data-test-id'))
		).toEqual(['tile-form-placement', 'plugin', 'tile-form-identifiers']);
	});

	it('shows the position and the size as asked', () => {
		const sizeOnly = render({ withPosition: false }).wrapper;

		expect(sizeOnly.find('input[name="row"]').exists()).toBe(false);
		expect(sizeOnly.find('input[name="rowSpan"]').exists()).toBe(true);

		const positionOnly = render({ withSize: false }).wrapper;

		expect(positionOnly.find('input[name="col"]').exists()).toBe(true);
		expect(positionOnly.find('input[name="colSpan"]').exists()).toBe(false);
	});

	it('leaves Position and size out where the page places and sizes its tiles', () => {
		const { wrapper } = render({ withPosition: false, withSize: false });

		expect(wrapper.find('[data-test-id="tile-form-placement"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="plugin"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="tile-form-identifiers"]').exists()).toBe(true);
	});
});
