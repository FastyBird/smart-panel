/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, ref } from 'vue';
import { type Router, RouterView, createMemoryHistory, createRouter } from 'vue-router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { RouteNames } from '../weather.constants';

import ViewLocation from './view-location.vue';

const confirm = vi.fn();
const fetchLocationWeather = vi.fn();
const fetchLocation = vi.fn();

const LOCATION = { id: 'location-1', name: 'Prague', type: 'weather-open-meteo' };

const location = ref<typeof LOCATION | null>(LOCATION);
const weather = ref<unknown>(null);
const hasError = ref<boolean>(false);
const inDrawer = ref<boolean>(true);

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-meta', () => ({
	useMeta: () => ({ meta: {} }),
}));

vi.mock('element-plus', () => ({
	ElButton: { name: 'ElButton', template: '<button v-bind="$attrs"><slot /></button>' },
	ElCard: { name: 'ElCard', template: '<div v-bind="$attrs"><slot /></div>' },
	ElTooltip: { name: 'ElTooltip', template: '<div><slot /></div>' },
	ElMessageBox: { confirm: (...args: unknown[]) => confirm(...args) },
}));

vi.mock('@iconify/vue', () => ({
	Icon: { name: 'Icon', template: '<i />' },
}));

vi.mock('../../../common', () => ({
	AppBreadcrumbs: { name: 'AppBreadcrumbs', template: '<div />' },
	ViewHeader: { name: 'ViewHeader', props: ['actions', 'title'], template: '<div><slot name="actions" /></div>' },
	ViewError: { name: 'ViewError', template: '<div><slot /></div>' },
	StateView: { name: 'StateView', props: ['kind', 'title'], template: '<div :data-kind="kind"><slot name="action" /></div>' },
	EditDrawerLayout: { name: 'EditDrawerLayout', props: ['open'], template: '<div><slot /><slot v-if="open" name="form" /></div>' },
	provideEditDrawer: () => ({ inDrawer: computed<boolean>(() => inDrawer.value) }),
}));

vi.mock('../../config', () => ({
	useConfigModule: () => ({ configModule: ref({ primaryLocationId: 'location-1' }) }),
}));

vi.mock('../composables/useLocation', () => ({
	useLocation: () => ({ location, isLoading: ref(false), fetchLocation }),
}));

vi.mock('../composables/useLocationWeather', () => ({
	useLocationWeather: () => ({ weather, isLoading: ref(false), hasError, fetchLocationWeather }),
}));

vi.mock('../composables/useWeatherLocationsPlugins', () => ({
	useWeatherLocationsPlugins: () => ({ options: ref([{ value: 'weather-open-meteo', label: 'Open-Meteo' }]) }),
}));

vi.mock('../components/location-summary.vue', () => ({
	default: { name: 'LocationSummary', props: ['location', 'primary', 'providerName'], template: '<div />' },
}));

vi.mock('../components/location-detail.vue', () => ({
	default: { name: 'LocationDetail', template: '<div />' },
}));

vi.mock('../components/location-forecast.vue', () => ({
	default: { name: 'LocationForecast', template: '<div />' },
}));

vi.mock('../components/location-hourly-forecast.vue', () => ({
	default: { name: 'LocationHourlyForecast', template: '<div />' },
}));

// Counts the editor's setups, so a test can tell a remount from a reused instance
const formMounts = vi.fn();

