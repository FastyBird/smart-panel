/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, ref } from 'vue';
import { type Router, RouterView, createMemoryHistory, createRouter } from 'vue-router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { RouteNames } from '../weather.constants';

import ViewLocations from './view-locations.vue';

const confirm = vi.fn();
const remove = vi.fn();

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-meta', () => ({
	useMeta: vi.fn(),
}));

vi.mock('element-plus', () => ({
	ElButton: { name: 'ElButton', template: '<button v-bind="$attrs"><slot /></button>' },
	ElMessageBox: { confirm: (...args: unknown[]) => confirm(...args) },
}));

vi.mock('@iconify/vue', () => ({
	Icon: { name: 'Icon', template: '<i />' },
}));

vi.mock('../../../common', () => ({
	AppBreadcrumbs: { name: 'AppBreadcrumbs', template: '<div />' },
	ViewHeader: { name: 'ViewHeader', props: ['actions'], template: '<div><slot name="actions" /></div>' },
	ViewError: { name: 'ViewError', template: '<div><slot /></div>' },
	EditDrawerLayout: { name: 'EditDrawerLayout', props: ['open'], template: '<div><slot /><slot name="form" /></div>' },
	provideEditDrawer: () => ({ inDrawer: computed<boolean>(() => true) }),
}));

vi.mock('../../config', () => ({
	useConfigModule: () => ({ configModule: ref({ unit: 'celsius' }) }),
}));

vi.mock('../composables/useLocationsActions', () => ({
	useLocationsActions: () => ({ remove, bulkRemove: vi.fn() }),
}));

vi.mock('../composables/useLocationsWeather', () => ({
	useLocationsWeather: () => ({
		weatherByLocation: ref({}),
		fetchCompleted: ref(false),
		fetchLocationsWeather: vi.fn().mockResolvedValue(undefined),
	}),
}));

vi.mock('../composables/useLocationsDataSource', () => ({
	useLocationsDataSource: () => ({
		fetchLocations: vi.fn().mockResolvedValue(undefined),
		locations: ref([]),
		locationsPaginated: ref([]),
		totalRows: ref(0),
		filters: ref({ search: undefined, types: [], primary: 'all' }),
		filtersActive: ref(false),
		sortBy: ref('name'),
		sortDir: ref('ascending'),
		paginateSize: ref(10),
		paginatePage: ref(1),
		areLoading: ref(false),
		resetFilter: vi.fn(),
		primaryLocationId: ref(null),
	}),
}));

vi.mock('../components/list-locations.vue', () => ({
	default: { name: 'ListLocations', emits: ['edit', 'detail', 'remove'], template: '<div />' },
}));

// The routed form: records the dirty state it was mounted with, so a test can tell what the host handed it
const mountedWith: boolean[] = [];

const RoutedForm = defineComponent({
	name: 'RoutedForm',
	props: { remoteFormChanged: { type: Boolean, default: false } },
	emits: ['update:remote-form-changed'],
	setup(props) {
		mountedWith.push(props.remoteFormChanged);

		return (): ReturnType<typeof h> => h('form');
	},
});

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/weather/locations',
				name: RouteNames.WEATHER_LOCATIONS,
				component: ViewLocations,
				children: [
					{ path: 'add', name: RouteNames.WEATHER_LOCATION_ADD, component: RoutedForm },
					{ path: ':id', name: RouteNames.WEATHER_LOCATION_EDIT, component: RoutedForm },
				],
			},
			{ path: '/weather/location/:id', name: RouteNames.WEATHER_LOCATION, component: { template: '<div />' } },
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

describe('ViewLocations', () => {
	beforeEach(() => {
		mountedWith.length = 0;
		confirm.mockReset();
		remove.mockReset();
	});

	it('opens the next location clean after a changed form is discarded', async () => {
		const { wrapper, router } = await mountAt('/weather/locations/location-a');

		wrapper.findComponent(RoutedForm).vm.$emit('update:remote-form-changed', true);
		confirm.mockResolvedValue(true);

		wrapper.findComponent({ name: 'ListLocations' }).vm.$emit('edit', 'location-b');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.params.id).toBe('location-b');
		expect(mountedWith).toEqual([false, false]);

		// The fresh form is not dirty, so opening another location does not ask again
		wrapper.findComponent({ name: 'ListLocations' }).vm.$emit('edit', 'location-c');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.params.id).toBe('location-c');
	});

	it('keeps the changed form when leaving for a detail page is declined', async () => {
		const { wrapper, router } = await mountAt('/weather/locations/location-a');

		wrapper.findComponent(RoutedForm).vm.$emit('update:remote-form-changed', true);
		confirm.mockRejectedValue('cancel');

		wrapper.findComponent({ name: 'ListLocations' }).vm.$emit('detail', 'location-b');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.WEATHER_LOCATION_EDIT);
		expect(router.currentRoute.value.params.id).toBe('location-a');
	});

	it('opens Add in the drawer from the header and the phone app bar, which also searches', async () => {
		const { wrapper, router } = await mountAt('/weather/locations');
		const header = wrapper.findComponent({ name: 'ViewHeader' });

		expect((header.props('actions') as { icon: string }[]).map((action) => action.icon)).toEqual(['mdi:magnify', 'mdi:plus']);

		await wrapper.get('[data-test-id="add-location"]').trigger('click');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.WEATHER_LOCATION_ADD);
		expect(wrapper.findComponent({ name: 'EditDrawerLayout' }).props('open')).toBe(true);
	});

	it('removes a location from its row', async () => {
		const { wrapper } = await mountAt('/weather/locations');

		wrapper.findComponent({ name: 'ListLocations' }).vm.$emit('remove', 'location-a');

		expect(remove).toHaveBeenCalledWith('location-a');
	});
});
