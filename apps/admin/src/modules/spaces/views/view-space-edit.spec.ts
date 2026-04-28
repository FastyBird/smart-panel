/* eslint-disable vue/one-component-per-file */
import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import ViewSpaceEdit from './view-space-edit.vue';

const mocks = vi.hoisted(() => ({
	fetchSpace: vi.fn(),
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	routerResolve: vi.fn((route) => route),
	route: {
		name: 'spaces-edit',
		params: { id: 'space-1' },
		matched: [{ name: 'spaces-edit' }],
	},
	space: {
		id: 'space-1',
		name: 'Kitchen',
		description: null,
		icon: null,
		category: null,
		type: 'room',
		parentId: null,
		suggestionsEnabled: false,
	},
	fetching: false,
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('vue-meta', () => ({
	useMeta: () => ({
		meta: {},
	}),
}));

vi.mock('vue-router', () => ({
	useRoute: () => mocks.route,
	useRouter: () => ({
		push: mocks.routerPush,
		replace: mocks.routerReplace,
		resolve: mocks.routerResolve,
	}),
}));

vi.mock('../../../common', async () => {
	const { defineComponent, h, ref: vueRef } = await import('vue');

	const StubComponent = defineComponent({
		props: {
			items: { type: Array, required: false, default: () => [] },
			align: { type: String, required: false, default: undefined },
			teleport: { type: Boolean, required: false, default: false },
			small: { type: Boolean, required: false, default: false },
		},
		setup(_, { slots }) {
			return () => h('div', slots.default?.());
		},
	});

	return {
		AppBarButton: StubComponent,
		AppBarButtonAlign: {
			LEFT: 'left',
			RIGHT: 'right',
		},
		AppBarHeading: StubComponent,
		AppBreadcrumbs: defineComponent({
			name: 'AppBreadcrumbs',
			props: {
				items: { type: Array, required: true },
			},
			template: '<div />',
		}),
		useBreakpoints: () => ({
			isMDDevice: vueRef(true),
			isLGDevice: vueRef(false),
		}),
		useFlashMessage: () => ({
			success: vi.fn(),
			warning: vi.fn(),
		}),
	};
});

vi.mock('../composables', () => ({
	useSpace: () => ({
		space: ref(mocks.space),
		fetching: ref(mocks.fetching),
		fetchSpace: mocks.fetchSpace,
	}),
	useSpacesPlugins: () => ({
		getElement: () => undefined,
	}),
}));

vi.mock('../spaces.constants', () => ({
	RouteNames: {
		SPACES: 'spaces',
		SPACES_EDIT: 'spaces-edit',
	},
	SpaceRoomCategory: {},
	SpaceZoneCategory: {},
	getSpaceIcon: () => 'mdi:shape-outline',
}));

describe('ViewSpaceEdit', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.route = {
			name: 'spaces-edit',
			params: { id: 'space-1' },
			matched: [{ name: 'spaces-edit' }],
		};
		mocks.fetching = false;
		mocks.fetchSpace.mockResolvedValue(undefined);
	});

	it('uses return route as the parent breadcrumb when hosted by a plugin edit route', () => {
		mocks.route = {
			name: 'plugin-space-edit',
			params: { id: 'space-1' },
			matched: [{ name: 'plugin-space-edit' }],
		};

		const wrapper = shallowMount(ViewSpaceEdit, {
			props: {
				id: 'space-1',
				returnRoute: { name: 'plugin-space', params: { id: 'space-1' } },
			},
			global: {
				stubs: {
					Icon: true,
					ElAlert: true,
					ElButton: true,
					ElIcon: true,
					ElScrollbar: true,
					teleport: true,
				},
			},
		});

		const breadcrumbs = wrapper.findComponent({ name: 'AppBreadcrumbs' }).props('items');

		expect(breadcrumbs).toEqual([
			{
				label: 'spacesModule.breadcrumbs.spaces.list',
				route: { name: 'spaces' },
			},
			{
				label: 'spacesModule.breadcrumbs.spaces.detail',
				route: { name: 'plugin-space', params: { id: 'space-1' } },
			},
			{
				label: 'spacesModule.breadcrumbs.spaces.edit',
				route: { name: 'plugin-space-edit', params: { id: 'space-1' } },
			},
		]);
	});
});
