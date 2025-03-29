import { type ComponentPublicInstance, ref } from 'vue';
import { createI18n } from 'vue-i18n';

import { ElButton, ElInput, ElSelect } from 'element-plus';
import { afterEach, describe, expect, it } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import { UsersUserRole } from '../../../openapi';
import type { IUsersFilter } from '../composables';
import enUS from '../locales/en-US.json';

import { UsersFilter } from './index';
import type { IUsersFilterProps } from './users-filter.types';

type UsersFilterInstance = ComponentPublicInstance<IUsersFilterProps>;

describe('UsersFilter', (): void => {
	let wrapper: VueWrapper<UsersFilterInstance>;

	const filters = ref<IUsersFilter>({
		search: undefined,
		roles: [],
	});

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
				filters: filters.value,
				filtersActive: false,
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
			filters: { search: 'name', roles: [] },
			filtersActive: true,
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

		expect(filters.value.search).toEqual('admin');
		expect(filters.value.roles).toEqual([]);
	});

	it('updates role filter', async (): Promise<void> => {
		createWrapper();

		expect(filters.value.roles).toEqual([]);

		const select = wrapper.findComponent(ElSelect);

		expect(select.exists()).toBe(true);

		await select.setValue([UsersUserRole.admin]);
		await select.trigger('change');

		select.vm.$emit('change', [UsersUserRole.admin]);

		await wrapper.vm.$nextTick();

		expect(filters.value.roles).toEqual([UsersUserRole.admin]);
	});

	it('clears filters when reset button is clicked', async (): Promise<void> => {
		createWrapper({
			filters: { search: 'admin', roles: [UsersUserRole.user] },
			filtersActive: true,
		});

		await wrapper.findComponent(ElButton).trigger('click');

		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('reset-filters')).toBeTruthy();
	});
});
