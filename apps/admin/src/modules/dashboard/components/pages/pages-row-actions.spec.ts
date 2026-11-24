import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IPage } from '../../store/pages.store.types';

import PagesRowActions from './pages-row-actions.vue';

const plugin = ref<{ routes?: { configure?: unknown } } | undefined>(undefined);

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string, params?: Record<string, string>) => (params ? `${key}:${Object.values(params).join(',')}` : key) }),
}));

vi.mock('../../composables/usePagesPlugin', () => ({
	usePagesPlugin: () => ({ plugin }),
}));

const page = { id: 'p1', title: 'Living room', type: 'tiles' } as unknown as IPage;

const stubs = {
	ElTooltip: { name: 'ElTooltip', props: ['content'], template: '<div><slot /></div>' },
	ElDropdown: { name: 'ElDropdown', emits: ['command'], template: '<div><slot /><slot name="dropdown" /></div>' },
	ElDropdownMenu: { template: '<ul><slot /></ul>' },
	ElDropdownItem: { template: '<li><slot /></li>' },
};

describe('PagesRowActions', () => {
	beforeEach(() => {
		plugin.value = undefined;
	});

	it('offers Edit as an icon and Detail and Remove in the more menu', async () => {
		const wrapper = mount(PagesRowActions, { props: { page }, global: { stubs } });

		expect(wrapper.find('[data-test-id="edit-page"]').attributes('aria-label')).toBe('dashboardModule.aria.pages.edit:Living room');
		expect(wrapper.find('[data-test-id="remove-page"]').classes()).toContain('text-danger!');
		expect(wrapper.find('[data-test-id="configure-page"]').exists()).toBe(false);

		await wrapper.find('[data-test-id="edit-page"]').trigger('click');
		wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'detail');
		wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'remove');

		expect(wrapper.emitted('edit')).toEqual([['p1']]);
		expect(wrapper.emitted('detail')).toEqual([['p1']]);
		expect(wrapper.emitted('remove')).toEqual([['p1']]);
	});

	it('keeps Configure, with its label, for page types that have a layout to arrange', async () => {
		plugin.value = { routes: { configure: (id: string) => `/page/${id}/plugin` } };

		const wrapper = mount(PagesRowActions, { props: { page }, global: { stubs } });

		await wrapper.find('[data-test-id="configure-page"]').trigger('click');

		// The host navigates, so it can ask about a changed form first
		expect(wrapper.find('[data-test-id="configure-page"]').text()).toContain('dashboardModule.buttons.configure.title');
		expect(wrapper.emitted('configure')).toEqual([['/page/p1/plugin']]);
	});

	it('moves Configure into the more menu where the actions column is narrow', () => {
		plugin.value = { routes: { configure: (id: string) => `/page/${id}/plugin` } };

		const wrapper = mount(PagesRowActions, { props: { page, compact: true }, global: { stubs } });

		expect(wrapper.find('[data-test-id="configure-page"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="configure-page-menu"]').exists()).toBe(true);

		wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'configure');

		expect(wrapper.emitted('configure')).toEqual([['/page/p1/plugin']]);
	});
});
