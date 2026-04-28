/* eslint-disable vue/one-component-per-file */
import { nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import { SpaceType } from '../../../modules/spaces';

import ViewSpaceConfigure from './view-space-configure.vue';

const mocks = vi.hoisted(() => ({
	displaysLoaded: true,
	fetchDevices: vi.fn(),
	fetchDisplays: vi.fn(),
	fetchScenes: vi.fn(),
	fetchSpaces: vi.fn(),
	devicesLoaded: true,
	isLGDevice: false,
	routeMatched: [] as Array<{ name: string }>,
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	scenesLoaded: true,
	spacesFirstLoadFinished: false,
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('vue-router', () => ({
	useRoute: () => ({
		matched: mocks.routeMatched,
		path: '/space/7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d/plugin/spaces-home-control/configure',
	}),
	useRouter: () => ({
		push: mocks.routerPush,
		replace: mocks.routerReplace,
	}),
}));

vi.mock('../../../common', async () => {
	const { defineComponent, ref } = await import('vue');

	return {
		AppBar: defineComponent({
			template: '<div><slot /><slot name="button-right" /></div>',
		}),
		AppBarButton: defineComponent({
			template: '<button type="button"><slot /><slot name="icon" /></button>',
		}),
		AppBarButtonAlign: {
			RIGHT: 'right',
		},
		ViewError: defineComponent({
			template: '<div><slot /><slot name="icon" /><slot name="message" /></div>',
		}),
		useBreakpoints: () => ({
			isLGDevice: ref(mocks.isLGDevice),
		}),
	};
});

vi.mock('../../../modules/devices/composables/useDevices', async () => {
	const { ref } = await import('vue');

	return {
		useDevices: () => ({
			fetchDevices: mocks.fetchDevices,
			loaded: ref(mocks.devicesLoaded),
		}),
	};
});

vi.mock('../../../modules/displays/composables/useDisplays', async () => {
	const { ref } = await import('vue');

	return {
		useDisplays: () => ({
			fetchDisplays: mocks.fetchDisplays,
			isLoaded: ref(mocks.displaysLoaded),
		}),
	};
});

vi.mock('../../../modules/scenes/composables/useScenes', async () => {
	const { ref } = await import('vue');

	return {
		useScenes: () => ({
			fetchScenes: mocks.fetchScenes,
			loaded: ref(mocks.scenesLoaded),
		}),
	};
});

vi.mock('../../../modules/spaces', async () => {
	const { ref } = await import('vue');

	return {
		RouteNames: {
			SPACE_EDIT: 'spaces-plugin-edit',
		},
		SpaceType: {
			ROOM: 'room',
			ZONE: 'zone',
		},
		useSpaces: () => ({
			fetchSpaces: mocks.fetchSpaces,
			firstLoadFinished: ref(mocks.spacesFirstLoadFinished),
		}),
	};
});

vi.mock('../components/components', async () => {
	const { defineComponent, h } = await import('vue');

	const StubComponent = defineComponent({
		props: {
			space: { type: Object, required: false, default: null },
			spaceId: { type: String, required: false, default: null },
			spaceType: { type: String, required: false, default: null },
			visible: { type: Boolean, required: false },
		},
		setup(_, { slots }) {
			return () => h('div', slots.default?.());
		},
	});

	return {
		SpaceAddDeviceDialog: StubComponent,
		SpaceAddDisplayDialog: StubComponent,
		SpaceAddSceneDialog: StubComponent,
		SpaceDetail: StubComponent,
		SpaceDevicesSection: StubComponent,
		SpaceDisplaysSection: StubComponent,
		SpaceDomainsSection: StubComponent,
		SpaceParentZoneSection: StubComponent,
		SpaceScenesSection: StubComponent,
	};
});

describe('ViewSpaceConfigure', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.devicesLoaded = true;
		mocks.scenesLoaded = true;
		mocks.displaysLoaded = true;
		mocks.isLGDevice = false;
		mocks.routeMatched = [];
		mocks.spacesFirstLoadFinished = false;
	});

	it('loads spaces collection before rendering when it has not been loaded yet', () => {
		shallowMount(ViewSpaceConfigure, {
			props: {
				space: {
					id: '7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d',
					name: 'Living room',
					category: null,
					description: null,
					type: SpaceType.ROOM,
					icon: null,
					displayOrder: 0,
					parentId: null,
					suggestionsEnabled: false,
					statusWidgets: null,
					createdAt: new Date(),
					updatedAt: null,
					draft: false,
				},
			},
			global: {
				stubs: {
					RouterView: true,
					teleport: true,
				},
			},
		});

		expect(mocks.fetchSpaces).toHaveBeenCalledTimes(1);
	});

	it('opens space edit inside the configure route', async () => {
		const wrapper = shallowMount(ViewSpaceConfigure, {
			props: {
				space: {
					id: '7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d',
					name: 'Living room',
					category: null,
					description: null,
					type: SpaceType.ROOM,
					icon: null,
					displayOrder: 0,
					parentId: null,
					suggestionsEnabled: false,
					statusWidgets: null,
					createdAt: new Date(),
					updatedAt: null,
					draft: false,
				},
			},
			global: {
				stubs: {
					RouterView: true,
					teleport: true,
				},
			},
		});

		await nextTick();

		await wrapper.find('[data-test-id="edit-space"]').trigger('click');

		expect(mocks.routerPush).toHaveBeenCalledWith({
			name: 'spaces_home_control_plugin-space_edit',
			params: {
				id: '7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d',
			},
		});
	});

	it('renders the edit child route on non-large screens', () => {
		mocks.routeMatched = [{ name: 'spaces_home_control_plugin-space_edit' }];

		const wrapper = shallowMount(ViewSpaceConfigure, {
			props: {
				space: {
					id: '7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d',
					name: 'Living room',
					category: null,
					description: null,
					type: SpaceType.ROOM,
					icon: null,
					displayOrder: 0,
					parentId: null,
					suggestionsEnabled: false,
					statusWidgets: null,
					createdAt: new Date(),
					updatedAt: null,
					draft: false,
				},
			},
			global: {
				stubs: {
					RouterView: true,
					teleport: true,
				},
			},
		});

		expect(wrapper.find('[data-test-id="space-configure-edit-route"]').exists()).toBe(true);
	});
});
