import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import TilesInspector from './tiles-inspector.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key) }),
}));

vi.mock('element-plus', () => ({
	ElButton: { name: 'ElButton', template: '<button v-bind="$attrs"><slot /></button>' },
	ElTooltip: { name: 'ElTooltip', template: '<div><slot /></div>' },
}));

vi.mock('@iconify/vue', () => ({
	Icon: { name: 'Icon', template: '<i />' },
}));

vi.mock('../../../common', () => ({
	KvGrid: { name: 'KvGrid', props: ['items', 'cols'], template: '<div />' },
	StatusTag: { name: 'StatusTag', props: ['status', 'label'], template: '<span />' },
}));

vi.mock('../../../modules/dashboard', () => ({
	DataSourcesCard: { name: 'DataSourcesCard', props: ['items', 'loading'], emits: ['add', 'edit', 'remove'], template: '<div />' },
	useTilesPlugins: () => ({ getElement: () => ({ name: 'Clock' }) }),
}));

const TILE = { id: 'tile-1', type: 'tile-time', row: 1, col: 2, rowSpan: 1, colSpan: 2, hidden: false, draft: false };

const mountWith = (place: Record<string, unknown> | null, tile: Record<string, unknown> | null = TILE) =>
	mount(TilesInspector, { props: { place, tile, dataSources: [], dataSourcesLoading: false } as never });

describe('TilesInspector', () => {
	it('shows where the selected tile sits now, and its actions', async () => {
		const wrapper = mountWith({ id: 'tile-1', hidden: false, row: 3, col: 4, rowSpan: 2, colSpan: 1 });

		expect(wrapper.text()).toContain('Clock');
		expect(wrapper.findComponent({ name: 'StatusTag' }).props('status')).toBe('ok');
		expect(wrapper.findComponent({ name: 'KvGrid' }).props('items')).toEqual([
			{ label: 'pagesTilesPlugin.editor.inspector.position', value: 'pagesTilesPlugin.editor.inspector.positionValue:{"row":3,"col":4}' },
			{ label: 'pagesTilesPlugin.editor.inspector.size', value: 'pagesTilesPlugin.editor.inspector.sizeValue:{"cols":1,"rows":2}' },
		]);

		for (const [action, event] of [
			['edit', 'edit'],
			['hide', 'hide'],
			['detail', 'detail'],
			['remove', 'remove'],
			['close', 'close'],
		]) {
			await wrapper.find(`[data-test-id="tiles-inspector-${action}"]`).trigger('click');

			expect(wrapper.emitted(event)).toBeTruthy();
		}

		expect(wrapper.find('[data-test-id="tiles-inspector-show"]').exists()).toBe(false);
	});

	it('offers Show for a hidden tile, and no Detail for a tile not saved yet', async () => {
		const wrapper = mountWith({ id: 'tile-1', hidden: true, row: 1, col: 1, rowSpan: 1, colSpan: 1 }, { ...TILE, draft: true });

		expect(wrapper.findComponent({ name: 'StatusTag' }).props('status')).toBe('info');
		expect(wrapper.find('[data-test-id="tiles-inspector-hide"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="tiles-inspector-detail"]').exists()).toBe(false);

		await wrapper.find('[data-test-id="tiles-inspector-show"]').trigger('click');

		expect(wrapper.emitted('show')).toEqual([['tile-1']]);
	});

	it('shows the page data sources with nothing selected', () => {
		const wrapper = mountWith(null, null);
		const card = wrapper.findComponent({ name: 'DataSourcesCard' });

		expect(card.exists()).toBe(true);

		card.vm.$emit('add');
		card.vm.$emit('edit', 'ds-1');
		card.vm.$emit('remove', 'ds-1');

		expect(wrapper.emitted('addDataSource')).toHaveLength(1);
		expect(wrapper.emitted('editDataSource')).toEqual([['ds-1']]);
		expect(wrapper.emitted('removeDataSource')).toEqual([['ds-1']]);
	});
});
