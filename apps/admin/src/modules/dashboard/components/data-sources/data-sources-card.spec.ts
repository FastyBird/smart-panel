import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IDataSource } from '../../store/data-sources.store.types';

import DataSourcesCard from './data-sources-card.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../../common', () => ({
	StateView: { name: 'StateView', props: ['kind', 'title'], template: '<div />' },
}));

vi.mock('./data-sources-table-column-plugin.vue', () => ({
	default: { name: 'DataSourcesTableColumnPlugin', props: ['dataSource'], template: '<span />' },
}));

const stubs = {
	ElCard: { template: '<div><slot /></div>' },
	ElTooltip: { template: '<div><slot /></div>' },
	ElDropdown: { name: 'ElDropdown', emits: ['command'], template: '<div><slot /><slot name="dropdown" /></div>' },
	ElDropdownMenu: { template: '<ul><slot /></ul>' },
	ElDropdownItem: { template: '<li><slot /></li>' },
};

const items = [{ id: 'ds-1', type: 'device-channel' }] as unknown as IDataSource[];

describe('DataSourcesCard', () => {
	it('lists the data sources with Edit as an icon and Remove in the more menu', async () => {
		const wrapper = mount(DataSourcesCard, { props: { items, loading: false }, global: { stubs } });

		expect(wrapper.findAll('[data-test-id="data-source-row"]')).toHaveLength(1);
		expect(wrapper.find('[data-test-id="edit-data-source"]').attributes('aria-label')).toBe('dashboardModule.aria.dataSources.edit');
		expect(wrapper.find('[data-test-id="remove-data-source"]').classes()).toContain('text-danger!');

		await wrapper.find('[data-test-id="data-sources-add"]').trigger('click');
		await wrapper.find('[data-test-id="edit-data-source"]').trigger('click');
		wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'remove');

		expect(wrapper.emitted('add')).toHaveLength(1);
		expect(wrapper.emitted('edit')).toEqual([['ds-1']]);
		expect(wrapper.emitted('remove')).toEqual([['ds-1']]);
	});

	it('shows the empty state, and keeps Add, without data sources', () => {
		const wrapper = mount(DataSourcesCard, { props: { items: [], loading: false }, global: { stubs } });

		expect(wrapper.findComponent({ name: 'StateView' }).props('title')).toBe('dashboardModule.texts.dataSources.noDataSources');
		expect(wrapper.find('[data-test-id="data-sources-add"]').exists()).toBe(true);
	});
});
