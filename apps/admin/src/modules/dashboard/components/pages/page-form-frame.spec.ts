/* eslint-disable vue/one-component-per-file -- stubs and a form around the frame */
import { defineComponent, h, reactive } from 'vue';

import { ElForm } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IPageFormFrameModel } from './page-form-frame.types';
import PageFormFrame from './page-form-frame.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../displays', () => ({
	DisplaysMultiSelect: defineComponent({
		name: 'DisplaysMultiSelect',
		props: { modelValue: { type: Array, default: null } },
		template: '<div data-test-id="displays-select" />',
	}),
}));

const render = (withPluginSection = true) => {
	const state = reactive<IPageFormFrameModel>({
		id: 'page-1',
		title: 'Living room',
		icon: null,
		order: 0,
		showTopBar: true,
		displays: null,
	});

	const wrapper = mount(
		defineComponent({
			setup: () => () =>
				h(ElForm, { model: state }, () =>
					h(PageFormFrame, { model: state }, withPluginSection ? () => h('section', { 'data-test-id': 'plugin' }, 'Grid') : undefined)
				),
		})
	);

	return { wrapper, state };
};

describe('PageFormFrame', () => {
	it('puts General first, the plugin sections next and Identifiers last', () => {
		const { wrapper } = render();

		expect(
			wrapper
				.findAll('[data-test-id="page-form-general"], [data-test-id="plugin"], [data-test-id="page-form-identifiers"]')
				.map((el) => el.attributes('data-test-id'))
		).toEqual(['page-form-general', 'plugin', 'page-form-identifiers']);
	});

	it('edits the shared fields of the form model in place', async () => {
		const { wrapper, state } = render();

		await wrapper.get('input[name="title"]').setValue('Kitchen');

		expect(state.title).toBe('Kitchen');
	});

	it('shows the page id fixed under Identifiers', () => {
		const { wrapper } = render(false);

		const id = wrapper.get('[data-test-id="page-form-identifiers"] input[name="id"]');

		expect((id.element as HTMLInputElement).value).toBe('page-1');
		expect(id.attributes('readonly')).toBeDefined();
	});
});