const RoutedForm = defineComponent({
	name: 'RoutedForm',
	props: { remoteFormChanged: { type: Boolean, default: false } },
	emits: ['update:remote-form-changed'],
	setup() {
		formMounts();

		return (): ReturnType<typeof h> => h('form');
	},
});

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/weather/locations', name: RouteNames.WEATHER_LOCATIONS, component: { template: '<div />' } },
			{
				path: '/weather/location/:id',
				name: RouteNames.WEATHER_LOCATION,
				component: ViewLocation,
				props: true,
				children: [{ path: 'edit', name: RouteNames.WEATHER_LOCATION_DETAIL_EDIT, component: RoutedForm }],
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

const WEATHER = { current: {}, hourlyForecast: [{}], forecast: [] };

enableAutoUnmount(afterEach);

describe('ViewLocation', () => {
	beforeEach(() => {
		confirm.mockReset();
		fetchLocationWeather.mockReset().mockResolvedValue(undefined);
		fetchLocation.mockReset().mockResolvedValue(undefined);
		formMounts.mockReset();
		location.value = LOCATION;
		weather.value = WEATHER;
		hasError.value = false;
		inDrawer.value = true;
	});

	it('shows the summary with the provider and the primary flag, then the current weather and the forecasts', async () => {
		const { wrapper } = await mountAt('/weather/location/location-1');
		const summary = wrapper.findComponent({ name: 'LocationSummary' });

		expect(summary.props('providerName')).toBe('Open-Meteo');
		expect(summary.props('primary')).toBe(true);
		expect(wrapper.find('[data-test-id="location-current-card"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="location-hourly-card"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="location-forecast-card"]').exists()).toBe(true);
	});

	it('keeps the location editable when its weather does not load, and retries on request', async () => {
		weather.value = null;
		hasError.value = true;

		const { wrapper, router } = await mountAt('/weather/location/location-1');

		expect(wrapper.find('[data-kind="error"]').exists()).toBe(true);
		expect(wrapper.findComponent({ name: 'LocationSummary' }).exists()).toBe(true);

		await wrapper.get('[data-test-id="location-weather-retry"]').trigger('click');

		expect(fetchLocationWeather).toHaveBeenCalledWith('location-1');

		await wrapper.get('[data-test-id="location-edit"]').trigger('click');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.WEATHER_LOCATION_DETAIL_EDIT);
		expect(wrapper.findComponent(RoutedForm).exists()).toBe(true);
	});

	it('asks before the drawer closes a changed form, and returns to the detail', async () => {
		const { wrapper, router } = await mountAt('/weather/location/location-1/edit');

		wrapper.findComponent(RoutedForm).vm.$emit('update:remote-form-changed', true);
		await flushPromises();

		confirm.mockRejectedValueOnce(new Error('cancel'));

		wrapper.findComponent({ name: 'EditDrawerLayout' }).vm.$emit('close');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.WEATHER_LOCATION_DETAIL_EDIT);

		confirm.mockResolvedValueOnce(true);

		wrapper.findComponent({ name: 'EditDrawerLayout' }).vm.$emit('close');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.WEATHER_LOCATION);
	});

	it('opens Edit as its own page on phone, and Back from it returns to the detail', async () => {
		inDrawer.value = false;

		const { wrapper, router } = await mountAt('/weather/location/location-1');

		await wrapper.get('[data-test-id="location-edit"]').trigger('click');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.WEATHER_LOCATION_DETAIL_EDIT);
		expect(wrapper.findComponent({ name: 'LocationSummary' }).exists()).toBe(false);
		expect(wrapper.findComponent(RoutedForm).exists()).toBe(true);

		router.back();
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.WEATHER_LOCATION);
	});

	it('says so when the location is not there', async () => {
		location.value = null;

		const { wrapper } = await mountAt('/weather/location/location-1');

		expect(wrapper.find('[data-kind="not-found"]').exists()).toBe(true);
	});

	it('loads the weather of the location it moved to, not of the one it left while loading', async () => {
		let finishFirst: () => void = () => {};

		fetchLocation.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finishFirst = resolve;
				})
		);

		const router = makeRouter();

		await router.push('/weather/location/location-1');

		mount(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [router] } });

		// Location 1's record is still on its way when the page moves to location 2
		await router.push('/weather/location/location-2');
		await flushPromises();

		finishFirst();
		await flushPromises();

		expect(fetchLocationWeather.mock.calls.map((call) => call[0])).toEqual(['location-2']);
	});

	it('remounts the editor for another location, so its form does not save the values of one location to another', async () => {
		const { router } = await mountAt('/weather/location/location-1/edit');

		expect(formMounts).toHaveBeenCalledTimes(1);

		await router.push('/weather/location/location-2/edit');
		await flushPromises();

		expect(formMounts).toHaveBeenCalledTimes(2);
	});
});
