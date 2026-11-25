import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { ICardsInspectorProps } from './cards-inspector.types';
import CardsInspector from './cards-inspector.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key) }),
}));

vi.mock('../../../modules/dashboard', () => ({
	DataSourcesCard: { name: 'DataSourcesCard', props: ['items', 'loading'], template: '<div data-test-id="data-sources" />' },
	useTilesPlugins: () => ({ getElement: () => ({ name: 'Clock' }) }),
}));

const CARD = { id: 'card-1', title: 'Living room', order: 2, rows: null, cols: 4 };
const TILE = { id: 'tile-1', type: 'tiles-time', draft: false };
const PLACE = { id: 'tile-1', cardId: 'card-1', row: 2, col: 3, rowSpan: 1, colSpan: 2 };

const render = (props: Partial<ICardsInspectorProps>) =>
	mount(CardsInspector, {
		props: { place: null, tile: null, card: null, gridLayout: { rows: 4, cols: 6 }, dataSources: [], dataSourcesLoading: false, ...props } as never,
	});

describe('CardsInspector', () => {
	it('shows the selected tile with its card, place and actions', async () => {
		const wrapper = render({ place: PLACE, tile: TILE as never, card: CARD as never });

		expect(wrapper.text()).toContain('Clock');
		expect(wrapper.text()).toContain('pagesCardsPlugin.editor.inspector.inCard:{"card":"Living room"}');
		expect(wrapper.text()).toContain('pagesCardsPlugin.editor.inspector.positionValue:{"row":2,"col":3}');

		await wrapper.get('[data-test-id="cards-inspector-edit-tile"]').trigger('click');
		await wrapper.get('[data-test-id="cards-inspector-detail"]').trigger('click');
		await wrapper.get('[data-test-id="cards-inspector-remove-tile"]').trigger('click');

		expect(wrapper.emitted('editTile')?.[0]).toEqual(['tile-1', 'card-1']);
		expect(wrapper.emitted('detail')?.[0]).toEqual(['tile-1']);
		expect(wrapper.emitted('removeTile')?.[0]).toEqual(['tile-1']);
	});

	it('offers no detail for a tile that was never saved, and no removal while the layout is saved', () => {
		const wrapper = render({ place: PLACE, tile: { ...TILE, draft: true } as never, card: CARD as never, disabled: true });

		expect(wrapper.find('[data-test-id="cards-inspector-detail"]').exists()).toBe(false);
		expect(wrapper.get('[data-test-id="cards-inspector-remove-tile"]').attributes('disabled')).toBeDefined();
	});

	it('shows the selected card with its grid, the display filling in what the card leaves open', async () => {
		const wrapper = render({ card: CARD as never, cardTileCount: 3 });

		expect(wrapper.text()).toContain('Living room');
		expect(wrapper.text()).toContain('pagesCardsPlugin.editor.inspector.sizeValue:{"cols":4,"rows":4}');

		await wrapper.get('[data-test-id="cards-inspector-add-tile"]').trigger('click');
		await wrapper.get('[data-test-id="cards-inspector-edit-card"]').trigger('click');
		await wrapper.get('[data-test-id="cards-inspector-remove-card"]').trigger('click');

		expect(wrapper.emitted('addTile')?.[0]).toEqual(['card-1']);
		expect(wrapper.emitted('editCard')?.[0]).toEqual(['card-1']);
		expect(wrapper.emitted('removeCard')?.[0]).toEqual(['card-1']);
	});

	it('shows the page data sources with nothing selected', () => {
		const wrapper = render({});

		expect(wrapper.find('[data-test-id="data-sources"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="cards-inspector-close"]').exists()).toBe(false);
	});
});
