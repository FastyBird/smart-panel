/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, ref } from 'vue';
import { type Router, RouterView, createMemoryHistory, createRouter } from 'vue-router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { RouteNames } from '../pages-cards.contants';

import ViewPageConfigure from './view-page-configure.vue';

const confirm = vi.fn();
const success = vi.fn();
const error = vi.fn();
const removeCard = vi.fn();
const configureMounts = vi.fn();
const removeTile = vi.fn();
const unsetDataSources = vi.fn();
const cardTiles = ref<{ id: string; draft: boolean }[]>([]);

const isPhone = ref<boolean>(false);

const PAGE_ID = '00000000-0000-4000-8000-00000000c001';
const CARD_ID = '00000000-0000-4000-8000-00000000c002';
const TILE_ID = '00000000-0000-4000-8000-00000000c003';

const PAGE = { id: PAGE_ID, title: 'Living room', displays: null };

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('element-plus', () => ({
	ElButton: { name: 'ElButton', template: '<button v-bind="$attrs"><slot /></button>' },
	ElTag: { name: 'ElTag', template: '<span v-bind="$attrs"><slot /></span>' },
	ElMessageBox: { confirm: (...args: unknown[]) => confirm(...args) },
}));

vi.mock('@iconify/vue', () => ({
	Icon: { name: 'Icon', template: '<i />' },
}));

vi.mock('../../../common', () => ({
	injectStoresManager: () => ({
		getStore: () => ({
			findForParent: () => cardTiles.value,
			remove: (...args: unknown[]) => removeTile(...args),
			unset: (...args: unknown[]) => unsetDataSources(...args),
		}),
	}),
	ViewError: { name: 'ViewError', template: '<div><slot /></div>' },
	EditDrawerLayout: { name: 'EditDrawerLayout', props: ['open'], template: '<div><slot /><slot name="form" /></div>' },
	provideEditDrawer: () => ({ inDrawer: computed<boolean>(() => !isPhone.value) }),
	useFlashMessage: () => ({ success, error, warning: vi.fn() }),
}));

vi.mock('../../../modules/dashboard', () => ({
	RouteNames: { PAGES: 'dashboard_module-pages', TILE: 'dashboard_module-tile' },
	FormResult: { NONE: 'none', WORKING: 'working', ERROR: 'error', OK: 'ok' },
}));

vi.mock('../../../modules/displays', () => ({
	useDisplays: () => ({
		displays: ref([
			{ id: 'display-1', name: 'Hall', macAddress: 'aa', rows: 4, cols: 6, darkMode: true, screenWidth: 800, screenHeight: 480 },
			{ id: 'display-2', name: 'Kitchen', macAddress: 'bb', rows: 4, cols: 6, darkMode: false, screenWidth: 800, screenHeight: 480 },
			{ id: 'display-3', name: 'Office', macAddress: 'cc', rows: 3, cols: 5, darkMode: false, screenWidth: 640, screenHeight: 480 },
		]),
		fetchDisplays: vi.fn().mockResolvedValue(undefined),
		isLoading: ref(false),
	}),
}));

vi.mock('../composables/useCards', () => ({
	useCards: () => ({
		cards: ref([{ id: CARD_ID, title: 'Climate', order: 1 }]),
		fetchCards: vi.fn().mockResolvedValue(undefined),
		areLoading: ref(false),
	}),
}));

vi.mock('../composables/useCardsActions', () => ({
	useCardsActions: () => ({ remove: removeCard }),
}));

