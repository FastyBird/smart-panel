/* eslint-disable vue/one-component-per-file -- stubs of the child components */
import { describe, expect, it, vi } from 'vitest';

import { flushPromises, shallowMount } from '@vue/test-utils';

import { RouteNames } from '../devices.constants';

import ViewChannels from './view-channels.vue';

const mocks = vi.hoisted(() => ({
	route: { path: '/channels', name: 'channels', matched: [] as { name: string }[], meta: {} },
	routerReplace: vi.fn(),
	routerPush: vi.fn(),
	confirmDiscard: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-meta', () => ({
	useMeta: () => ({}),
}));

vi.mock('vue-router', () => ({
	useRoute: () => mocks.route,
	useRouter: () => ({
		// Resolves to the path of the base route the page is on
		resolve: (to: { name: string }) => ({ path: to.name === RouteNames.CHANNELS ? '/channels' : `/other/${to.name}` }),
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
		ViewError: stub,
		ViewHeader: stub,
		provideEditDrawer: (open: () => boolean) => ({ opened: open(), inDrawer: ref(true), mode: ref('drawer'), drawerSize: ref('640px') }),
	};
});

vi.mock('../components/components', async () => {
	const { defineComponent } = await import('vue');

	return {
		ListChannels: defineComponent({ name: 'ListChannels', template: '<div />' }),
		ListChannelsAdjust: defineComponent({ name: 'ListChannelsAdjust', template: '<div />' }),
	};
});

vi.mock('../composables/composables', async () => {
	const { ref } = await import('vue');

	return {
		useChannelsActions: () => ({ remove: vi.fn() }),
		useChannelsDataSource: () => ({
			fetchChannels: vi.fn(() => Promise.resolve()),
			channels: ref([]),
			channelsPaginated: ref([]),
			totalRows: ref(0),
			filters: ref({}),
			filtersActive: ref(false),
			sortBy: ref(undefined),
			sortDir: ref(null),
			paginateSize: ref(10),
			paginatePage: ref(1),
			areLoading: ref(false),
			resetFilter: vi.fn(),
		}),
		useDiscardGuard: () => ({ confirmDiscard: mocks.confirmDiscard }),
	};
});

describe('ViewChannels', () => {
	// The adjustment has no route of its own: on the base list route it opens at once
	it('opens the list adjustment from the Channels list', async () => {
		const wrapper = shallowMount(ViewChannels);

		await flushPromises();

		const vm = wrapper.vm as unknown as { onAdjustList: () => Promise<void>; showDrawer: boolean; adjustList: boolean };

		await vm.onAdjustList();

		expect(vm.showDrawer).toBe(true);
		expect(vm.adjustList).toBe(true);
		expect(mocks.confirmDiscard).not.toHaveBeenCalled();
		expect(mocks.routerReplace).not.toHaveBeenCalled();
	});
});
