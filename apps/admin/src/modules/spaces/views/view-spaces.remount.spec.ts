/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, onMounted, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import ViewSpaces from './view-spaces.vue';

const mocks = vi.hoisted(() => ({
	route: null as unknown as { name: string; path: string; params: Record<string, string>; matched: { name: string }[] },
	mounts: [] as string[],
}));

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('vue-meta', () => ({ useMeta: () => ({ meta: {} }) }));

vi.mock('vue-router', async () => {
	const { reactive } = await import('vue');

	mocks.route = reactive({ name: 'spaces-edit', path: '/spaces/a', params: { id: 'a' }, matched: [{ name: 'spaces-edit' }] });

	return {
		useRoute: () => mocks.route,
		useRouter: () => ({ push: vi.fn(), replace: vi.fn(), resolve: (to: unknown) => to }),
	};
});

vi.mock('../../../common', async () => {
	const { defineComponent: defineVueComponent, h: hyper, ref: vueRef } = await import('vue');

	const Passthrough = defineVueComponent({
		setup:
			(_, { slots }) =>
			() =>
				hyper('div', [slots.default?.(), slots.form?.()]),
	});

	return {
		AppBreadcrumbs: Passthrough,
		ViewError: Passthrough,
		ViewHeader: Passthrough,
		EditDrawerLayout: Passthrough,
		TypePicker: Passthrough,
		provideEditDrawer: () => ({ inDrawer: vueRef(true) }),
		useSizeClass: () => ({ isPhone: vueRef(false) }),
		useFlashMessage: () => ({ error: vi.fn() }),
	};
});

vi.mock('../components/components', () => ({ ListSpaces: { name: 'ListSpaces', template: '<div />' } }));

vi.mock('../composables', () => ({
	useSpacesActions: () => ({ remove: vi.fn(), bulkRemove: vi.fn() }),
	useSpacesDataSource: () => ({
		fetchSpaces: vi.fn().mockResolvedValue(undefined),
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
	useSpacesPlugins: () => ({ wizardOptions: computed(() => []) }),
}));

vi.mock('../spaces.constants', () => ({
	RouteNames: { SPACES: 'spaces', SPACES_ADD: 'spaces-add', SPACES_EDIT: 'spaces-edit', SPACES_WIZARD: 'spaces-wizard' },
}));

// The routed editor: records the space each new instance was mounted for
const EditorStub = defineComponent({
	name: 'ViewSpaceEdit',
	setup() {
		onMounted(() => mocks.mounts.push(String(mocks.route.params.id)));

		return () => h('form');
	},
});

const RouterViewStub = defineComponent({
	name: 'RouterView',
	setup:
		(_, { slots }) =>
		() =>
			slots.default?.({ Component: EditorStub }),
});

describe('ViewSpaces editor', () => {
	it('remounts the editor when another space opens, so its save goes to that space', async () => {
		mount(ViewSpaces, { global: { stubs: { RouterView: RouterViewStub, ElButton: true, Icon: true, Suspense: false } } });
		await flushPromises();

		expect(mocks.mounts).toEqual(['a']);

		mocks.route.path = '/spaces/b';
		mocks.route.params = { id: 'b' };
		await flushPromises();

		expect(mocks.mounts).toEqual(['a', 'b']);
	});
});
