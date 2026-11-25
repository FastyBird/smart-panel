import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import TilesPageList from './tiles-page-list.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('element-plus', () => ({
	ElCard: { name: 'ElCard', template: '<section><slot name="header" /><slot /></section>' },
}));

vi.mock('@iconify/vue', () => ({
	Icon: { name: 'Icon', template: '<i />' },
}));

vi.mock('../../../modules/dashboard', () => ({
	useTilesPlugins: () => ({ getElement: (type: string) => ({ name: type === 'tile-time' ? 'Clock' : 'Scene' }) }),
}));

const tile = (id: string, extra: Record<string, unknown>) => ({
	id,
	type: 'tile-time',
	row: 1,
	col: 1,
	rowSpan: 1,
	colSpan: 1,
	hidden: false,
	draft: false,
	...extra,
});

describe('TilesPageList', () => {
	it('lists the tiles on the page in reading order, then the hidden ones, and skips unsaved ones', async () => {
		const wrapper = mount(TilesPageList, {
			props: {
				gridLayout: { rows: 4, cols: 6 },
				tiles: [
					tile('b', { row: 2, col: 1 }),
					tile('a', { row: 1, col: 3 }),
					tile('hidden', { hidden: true, type: 'tile-scene' }),
					tile('outside', { row: 4, rowSpan: 2 }),
					tile('draft', { draft: true }),
				],
			} as never,
		});

		const rows = wrapper.findAll('button').map((row) => row.attributes('data-test-id'));

		expect(rows).toEqual(['tiles-page-list-a', 'tiles-page-list-b', 'tiles-page-list-hidden', 'tiles-page-list-outside']);

		await wrapper.find('[data-test-id="tiles-page-list-a"]').trigger('click');

		expect(wrapper.emitted('detail')).toEqual([['a']]);
	});

	it('says when a group is empty', () => {
		const wrapper = mount(TilesPageList, { props: { gridLayout: { rows: 4, cols: 6 }, tiles: [] } as never });

		expect(wrapper.text()).toContain('pagesTilesPlugin.editor.phone.noTiles');
		expect(wrapper.text()).toContain('pagesTilesPlugin.editor.phone.noHiddenTiles');
	});
});
