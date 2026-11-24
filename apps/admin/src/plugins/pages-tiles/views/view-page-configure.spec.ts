/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, ref } from 'vue';
import { type Router, RouterView, createMemoryHistory, createRouter } from 'vue-router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { RouteNames } from '../pages-tiles.constants';

import ViewPageConfigure from './view-page-configure.vue';

const confirm = vi.fn();
const success = vi.fn();
const error = vi.fn();
const hideTile = vi.fn();
const showTile = vi.fn();
const removeTile = vi.fn();

const isPhone = ref<boolean>(false);
const isTabletPortrait = ref<boolean>(false);

const PAGE_ID = '00000000-0000-4000-8000-00000000b001';
const TILE_ID = '00000000-0000-4000-8000-00000000b002';

const PAGE = { id: PAGE_ID, title: 'Living room', displays: null, rows: null, cols: null };

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('element-plus', () => ({
	ElButton: { name: 'ElButton', template: '<button v-bind="$attrs"><slot /></button>' },
	ElDrawer: { name: 'ElDrawer', template: '<div><slot /></div>' },
	ElOption: { name: 'ElOption', template: '<div />' },
	ElScrollbar: { name: 'ElScrollbar', template: '<div><slot /></div>' },
	ElSelect: { name: 'ElSelect', template: '<div />' },
	ElTag: { name: 'ElTag', template: '<span v-bind="$attrs"><slot /></span>' },
	ElMessageBox: { confirm: (...args: unknown[]) => confirm(...args) },
}));

vi.mock('@iconify/vue', () => ({
	Icon: { name: 'Icon', template: '<i />' },
}));

vi.mock('../../../common', () => ({
	ViewError: { name: 'ViewError', template: '<div><slot /></div>' },
	StateView: { name: 'StateView', template: '<div />' },
	EditDrawerLayout: { name: 'EditDrawerLayout', props: ['open'], template: '<div><slot /><slot name="form" /></div>' },
	provideEditDrawer: () => ({ inDrawer: computed<boolean>(() => !isPhone.value) }),
	useFlashMessage: () => ({ success, error, warning: vi.fn() }),
	useSizeClass: () => ({
		sizeClass: computed<string>(() => (isPhone.value ? 'phone' : isTabletPortrait.value ? 'tp' : 'dt')),
		isPhone: computed<boolean>(() => isPhone.value),
		isTabletPortrait: computed<boolean>(() => isTabletPortrait.value),
		isTabletLandscape: computed<boolean>(() => false),
	}),
}));

vi.mock('../../../modules/dashboard', () => ({
	RouteNames: { PAGES: 'dashboard_module-pages', TILE: 'dashboard_module-tile' },
	FormResult: { NONE: 'none', WORKING: 'working', ERROR: 'error', OK: 'ok' },
	useTiles: () => ({
		tiles: ref([{ id: TILE_ID, type: 'tile-time', row: 1, col: 2, rowSpan: 1, colSpan: 2, hidden: false, draft: false }]),
		fetchTiles: vi.fn().mockResolvedValue(undefined),
		areLoading: ref(false),
	}),
	useDataSourcesDataSource: () => ({ dataSources: ref([]), areLoading: ref(false), fetchDataSources: vi.fn().mockResolvedValue(undefined) }),
	useDataSourcesActions: () => ({ remove: vi.fn() }),
}));

vi.mock('../../../modules/displays', () => ({
	useDisplays: () => ({
		displays: ref([{ id: 'display-1', name: 'Hall', macAddress: 'aa', rows: 4, cols: 6, darkMode: true, screenWidth: 800, screenHeight: 480 }]),
		fetchDisplays: vi.fn().mockResolvedValue(undefined),
		isLoading: ref(false),
	}),
}));

vi.mock('../components/page-configure.vue', () => ({
	default: defineComponent({
		name: 'PageConfigure',
		props: ['gridLayout', 'dark', 'selectedTileId', 'page', 'remotePageSubmit'],
		emits: ['select', 'edit', 'update:remote-page-submit', 'update:remote-page-result', 'update:remote-page-changed'],
		setup(_props, { expose }) {
			expose({ hideTile, showTile, removeTile });

			return (): ReturnType<typeof h> => h('div');
		},
	}),
}));