vi.mock('../components/page-configure.vue', () => ({
	default: defineComponent({
		name: 'PageConfigure',
		props: {
			gridLayout: { type: Object, default: null },
			selectedDisplay: { type: Object, default: null },
			page: { type: Object, default: null },
			cards: { type: Array, default: () => [] },
			displays: { type: Array, default: () => [] },
			gridCardStyle: { type: Object, default: () => ({}) },
			remotePageSubmit: { type: Boolean, default: false },
		},
		emits: [
			'select-display',
			'add-card',
			'edit-card',
			'remove-card',
			'add-tile',
			'edit-tile',
			'tile-detail',
			'add-page-data-source',
			'edit-page-data-source',
			'update:remote-page-submit',
			'update:remote-page-result',
			'update:remote-page-changed',
		],
		setup() {
			configureMounts();

			return (): ReturnType<typeof h> => h('div');
		},
	}),
}));

const RoutedForm = defineComponent({
	name: 'RoutedForm',
	props: { remoteFormChanged: { type: Boolean, default: false } },
	emits: ['update:remote-form-changed'],
	setup() {
		return (): ReturnType<typeof h> => h('form');
	},
});

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/pages', name: 'dashboard_module-pages', component: { render: () => null } },
			{ path: '/tile/:id', name: 'dashboard_module-tile', component: { render: () => null } },
			{
				path: '/page/:id/configure',
				name: RouteNames.PAGE,
				component: ViewPageConfigure,
				props: () => ({ id: PAGE_ID, page: PAGE }),
				children: [
					{ path: 'card/add', name: RouteNames.PAGE_ADD_CARD, component: RoutedForm },
					{ path: 'card/:cardId', name: RouteNames.PAGE_EDIT_CARD, component: RoutedForm },
					{ path: 'card/:cardId/tile/add', name: RouteNames.PAGE_CARD_ADD_TILE, component: RoutedForm },
					{ path: 'card/:cardId/tile/:tileId', name: RouteNames.PAGE_CARD_EDIT_TILE, component: RoutedForm },
					{ path: 'data-source/add', name: RouteNames.PAGE_ADD_DATA_SOURCE, component: RoutedForm },
					{ path: 'data-source/:dataSourceId', name: RouteNames.PAGE_EDIT_DATA_SOURCE, component: RoutedForm },
				],
			},
		],
	});

const mountAt = async (path: string) => {
	const router = makeRouter();

	await router.push(path);

	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [router] } });

	await flushPromises();

	return { wrapper, router };
};

enableAutoUnmount(afterEach);

