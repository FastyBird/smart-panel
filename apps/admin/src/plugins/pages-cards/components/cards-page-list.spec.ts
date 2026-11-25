import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import CardsPageList from './cards-page-list.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', () => ({
	StateView: { name: 'StateView', template: '<div data-test-id="empty" />' },
}));

vi.mock('../../../modules/dashboard', () => ({
	useTilesPlugins: () => ({ getElement: () => ({ name: 'Clock' }) }),
}));

const tile = (id: string, row: number, col: number, draft = false) => ({ id, type: 'tiles-time', row, col, rowSpan: 1, colSpan: 1, draft });

describe('CardsPageList', () => {
	it('lists the cards in their order with their saved tiles in reading order', async () => {
		const wrapper = mount(CardsPageList, {
			props: {
				cards: [
					{ id: 'card-b', title: 'Kitchen', order: 2 },
					{ id: 'card-a', title: 'Living room', order: 1 },
				] as never,
				tiles: {
					'card-a': [tile('a-2', 2, 1), tile('a-1', 1, 3), tile('a-draft', 1, 1, true)],
					'card-b': [],
				} as never,
			},
		});

		expect(wrapper.findAll('[data-test-id^="cards-page-list-card-"]').map((card) => card.attributes('data-test-id'))).toEqual([
			'cards-page-list-card-card-a',
			'cards-page-list-card-card-b',
		]);
		expect(wrapper.findAll('[data-test-id^="cards-page-list-a"]').map((row) => row.attributes('data-test-id'))).toEqual([
			'cards-page-list-a-1',
			'cards-page-list-a-2',
		]);
		expect(wrapper.text()).toContain('pagesCardsPlugin.editor.phone.noTiles');

		await wrapper.get('[data-test-id="cards-page-list-a-1"]').trigger('click');

		expect(wrapper.emitted('detail')?.[0]).toEqual(['a-1']);
	});

	it('says so when the page has no cards', () => {
		const wrapper = mount(CardsPageList, { props: { cards: [], tiles: {} } });

		expect(wrapper.find('[data-test-id="empty"]').exists()).toBe(true);
	});
});