vi.mock('../components/tiles-inspector.vue', () => ({
	default: { name: 'TilesInspector', props: ['place', 'tile', 'disabled'], template: '<div />' },
}));

vi.mock('../components/tiles-page-list.vue', () => ({
	default: { name: 'TilesPageList', props: ['tiles', 'gridLayout'], template: '<div />' },
}));

vi.mock('../components/tiles-palette.vue', () => ({
	default: { name: 'TilesPalette', template: '<div />' },
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
					{ path: 'tile/add', name: RouteNames.PAGE_ADD_TILE, component: RoutedForm },
					{ path: 'tile/:tileId', name: RouteNames.PAGE_EDIT_TILE, component: RoutedForm },
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

const PLACE = { id: TILE_ID, hidden: false, row: 1, col: 2, rowSpan: 1, colSpan: 2 };

enableAutoUnmount(afterEach);

describe('ViewPageConfigure', () => {
	beforeEach(() => {
		isPhone.value = false;
		isTabletPortrait.value = false;

		for (const mock of [confirm, success, error, hideTile, showTile, removeTile]) {
			mock.mockReset();
		}
	});

	it('lays the page out for the display that shows it, in that display theme', async () => {
		const { wrapper } = await mountAt(`/page/${PAGE_ID}/configure`);
		const configure = wrapper.findComponent({ name: 'PageConfigure' });

		expect(wrapper.find('[data-test-id="tiles-editor"]').exists()).toBe(true);
		expect(configure.props('gridLayout')).toEqual({ rows: 4, cols: 6 });
		expect(configure.props('dark')).toBe(true);
		expect(wrapper.findComponent({ name: 'TilesPageList' }).exists()).toBe(false);
	});

	it('adds a tile of the type picked in the palette, in the drawer', async () => {
		const { wrapper, router } = await mountAt(`/page/${PAGE_ID}/configure`);

		wrapper.findComponent({ name: 'TilesPalette' }).vm.$emit('add', 'tile-time');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE_ADD_TILE);
		expect(router.currentRoute.value.query.tileType).toBe('tile-time');
		expect(wrapper.findComponent({ name: 'EditDrawerLayout' }).props('open')).toBe(true);
	});

	it('shows the selected tile in the inspector and passes its actions to the canvas', async () => {
		const { wrapper, router } = await mountAt(`/page/${PAGE_ID}/configure`);

		wrapper.findComponent({ name: 'PageConfigure' }).vm.$emit('select', PLACE);
		await flushPromises();

		const inspector = wrapper.findComponent({ name: 'TilesInspector' });

		expect(inspector.props('place')).toEqual(PLACE);
		expect(inspector.props('tile')).toMatchObject({ id: TILE_ID });
		expect(wrapper.findComponent({ name: 'PageConfigure' }).props('selectedTileId')).toBe(TILE_ID);

		inspector.vm.$emit('hide', TILE_ID);
		inspector.vm.$emit('show', TILE_ID);
		inspector.vm.$emit('remove', TILE_ID);

		expect(hideTile).toHaveBeenCalledWith(TILE_ID);
		expect(showTile).toHaveBeenCalledWith(TILE_ID);
		expect(removeTile).toHaveBeenCalledWith(TILE_ID);

		inspector.vm.$emit('edit', TILE_ID);
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE_EDIT_TILE);
		expect(router.currentRoute.value.params.tileId).toBe(TILE_ID);

		inspector.vm.$emit('close');
		await flushPromises();

		expect(wrapper.findComponent({ name: 'TilesInspector' }).props('place')).toBeNull();
	});

	it('saves the layout and reports the result', async () => {
		const { wrapper } = await mountAt(`/page/${PAGE_ID}/configure`);
		const configure = wrapper.findComponent({ name: 'PageConfigure' });

		configure.vm.$emit('update:remote-page-changed', true);
		await flushPromises();

		expect(wrapper.find('[data-test-id="tiles-editor-unsaved"]').exists()).toBe(true);

		await wrapper.find('[data-test-id="tiles-editor-save"]').trigger('click');
		await flushPromises();

		expect(configure.props('remotePageSubmit')).toBe(true);

		configure.vm.$emit('update:remote-page-result', 'ok');
		await flushPromises();

		expect(success).toHaveBeenCalledWith('pagesTilesPlugin.editor.messages.saved');

		configure.vm.$emit('update:remote-page-result', 'error');
		await flushPromises();

		expect(error).toHaveBeenCalledWith('pagesTilesPlugin.editor.messages.saveFailed');
	});

	it('asks before leaving with unsaved layout changes, and stays when declined', async () => {
		const { wrapper, router } = await mountAt(`/page/${PAGE_ID}/configure`);

		wrapper.findComponent({ name: 'PageConfigure' }).vm.$emit('update:remote-page-changed', true);
		await flushPromises();

		confirm.mockRejectedValueOnce(new Error('cancel'));

		await router.push({ name: 'dashboard_module-pages' });
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE);

		// Opening a form stays inside the editor, so it does not ask
		wrapper.findComponent({ name: 'TilesPalette' }).vm.$emit('add', 'tile-time');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE_ADD_TILE);
	});

	it('discards the layout changes after asking', async () => {
		const { wrapper, router } = await mountAt(`/page/${PAGE_ID}/configure`);

		wrapper.findComponent({ name: 'PageConfigure' }).vm.$emit('update:remote-page-changed', true);
		await flushPromises();

		confirm.mockResolvedValueOnce(true);

		await wrapper.find('[data-test-id="tiles-editor-discard"]').trigger('click');
		await flushPromises();

		// Asked once by Discard, not again by the leave guard
		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.name).toBe('dashboard_module-pages');
	});

	it('reads the page as a list on phone and opens a tile detail from it', async () => {
		isPhone.value = true;

		const { wrapper, router } = await mountAt(`/page/${PAGE_ID}/configure`);
		const list = wrapper.findComponent({ name: 'TilesPageList' });

		expect(list.exists()).toBe(true);
		expect(wrapper.find('[data-test-id="tiles-editor"]').exists()).toBe(false);

		list.vm.$emit('detail', TILE_ID);
		await flushPromises();

		expect(router.currentRoute.value.name).toBe('dashboard_module-tile');
	});

	it('keeps the editor on phone width while the layout has unsaved changes, and asks before a form replaces it', async () => {
		const { wrapper, router } = await mountAt(`/page/${PAGE_ID}/configure`);

		wrapper.findComponent({ name: 'PageConfigure' }).vm.$emit('update:remote-page-changed', true);
		await flushPromises();

		isPhone.value = true;
		await flushPromises();

		expect(wrapper.find('[data-test-id="tiles-editor"]').exists()).toBe(true);
		expect(wrapper.findComponent({ name: 'TilesPageList' }).exists()).toBe(false);

		confirm.mockRejectedValueOnce(new Error('cancel'));

		wrapper.findComponent({ name: 'TilesPalette' }).vm.$emit('add', 'tile-time');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE);

		confirm.mockResolvedValueOnce(true);

		wrapper.findComponent({ name: 'TilesPalette' }).vm.$emit('add', 'tile-time');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE_ADD_TILE);
	});

	it('locks the inspector actions while the layout is being saved', async () => {
		const { wrapper } = await mountAt(`/page/${PAGE_ID}/configure`);
		const configure = wrapper.findComponent({ name: 'PageConfigure' });

		configure.vm.$emit('select', PLACE);
		configure.vm.$emit('update:remote-page-result', 'working');
		await flushPromises();

		expect(wrapper.findComponent({ name: 'TilesInspector' }).props('disabled')).toBe(true);
	});

	it('keeps the palette behind Add tile and the data sources behind a button on tablet portrait', async () => {
		isTabletPortrait.value = true;

		const { wrapper } = await mountAt(`/page/${PAGE_ID}/configure`);

		expect(wrapper.find('[data-test-id="tiles-editor-add-tile"]').exists()).toBe(true);
		expect(wrapper.findComponent({ name: 'TilesInspector' }).exists()).toBe(false);

		await wrapper.find('[data-test-id="tiles-editor-data-sources"]').trigger('click');

		expect(wrapper.findComponent({ name: 'TilesInspector' }).exists()).toBe(true);
	});
});
