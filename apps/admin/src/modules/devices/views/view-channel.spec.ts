/* eslint-disable vue/one-component-per-file -- stubs of the child components */
import { describe, expect, it, vi } from 'vitest';

import { flushPromises, shallowMount } from '@vue/test-utils';

import { RouteNames } from '../devices.constants';

import ViewChannel from './view-channel.vue';

const CHANNEL_ID = '00000000-0000-4000-8000-000000000003';

const mocks = vi.hoisted(() => ({
	route: { path: '/channel/00000000-0000-4000-8000-000000000003', name: 'channel', matched: [] as { name: string }[], meta: {} },
	routerReplace: vi.fn(),
	routerPush: vi.fn(),
	confirmDiscard: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-meta', () => ({
	useMeta: () => ({ meta: {} }),
}));

vi.mock('vue-router', () => ({
	useRoute: () => mocks.route,
	useRouter: () => ({
		// Resolves to the path of the channel page the view is on
		resolve: (to: { name: string }) => ({ path: to.name === RouteNames.CHANNEL ? mocks.route.path : `/other/${to.name}` }),
		replace: mocks.routerReplace,
		push: mocks.routerPush,
	}),
}));

vi.mock('../../../common', async () => {
	const { defineComponent, h, ref } = await import('vue');

	const stub = defineComponent({
		setup:
			(_, { slots }) =>
			() =>
				h('div', slots.default?.()),
	});

	return {
		AppBreadcrumbs: stub,
		EditDrawerLayout: stub,
		EntityNotFound: stub,
		ViewError: stub,
		ViewHeader: stub,
		provideEditDrawer: (open: () => boolean) => ({ opened: open(), inDrawer: ref(true), mode: ref('drawer'), drawerSize: ref('640px') }),
		useFlashMessage: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
		useUuid: () => ({ validate: () => true }),
	};
});

vi.mock('../components/components', async () => {
	const { defineComponent } = await import('vue');

	return {
		ListChannelsProperties: defineComponent({ name: 'ListChannelsProperties', template: '<div />' }),
		ListChannelsPropertiesAdjust: defineComponent({ name: 'ListChannelsPropertiesAdjust', template: '<div />' }),
	};
});

vi.mock('../composables/composables', async () => {
	const { ref } = await import('vue');

	return {
		useChannel: () => ({
			channel: ref({ id: '00000000-0000-4000-8000-000000000003', name: 'Light' }),
			isLoading: ref(false),
			fetchChannel: vi.fn(() => Promise.resolve()),
		}),
		useChannelSpecification: () => ({ canAddAnotherProperty: ref(true) }),
		useChannelsPropertiesActions: () => ({ remove: vi.fn() }),
		useChannelsPropertiesDataSource: () => ({
			properties: ref([]),
			propertiesPaginated: ref([]),
			totalRows: ref(0),
			filters: ref({}),
			filtersActive: ref(false),
			sortBy: ref(undefined),
			sortDir: ref(null),
			paginateSize: ref(10),
			paginatePage: ref(1),
			areLoading: ref(false),
			fetchProperties: vi.fn(() => Promise.resolve()),
			resetFilter: vi.fn(),
		}),
		useDiscardGuard: () => ({ confirmDiscard: mocks.confirmDiscard }),
	};
});

describe('ViewChannel', () => {
	// The property-list adjustment has no route of its own: on the base channel route it opens at once
	it('opens the property list adjustment from the channel page', async () => {
		const wrapper = shallowMount(ViewChannel, { props: { id: CHANNEL_ID } });

		await flushPromises();

		const vm = wrapper.vm as unknown as { onAdjustList: () => Promise<void>; showDrawer: boolean; adjustList: boolean };

		await vm.onAdjustList();

		expect(vm.showDrawer).toBe(true);
		expect(vm.adjustList).toBe(true);
		expect(mocks.confirmDiscard).not.toHaveBeenCalled();
		expect(mocks.routerReplace).not.toHaveBeenCalled();
	});
});
