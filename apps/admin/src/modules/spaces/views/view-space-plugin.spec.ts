/* eslint-disable vue/one-component-per-file */
import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, shallowMount } from '@vue/test-utils';

import ViewSpacePlugin from './view-space-plugin.vue';

const mocks = vi.hoisted(() => ({
	fetchSpace: vi.fn(),
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	routerResolve: vi.fn((route) => route),
	space: null,
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
	useRoute: () => ({
		path: '/space/7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d/plugin/spaces-home-control/configure',
	}),
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
			message: { type: String, required: false, default: '' },
			buttonLabel: { type: String, required: false, default: '' },
			icon: { type: String, required: false, default: '' },
			heading: { type: String, required: false, default: '' },
			subHeading: { type: String, required: false, default: '' },
		},
		setup(_, { slots }) {
			return () => h('div', slots.default?.());
		},
	});

	const EntityNotFound = defineComponent({
		name: 'EntityNotFound',
		props: {
			message: { type: String, required: true },
		},
		template: '<div data-test-id="space-not-found">{{ message }}</div>',
	});

	return {
		AppBarButton: StubComponent,
		AppBarButtonAlign: {
			LEFT: 'left',
		},
		AppBarHeading: StubComponent,
		AppBreadcrumbs: StubComponent,
		EntityNotFound,
		ViewHeader: StubComponent,
		useBreakpoints: () => ({
			isMDDevice: vueRef(false),
			isLGDevice: vueRef(false),
		}),
		useFlashMessage: () => ({
			error: vi.fn(),
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
}));

vi.mock('../spaces.constants', () => ({
	RouteNames: {
		SPACES: 'spaces',
	},
	getSpaceIcon: () => 'mdi:shape-outline',
}));

describe('ViewSpacePlugin', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.space = null;
		mocks.fetching = false;
		mocks.fetchSpace.mockResolvedValue(undefined);
	});

	it('renders not-found fallback when plugin space lookup fails', async () => {
		mocks.fetchSpace.mockRejectedValue(new Error('Not found'));

		const wrapper = shallowMount(ViewSpacePlugin, {
			props: {
				id: '7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d',
			},
			global: {
				stubs: {
					RouterView: true,
					teleport: true,
				},
			},
		});

		await flushPromises();

		expect(wrapper.findComponent({ name: 'EntityNotFound' }).exists()).toBe(true);
	});
});
