import { defineComponent, h, reactive } from 'vue';

import { ElForm } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IDataSourceFormFrameModel } from './data-source-form-frame.types';
import DataSourceFormFrame from './data-source-form-frame.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

describe('DataSourceFormFrame', () => {
	it('puts the plugin sections first and Identifiers last', () => {
		const state = reactive<IDataSourceFormFrameModel>({ id: 'source-1' });

		const wrapper = mount(
			defineComponent({
				setup: () => () =>
					h(ElForm, { model: state }, () =>
						h(DataSourceFormFrame, { model: state }, () => h('section', { 'data-test-id': 'plugin' }, 'Device property'))
					),
			})
		);

		expect(
			wrapper.findAll('[data-test-id="plugin"], [data-test-id="data-source-form-identifiers"]').map((el) => el.attributes('data-test-id'))
		).toEqual(['plugin', 'data-source-form-identifiers']);
		expect((wrapper.get('input[name="id"]').element as HTMLInputElement).value).toBe('source-1');
	});
});
