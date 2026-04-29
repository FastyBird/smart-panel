/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import ViewSpaces from './view-spaces.vue';

const mocks = vi.hoisted(() => ({
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	routerResolve: vi.fn((route) => route),
	fetchSpaces: vi.fn(),
	wizardOptions: [] as { value: string; label: string; description: string; disabled: boolean }[],
	route: {
		path: '/spaces',
		name: 'spaces',
		matched: [],
	},
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
	const { defineComponent: defineVueComponent, h, ref: vueRef } = await import('vue');

	const StubComponent = defineVueComponent({
		setup(_, { slots }) {
			return () => h('div', [slots.default?.(), slots.extra?.(), slots.icon?.(), slots.title?.(), slots.subtitle?.()]);
		},
	});

	return {
		AppBar: StubComponent,
		AppBarButton: StubComponent,
		AppBarButtonAlign: {
			LEFT: 'left',
			RIGHT: 'right',
		},
		AppBarHeading: StubComponent,
		AppBreadcrumbs: StubComponent,
		ViewError: StubComponent,
		ViewHeader: StubComponent,
		useBreakpoints: () => ({
			isMDDevice: vueRef(true),
			isLGDevice: vueRef(false),
		}),
		useFlashMessage: () => ({
			error: vi.fn(),
		}),
	};
});

vi.mock('../components/components', async () => {
	const { defineComponent: defineVueComponent } = await import('vue');

	return {
		ListSpaces: defineVueComponent({
			template: '<div />',
		}),
	};
});

vi.mock('../components/list-spaces-adjust.vue', async () => {
	const { defineComponent: defineVueComponent } = await import('vue');

	return {
		default: defineVueComponent({
			template: '<div />',
		}),
	};
});

vi.mock('../composables', () => ({
	useSpacesActions: () => ({
		remove: vi.fn(),
		bulkRemove: vi.fn(),
	}),
	useSpacesDataSource: () => ({
		fetchSpaces: mocks.fetchSpaces,
		spaces: ref([]),
		spacesPaginated: ref([]),
		totalRows: ref(0),
		filters: ref({ types: [] }),
		filtersActive: ref(false),
		sortBy: ref(undefined),
		sortDir: ref(null),
		paginateSize: ref(10),
		paginatePage: ref(1),
		areLoading: ref(false),
		resetFilter: vi.fn(),
	}),
	useSpacesPlugins: () => ({
		wizardOptions: computed(() => mocks.wizardOptions),
	}),
}));

vi.mock('../spaces.constants', () => ({
	RouteNames: {
		SPACES: 'spaces',
		SPACES_ADD: 'spaces-add',
		SPACES_EDIT: 'spaces-edit',
		SPACES_ONBOARDING: 'spaces-wizard',
	},
}));

const mountView = () =>
	mount(ViewSpaces, {
		global: {
			stubs: {
				ElButton: defineComponent({
					template: '<button type="button" @click="$emit(\'click\')"><slot /><slot name="icon" /></button>',
				}),
				ElCard: defineComponent({
					template: '<div @click="$emit(\'click\')"><slot /></div>',
				}),
				ElDialog: defineComponent({
					props: {
						modelValue: { type: Boolean, default: false },
					},
					template: '<div v-if="modelValue"><slot /><slot name="footer" /></div>',
				}),
				ElDrawer: true,
				ElIcon: defineComponent({
					template: '<span><slot /></span>',
				}),
				Icon: true,
				RouterView: true,
				Suspense: false,
				teleport: true,
			},
		},
	});

describe('ViewSpaces', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetchSpaces.mockResolvedValue(undefined);
		mocks.wizardOptions = [];
		mocks.route = {
			path: '/spaces',
			name: 'spaces',
			matched: [],
		};
	});

	it('opens the only installed wizard directly without showing the selection dialog', async () => {
		mocks.wizardOptions = [
			{
				value: 'spaces-home-control-plugin',
				label: 'Home Control Spaces',
				description: 'Wizard',
				disabled: false,
			},
		];

		const wrapper = mountView();

		await wrapper.findAll('button').find((button) => button.text().includes('spacesModule.buttons.onboarding.title'))?.trigger('click');

		expect(mocks.routerPush).toHaveBeenCalledWith({
			name: 'spaces-wizard',
			params: {
				type: 'spaces-home-control-plugin',
			},
		});
		expect(wrapper.text()).not.toContain('Home Control Spaces');
	});
});
