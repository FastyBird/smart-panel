import { defineComponent, h, reactive } from 'vue';

import { ElForm } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { ILocationFormFrameModel } from './location-form-frame.types';
import LocationFormFrame from './location-form-frame.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

const render = (showId = false) => {
	const state = reactive<ILocationFormFrameModel>({ id: 'location-1', name: 'Prague' });

	const wrapper = mount(
		defineComponent({
			setup: () => () =>
				h(ElForm, { model: state }, () =>
					h(LocationFormFrame, { model: state, showId }, () => h('section', { 'data-test-id': 'provider' }, 'Open-Meteo location'))
				),
		})
	);

	return { wrapper, state };
};

describe('LocationFormFrame', () => {
	it('puts General first and the provider section after it', () => {
		const { wrapper } = render();

		expect(
			wrapper
				.findAll('[data-test-id="location-form-general"], [data-test-id="provider"], [data-test-id="location-form-identifiers"]')
				.map((el) => el.attributes('data-test-id'))
		).toEqual(['location-form-general', 'provider']);
	});

	it('edits the name of the form model in place', async () => {
		const { wrapper, state } = render();

		await wrapper.get('input[name="name"]').setValue('Brno');

		expect(state.name).toBe('Brno');
	});

	it('shows the id fixed under Identifiers when asked', () => {
		const { wrapper } = render(true);

		expect(wrapper.find('[data-test-id="location-form-identifiers"]').exists()).toBe(true);
		expect(wrapper.get('input[name="id"]').attributes('readonly')).toBeDefined();
	});
});
