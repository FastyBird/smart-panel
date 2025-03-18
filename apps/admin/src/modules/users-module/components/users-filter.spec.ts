import { type ComponentPublicInstance } from 'vue';
import { createI18n } from 'vue-i18n';

import { ElButton, ElInput, ElSelect } from 'element-plus';
import { afterEach, describe, expect, it } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import enUS from '../locales/en-US.json';
import { UserRole } from '../users.constants';

import { UsersFilter } from './index';
import type { IUsersFilterProps } from './users-filter.types';

type UsersFilterInstance = ComponentPublicInstance<IUsersFilterProps>;

describe('UsersFilter', (): void => {
	let wrapper: VueWrapper<UsersFilterInstance>;

	const createWrapper = (props: Partial<IUsersFilterProps> = {}): void => {
		const i18n = createI18n({
			locale: 'en',
			messages: {
				en: {
					usersModule: enUS,
				},
			},
		});

		wrapper = mount(UsersFilter, {
			global: {
				plugins: [i18n],
			},
			props: {
				filters: { search: '', role: '' },
				remoteFormReset: false,
				...props,
			},
		});
	};

	afterEach((): void => {
		wrapper.unmount();
	});

	it('renders correctly', (): void => {
		createWrapper();

		expect(wrapper.findComponent(ElInput).exists()).toBe(true);
		expect(wrapper.findComponent(ElSelect).exists()).toBe(true);

		expect(wrapper.findComponent(ElButton).exists()).toBe(false);
	});

	it('renders correctly with filter', (): void => {
		createWrapper({
			filters: { search: 'name', role: '' },
		});

		expect(wrapper.findComponent(ElInput).exists()).toBe(true);
		expect(wrapper.findComponent(ElSelect).exists()).toBe(true);

		expect(wrapper.findComponent(ElButton).exists()).toBe(true);
	});

	it('updates search filter', async (): Promise<void> => {
		createWrapper();

		const input = wrapper.findComponent(ElInput);

		expect(input.exists()).toBe(true);

		await input.setValue('admin');
		await input.trigger('input');

		input.vm.$emit('input', 'admin');

		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('update:filters')).toBeTruthy();
		expect(wrapper.emitted('update:filters')?.[0]).toEqual([{ search: 'admin', role: '' }]);
	});

	it('updates role filter', async (): Promise<void> => {
		createWrapper();

		const select = wrapper.findComponent(ElSelect);

		expect(select.exists()).toBe(true);

		await select.setValue(UserRole.ADMIN);
		await select.trigger('change');

		select.vm.$emit('change', UserRole.ADMIN);

		await wrapper.vm.$nextTick();

		await flushPromises();

		expect(wrapper.emitted('update:filters')).toBeTruthy();
		expect(wrapper.emitted('update:filters')?.[0]).toEqual([{ search: '', role: UserRole.ADMIN }]);
	});

	it('clears filters when reset button is clicked', async (): Promise<void> => {
		createWrapper({
			filters: { search: 'admin', role: UserRole.USER },
		});

		await wrapper.findComponent(ElButton).trigger('click');

		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('update:filters')).toBeTruthy();
		expect(wrapper.emitted('update:filters')?.[0]).toEqual([{ search: '', role: '' }]);
	});

	it('handles remote form reset', async (): Promise<void> => {
		createWrapper({ remoteFormReset: false });

		await wrapper.setProps({ remoteFormReset: true });

		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('update:remote-form-reset')).toBeTruthy();

		expect(wrapper.emitted('update:filters')).toBeTruthy();
		expect(wrapper.emitted('update:filters')?.[0]).toEqual([{ search: '', role: '' }]);
	});
});