describe('ViewCardsPageConfigure', () => {
	beforeEach(() => {
		isPhone.value = false;
		cardTiles.value = [];

		for (const mock of [confirm, success, error, removeCard, configureMounts, removeTile, unsetDataSources]) {
			mock.mockReset();
		}

		removeTile.mockResolvedValue(true);
	});

	it('lays the cards out for the display that shows the page', async () => {
		const { wrapper } = await mountAt(`/page/${PAGE_ID}/configure`);
		const configure = wrapper.findComponent({ name: 'PageConfigure' });

		expect(wrapper.find('[data-test-id="cards-editor"]').exists()).toBe(true);
		expect(configure.props('gridLayout')).toEqual({ rows: 4, cols: 6 });
		expect(configure.props('selectedDisplay')).toMatchObject({ id: 'display-1' });
		expect(wrapper.findComponent({ name: 'EditDrawerLayout' }).props('open')).toBe(false);
	});

	it('opens the card, tile and data source forms in the drawer', async () => {
		const { wrapper, router } = await mountAt(`/page/${PAGE_ID}/configure`);
		const configure = wrapper.findComponent({ name: 'PageConfigure' });

		await wrapper.find('[data-test-id="cards-editor-add-card"]').trigger('click');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE_ADD_CARD);
		expect(wrapper.findComponent({ name: 'EditDrawerLayout' }).props('open')).toBe(true);

		configure.vm.$emit('edit-tile', TILE_ID, CARD_ID);
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE_CARD_EDIT_TILE);
		expect(router.currentRoute.value.params).toMatchObject({ cardId: CARD_ID, tileId: TILE_ID });

		await wrapper.find('[data-test-id="cards-editor-add-data-source"]').trigger('click');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE_ADD_DATA_SOURCE);

		configure.vm.$emit('remove-card', CARD_ID);

		expect(removeCard).toHaveBeenCalledWith(CARD_ID);
	});

	it('saves the layout and reports the result', async () => {
		const { wrapper } = await mountAt(`/page/${PAGE_ID}/configure`);
		const configure = wrapper.findComponent({ name: 'PageConfigure' });

		configure.vm.$emit('update:remote-page-changed', true);
		await flushPromises();

		expect(wrapper.find('[data-test-id="cards-editor-unsaved"]').exists()).toBe(true);

		await wrapper.find('[data-test-id="cards-editor-save"]').trigger('click');
		await flushPromises();

		expect(configure.props('remotePageSubmit')).toBe(true);

		configure.vm.$emit('update:remote-page-result', 'ok');
		await flushPromises();

		expect(success).toHaveBeenCalledWith('pagesCardsPlugin.editor.messages.saved');

		configure.vm.$emit('update:remote-page-result', 'error');
		await flushPromises();

		expect(error).toHaveBeenCalledWith('pagesCardsPlugin.editor.messages.saveFailed');
	});

	it('asks before leaving with unsaved layout changes, but not before opening a form', async () => {
		const { wrapper, router } = await mountAt(`/page/${PAGE_ID}/configure`);

		wrapper.findComponent({ name: 'PageConfigure' }).vm.$emit('update:remote-page-changed', true);
		await flushPromises();

		confirm.mockRejectedValueOnce(new Error('cancel'));

		await router.push({ name: 'dashboard_module-pages' });
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE);

		wrapper.findComponent({ name: 'PageConfigure' }).vm.$emit('add-tile', CARD_ID);
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE_CARD_ADD_TILE);
	});

	it('discards the layout changes after asking once', async () => {
		const { wrapper, router } = await mountAt(`/page/${PAGE_ID}/configure`);

		wrapper.findComponent({ name: 'PageConfigure' }).vm.$emit('update:remote-page-changed', true);
		await flushPromises();

		confirm.mockResolvedValueOnce(true);

		await wrapper.find('[data-test-id="cards-editor-discard"]').trigger('click');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.name).toBe('dashboard_module-pages');
	});

	it('asks before a form replaces the editor holding unsaved changes on phone', async () => {
		isPhone.value = true;

		const { wrapper, router } = await mountAt(`/page/${PAGE_ID}/configure`);

		wrapper.findComponent({ name: 'PageConfigure' }).vm.$emit('update:remote-page-changed', true);
		await flushPromises();

		confirm.mockRejectedValueOnce(new Error('cancel'));

		wrapper.findComponent({ name: 'PageConfigure' }).vm.$emit('edit-card', CARD_ID);
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE);

		confirm.mockResolvedValueOnce(true);

		wrapper.findComponent({ name: 'PageConfigure' }).vm.$emit('edit-card', CARD_ID);
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE_EDIT_CARD);
		// On phone the form is its own page
		expect(wrapper.find('[data-test-id="cards-editor"]').exists()).toBe(false);
		expect(wrapper.findComponent({ name: 'RoutedForm' }).exists()).toBe(true);
	});

	it('asks before a display with another grid replaces unsaved changes; the same grid keeps them', async () => {
		const { wrapper } = await mountAt(`/page/${PAGE_ID}/configure`);
		const configure = () => wrapper.findComponent({ name: 'PageConfigure' });

		configure().vm.$emit('update:remote-page-changed', true);
		await flushPromises();

		configure().vm.$emit('select-display', 'display-2');
		await flushPromises();

		expect(confirm).not.toHaveBeenCalled();
		expect(configure().props('selectedDisplay')).toMatchObject({ id: 'display-2' });

		confirm.mockRejectedValueOnce(new Error('cancel'));

		configure().vm.$emit('select-display', 'display-3');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(configure().props('gridLayout')).toEqual({ rows: 4, cols: 6 });
	});

	it('asks before Back closes a changed form, and asks once when the drawer closes it', async () => {
		const { wrapper, router } = await mountAt(`/page/${PAGE_ID}/configure/card/add`);

		wrapper.findComponent({ name: 'RoutedForm' }).vm.$emit('update:remote-form-changed', true);
		await flushPromises();

		confirm.mockRejectedValueOnce(new Error('cancel'));

		await router.push({ name: RouteNames.PAGE, params: { id: PAGE_ID } });
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE_ADD_CARD);

		confirm.mockResolvedValueOnce(true);

		wrapper.findComponent({ name: 'EditDrawerLayout' }).vm.$emit('close');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(2);
		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE);
	});

	it('asks before leaving the editor with a changed form open', async () => {
		const { wrapper, router } = await mountAt(`/page/${PAGE_ID}/configure/data-source/add`);

		wrapper.findComponent({ name: 'RoutedForm' }).vm.$emit('update:remote-form-changed', true);
		await flushPromises();

		confirm.mockRejectedValueOnce(new Error('cancel'));

		await router.push({ name: 'dashboard_module-pages' });
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE_ADD_DATA_SOURCE);
	});
	it('asks before Back, Forward or a link opens a form over the editor holding unsaved changes on phone', async () => {
		isPhone.value = true;

		const { wrapper, router } = await mountAt(`/page/${PAGE_ID}/configure`);

		wrapper.findComponent({ name: 'PageConfigure' }).vm.$emit('update:remote-page-changed', true);
		await flushPromises();

		confirm.mockRejectedValueOnce(new Error('cancel'));

		await router.push({ name: RouteNames.PAGE_EDIT_CARD, params: { id: PAGE_ID, cardId: CARD_ID } });
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE);
		expect(wrapper.find('[data-test-id="cards-editor"]').exists()).toBe(true);

		confirm.mockResolvedValueOnce(true);

		await router.push({ name: RouteNames.PAGE_EDIT_CARD, params: { id: PAGE_ID, cardId: CARD_ID } });
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(2);
		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE_EDIT_CARD);
	});

	it('rebuilds the canvas from the saved layout when the changes are discarded for a display with another grid', async () => {
		const { wrapper } = await mountAt(`/page/${PAGE_ID}/configure`);

		wrapper.findComponent({ name: 'PageConfigure' }).vm.$emit('update:remote-page-changed', true);
		await flushPromises();

		expect(configureMounts).toHaveBeenCalledTimes(1);

		confirm.mockResolvedValueOnce(true);

		wrapper.findComponent({ name: 'PageConfigure' }).vm.$emit('select-display', 'display-3');
		await flushPromises();

		// A fresh canvas holds no pending moves or removals, and the editor is clean again
		expect(configureMounts).toHaveBeenCalledTimes(2);
		expect(wrapper.findComponent({ name: 'PageConfigure' }).props('gridLayout')).toEqual({ rows: 3, cols: 5 });
		expect(wrapper.find('[data-test-id="cards-editor-unsaved"]').exists()).toBe(false);
	});

	it('drops the tiles added but never saved when the layout changes are discarded', async () => {
		cardTiles.value = [
			{ id: 'tile-saved', draft: false },
			{ id: 'tile-draft', draft: true },
		];

		const { wrapper } = await mountAt(`/page/${PAGE_ID}/configure`);

		wrapper.findComponent({ name: 'PageConfigure' }).vm.$emit('update:remote-page-changed', true);
		await flushPromises();

		confirm.mockResolvedValueOnce(true);

		wrapper.findComponent({ name: 'PageConfigure' }).vm.$emit('select-display', 'display-3');
		await flushPromises();

		expect(removeTile).toHaveBeenCalledTimes(1);
		expect(removeTile).toHaveBeenCalledWith({ id: 'tile-draft', parent: { type: 'card', id: CARD_ID } });
		expect(unsetDataSources).toHaveBeenCalledWith({ parent: { type: 'tile', id: 'tile-draft' } });
	});
});
