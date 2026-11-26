import type { Ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { ListFilterBar, ViewHeader } from '../../../common';
import { SystemModuleLogEntrySource, SystemModuleLogEntryType } from '../../../openapi.constants';
import type { ISystemLogsFilter } from '../composables/types';
import type { ILogEntry } from '../store/logs-entries.store.types';
import { RouteNames } from '../system.constants';

import ViewSystemLogs from './view-system-logs.vue';

enableAutoUnmount(afterEach);

const mocks = vi.hoisted(() => ({
	isPhone: null as unknown as Ref<boolean>,
	route: null as unknown as { name: string; params: Record<string, string>; query: Record<string, string> },
	push: vi.fn(),
	fetchSystemLogs: vi.fn(),
	refreshSystemLogs: vi.fn(),
	loadMoreSystemLogs: vi.fn(),
	filters: null as unknown as Ref<ISystemLogsFilter>,
	systemLogs: null as unknown as Ref<ILogEntry[]>,
	error: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-meta', () => ({
	useMeta: vi.fn(),
}));

vi.mock('vue-router', async () => {
	const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
	const { reactive } = await import('vue');

	mocks.route = reactive({ name: 'system_module-system_logs', params: {}, query: { page: '1' } });

	return {
		...actual,
		useRoute: () => mocks.route,
		useRouter: () => ({ push: mocks.push, resolve: () => ({ href: '/' }) }),
	};
});

vi.mock('../../../common', async () => {
	const actual = await vi.importActual<typeof import('../../../common')>('../../../common');
	const { defineComponent: defineVueComponent, ref } = await import('vue');

	mocks.isPhone = ref(false);

	return {
		...actual,
		AppBreadcrumbs: defineVueComponent({ name: 'AppBreadcrumbs', props: ['items'], setup: () => () => null }),
		useFlashMessage: () => ({ success: vi.fn(), error: mocks.error, info: vi.fn() }),
		useSizeClass: () => ({
			isPhone: mocks.isPhone,
			isTabletPortrait: ref(false),
			isTabletLandscape: ref(false),
			isDesktop: ref(true),
			isTouch: ref(false),
			sizeClass: ref('dt'),
		}),
	};
});

vi.mock('../composables/useSystemLogsDataSource', async () => {
	const { computed, ref } = await import('vue');

	mocks.filters = ref({ search: undefined, levels: [], sources: [], tag: undefined });
	mocks.systemLogs = ref([]);

	return {
		useSystemLogsDataSource: () => ({
			systemLogs: mocks.systemLogs,
			hasMore: ref(false),
			areLoading: ref(false),
			loaded: computed(() => true),
			fetchSystemLogs: mocks.fetchSystemLogs,
			loadMoreSystemLogs: mocks.loadMoreSystemLogs,
			refreshSystemLogs: mocks.refreshSystemLogs,
			filters: mocks.filters,
			filtersActive: computed(() => mocks.filters.value.levels.length > 0),
			resetFilter: vi.fn(),
			live: ref(false),
		}),
	};
});

const entry = (id: string): ILogEntry =>
	({
		id,
		ts: '2026-11-26T10:00:00.000Z',
		source: SystemModuleLogEntrySource.backend,
		level: 3,
		type: SystemModuleLogEntryType.info,
		message: `Message ${id}`,
		user: {},
		context: {},
	}) as ILogEntry;

const RouterView = {
	name: 'RouterView',
	setup:
		(_: unknown, { slots }: { slots: { default?: (scope: { Component: undefined }) => unknown } }) =>
		() =>
			slots.default?.({ Component: undefined }),
};

const mountView = () => mount(ViewSystemLogs, { global: { stubs: { RouterView } } });

describe('ViewSystemLogs', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.isPhone.value = false;
		mocks.route.name = RouteNames.SYSTEM_LOGS;
		mocks.route.params = {};
		mocks.filters.value = { search: undefined, levels: [], sources: [], tag: undefined };
		mocks.systemLogs.value = [entry('a'), entry('b')];
		mocks.fetchSystemLogs.mockResolvedValue(undefined);

		Element.prototype.scrollTo = vi.fn();
	});

	it('reads the entries and shows them beside an empty pane until one is picked', async () => {
		const wrapper = mountView();
		await flushPromises();

		expect(mocks.fetchSystemLogs).toHaveBeenCalledTimes(1);
		expect(wrapper.find('[data-test-id="system-logs-two-pane"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="system-logs-no-selection"]').exists()).toBe(true);
		expect(wrapper.findAll('[data-test-id="system-logs-row"]')).toHaveLength(2);
	});

	it('opens an entry on its route, keeping the list query', async () => {
		const wrapper = mountView();
		await flushPromises();

		await wrapper.findAll('[data-test-id="system-logs-row"]')[1].trigger('click');

		expect(mocks.push).toHaveBeenCalledWith({ name: RouteNames.SYSTEM_LOG_DETAIL, params: { id: 'b' }, query: { page: '1' } });
	});

	it('on phone gives an open entry the whole page, without the list or its header', async () => {
		mocks.isPhone.value = true;
		mocks.route.name = RouteNames.SYSTEM_LOG_DETAIL;
		mocks.route.params = { id: 'a' };

		const wrapper = mountView();
		await flushPromises();

		expect(wrapper.find('[data-test-id="system-logs-two-pane"]').exists()).toBe(false);
		expect(wrapper.findComponent(ViewHeader).exists()).toBe(false);
		expect(wrapper.find('[data-test-id="system-logs-row"]').exists()).toBe(false);
	});

	it('counts the drawer filters on the filter bar, the search left out', async () => {
		mocks.filters.value = {
			search: 'socket',
			levels: [SystemModuleLogEntryType.error],
			sources: [SystemModuleLogEntrySource.admin],
			tag: undefined,
		};

		const wrapper = mountView();
		await flushPromises();

		expect(wrapper.findComponent(ListFilterBar).props('search')).toBe('socket');
		expect(wrapper.findComponent(ListFilterBar).props('activeCount')).toBe(2);
	});

	it('says when the entries cannot be read, and reads them again on retry', async () => {
		mocks.systemLogs.value = [];
		mocks.fetchSystemLogs.mockRejectedValue(new Error('offline'));
		mocks.refreshSystemLogs.mockResolvedValue(undefined);

		const wrapper = mountView();
		await flushPromises();

		expect(mocks.error).toHaveBeenCalledWith('systemModule.messages.misc.requestError');

		await wrapper.get('[data-test-id="system-logs-error"] button').trigger('click');
		await flushPromises();

		expect(mocks.refreshSystemLogs).toHaveBeenCalledTimes(1);
		expect(wrapper.find('[data-test-id="system-logs-error"]').exists()).toBe(false);
	});
});
